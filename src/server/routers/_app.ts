import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { and, desc, eq, inArray, or } from 'drizzle-orm';
import {
  comments,
  commentRevisions,
  postRevisions,
  posts,
  postLikes,
  postTags,
  tagRequests,
  tagRevisions,
  tags,
} from '@/db/schema';
import { removeAlgoliaPost, upsertAlgoliaPost } from '@/lib/algolia';
import { adminProcedure, protectedProcedure, publicProcedure, router } from '@/server/trpc';

const postInput = z.object({
  title: z.string().min(1).max(256),
  slug: z.string().max(256).optional(),
  excerpt: z.string().max(500).optional(),
  content: z.string().optional(),
  tagIds: z.array(z.string().uuid()).optional(),
  tagNames: z.array(z.string().min(1).max(64)).optional(),
});

const postEditInput = z
  .object({
    postId: z.string().uuid(),
    title: z.string().min(1).max(256).optional(),
    excerpt: z.string().min(1).max(500).optional(),
    content: z.string().min(1).optional(),
    tagIds: z.array(z.string().uuid()).optional(),
    tagNames: z.array(z.string().min(1).max(64)).optional(),
  })
  .refine(
    (data) =>
      data.title ||
      data.excerpt ||
      data.content ||
      data.tagIds !== undefined ||
      data.tagNames !== undefined,
    {
    message: 'At least one field must be provided.',
    }
  );

const commentInput = z.object({
  postId: z.string().uuid(),
  body: z.string().min(1).max(2000),
  parentId: z.string().uuid().optional(),
});

const commentEditInput = z.object({
  commentId: z.string().uuid(),
  body: z.string().min(1).max(2000),
});

const tagRequestInput = z.object({
  name: z.string().min(1).max(64),
  slug: z.string().max(64).optional(),
});

const tagEditInput = z.object({
  tagId: z.string().uuid(),
  name: z.string().max(64).optional(),
  slug: z.string().max(64).optional(),
});

const slugFromText = (value: string, maxLength: number, fallback: string) => {
  const base = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  const trimmed = base.slice(0, maxLength);
  if (trimmed.length > 0) return trimmed;
  return `${fallback}-${Date.now().toString(36).slice(-6)}`.slice(0, maxLength);
};

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36).slice(0, 6);
};

const normalizeTagName = (value: string) =>
  value.trim().replace(/\s+/g, ' ').slice(0, 64);

const slugFromTagName = (value: string) => {
  const base = value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (base.length > 0) return base.slice(0, 64);
  return `tag-${hashString(value)}`.slice(0, 64);
};

const resolveTagInputs = async ({
  db,
  userId,
  tagIds,
  tagNames,
  isAdmin,
}: {
  db: typeof import('@/db').db;
  userId: string;
  tagIds?: string[];
  tagNames?: string[];
  isAdmin: boolean;
}) => {
  const uniqueIds = Array.from(new Set((tagIds ?? []).filter(Boolean)));
  if (uniqueIds.length > 0) {
    const validTags = await db
      .select({ id: tags.id })
      .from(tags)
      .where(inArray(tags.id, uniqueIds));
    if (validTags.length !== uniqueIds.length) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid tag selection.' });
    }
  }

  const normalizedNames = Array.from(
    new Set((tagNames ?? []).map(normalizeTagName).filter(Boolean).map((name) => name.toLowerCase()))
  ).map((lowerName) => {
    const original = (tagNames ?? []).find(
      (name) => normalizeTagName(name).toLowerCase() === lowerName
    );
    return normalizeTagName(original ?? lowerName);
  });

  const slugMap = new Map<string, string>();
  for (const name of normalizedNames) {
    const slug = slugFromTagName(name);
    if (!slugMap.has(slug)) {
      slugMap.set(slug, name);
    }
  }

  const slugs = Array.from(slugMap.keys());
  const existingTags =
    slugs.length > 0 || normalizedNames.length > 0
      ? await db
          .select({ id: tags.id, slug: tags.slug, name: tags.name })
          .from(tags)
          .where(
            slugs.length > 0 && normalizedNames.length > 0
              ? or(inArray(tags.slug, slugs), inArray(tags.name, normalizedNames))
              : slugs.length > 0
                ? inArray(tags.slug, slugs)
                : inArray(tags.name, normalizedNames)
          )
      : [];
  const existingBySlug = new Map(existingTags.map((tag) => [tag.slug, tag]));
  const existingByName = new Map(
    existingTags.map((tag) => [tag.name.toLowerCase(), tag])
  );

  const finalIds = new Set<string>(uniqueIds);
  const newTags: { name: string; slug: string }[] = [];

  for (const [slug, name] of slugMap) {
    const existing = existingBySlug.get(slug);
    if (existing) {
      finalIds.add(existing.id);
    } else {
      const existingName = existingByName.get(name.toLowerCase());
      if (existingName) {
        finalIds.add(existingName.id);
      } else {
        newTags.push({ name, slug });
      }
    }
  }

  if (newTags.length > 0) {
    if (isAdmin) {
      const created = await db
        .insert(tags)
        .values(
          newTags.map((tag) => ({
            name: tag.name,
            slug: tag.slug,
            createdBy: userId,
            approvedBy: userId,
          }))
        )
        .returning({ id: tags.id, slug: tags.slug });
      created.forEach((tag) => finalIds.add(tag.id));
    } else {
      const pending = await db
        .select({ slug: tagRequests.slug })
        .from(tagRequests)
        .where(and(inArray(tagRequests.slug, newTags.map((tag) => tag.slug)), eq(tagRequests.status, 'pending')));
      const pendingSlugs = new Set(pending.map((tag) => tag.slug));
      const toInsert = newTags.filter((tag) => !pendingSlugs.has(tag.slug));
      if (toInsert.length > 0) {
        await db.insert(tagRequests).values(
          toInsert.map((tag) => ({
            name: tag.name,
            slug: tag.slug,
            requestedBy: userId,
          }))
        );
      }
    }
  }

  return Array.from(finalIds);
};

const postRouter = router({
  listPublished: publicProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(posts)
      .where(eq(posts.status, 'published'))
      .orderBy(desc(posts.publishedAt));
  }),
  submit: protectedProcedure.input(postInput).mutation(async ({ ctx, input }) => {
    const isAdmin = ctx.profile?.role === 'admin';
    const rawSlug = input.slug?.trim() ?? '';
    const finalSlug =
      rawSlug.length > 0 ? rawSlug.slice(0, 256) : slugFromText(input.title, 256, 'post');
    const existing = await ctx.db
      .select({ id: posts.id })
      .from(posts)
      .where(eq(posts.slug, finalSlug))
      .limit(1);

    if (existing.length > 0) {
      throw new TRPCError({ code: 'CONFLICT', message: 'Slug already exists.' });
    }

    if (!ctx.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }
    const userId = ctx.user.id;
    const now = new Date();
    const [created] = await ctx.db
      .insert(posts)
      .values({
        authorId: userId,
        title: input.title,
        slug: finalSlug,
        excerpt: input.excerpt,
        content: input.content,
        status: isAdmin ? 'published' : 'pending',
        publishedAt: isAdmin ? now : null,
      })
      .returning();

    const resolvedTagIds = await resolveTagInputs({
      db: ctx.db,
      userId,
      tagIds: input.tagIds,
      tagNames: input.tagNames,
      isAdmin,
    });

    if (resolvedTagIds.length > 0) {
      await ctx.db.insert(postTags).values(
        resolvedTagIds.map((tagId) => ({
          postId: created.id,
          tagId,
        }))
      );
    }

    if (created.status === 'published') {
      await upsertAlgoliaPost(ctx.db, created.id);
    }

    return created;
  }),
  requestEdit: protectedProcedure
    .input(postEditInput)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select()
        .from(posts)
        .where(eq(posts.id, input.postId))
        .limit(1);

      if (existing.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Post not found.' });
      }

      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }
      const userId = ctx.user.id;
      const isAdmin = ctx.profile?.role === 'admin';
      if (!isAdmin && existing[0].authorId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your post.' });
      }

      if (isAdmin) {
        const updatePayload: Partial<typeof posts.$inferInsert> = {
          updatedAt: new Date(),
        };
        if (input.title) updatePayload.title = input.title;
        if (input.excerpt) updatePayload.excerpt = input.excerpt;
        if (input.content) updatePayload.content = input.content;
        await ctx.db.update(posts).set(updatePayload).where(eq(posts.id, input.postId));
        if (input.tagIds !== undefined || input.tagNames !== undefined) {
          const resolvedTagIds = await resolveTagInputs({
            db: ctx.db,
            userId,
            tagIds: input.tagIds,
            tagNames: input.tagNames,
            isAdmin: true,
          });
          await ctx.db.delete(postTags).where(eq(postTags.postId, input.postId));
          if (resolvedTagIds.length > 0) {
            await ctx.db.insert(postTags).values(
              resolvedTagIds.map((tagId) => ({
                postId: input.postId,
                tagId,
              }))
            );
          }
        }
        if (existing[0].status === 'published') {
          await upsertAlgoliaPost(ctx.db, input.postId);
        }
        return { status: 'applied' };
      }

      let resolvedTagIds: string[] | undefined = undefined;
      if (input.tagIds !== undefined || input.tagNames !== undefined) {
        resolvedTagIds = await resolveTagInputs({
          db: ctx.db,
          userId,
          tagIds: input.tagIds,
          tagNames: input.tagNames,
          isAdmin: false,
        });
      }

      const [revision] = await ctx.db
        .insert(postRevisions)
        .values({
          postId: input.postId,
          authorId: userId,
          title: input.title,
          excerpt: input.excerpt,
          content: input.content,
          tagIds: resolvedTagIds ?? undefined,
          tagNames: input.tagNames ?? undefined,
          status: 'pending',
        })
        .returning();

      return revision;
    }),
});

const commentRouter = router({
  submit: protectedProcedure
    .input(commentInput)
    .mutation(async ({ ctx, input }) => {
      const isAdmin = ctx.profile?.role === 'admin';
      const post = await ctx.db
        .select({ id: posts.id, status: posts.status })
        .from(posts)
        .where(eq(posts.id, input.postId))
        .limit(1);

      if (post.length === 0 || post[0].status !== 'published') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Post not available.' });
      }

      if (input.parentId) {
        const [parent] = await ctx.db
          .select({
            id: comments.id,
            postId: comments.postId,
            status: comments.status,
            authorId: comments.authorId,
          })
          .from(comments)
          .where(eq(comments.id, input.parentId))
          .limit(1);

        if (!parent || parent.postId !== input.postId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid parent.' });
        }

        if (
          !isAdmin &&
          parent.status !== 'approved' &&
          parent.authorId !== ctx.user.id
        ) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Cannot reply to this comment.',
          });
        }
      }

      const now = new Date();
      const [created] = await ctx.db
        .insert(comments)
        .values({
          postId: input.postId,
          authorId: ctx.user.id,
          body: input.body,
          parentId: input.parentId ?? null,
          status: isAdmin ? 'approved' : 'pending',
          approvedAt: isAdmin ? now : null,
        })
        .returning();

      return created;
    }),
  requestEdit: protectedProcedure
    .input(commentEditInput)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select()
        .from(comments)
        .where(eq(comments.id, input.commentId))
        .limit(1);

      if (existing.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Comment not found.' });
      }

      const isAdmin = ctx.profile?.role === 'admin';
      if (!isAdmin && existing[0].authorId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your comment.' });
      }

      if (isAdmin) {
        await ctx.db
          .update(comments)
          .set({ body: input.body, updatedAt: new Date() })
          .where(eq(comments.id, input.commentId));
        return { status: 'applied' };
      }

      const [revision] = await ctx.db
        .insert(commentRevisions)
        .values({
          commentId: input.commentId,
          authorId: ctx.user.id,
          body: input.body,
          status: 'pending',
        })
        .returning();

      return revision;
    }),
});

const tagRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(tags).orderBy(desc(tags.createdAt));
  }),
  requestNew: protectedProcedure
    .input(tagRequestInput)
    .mutation(async ({ ctx, input }) => {
      const isAdmin = ctx.profile?.role === 'admin';
      const rawSlug = input.slug?.trim() ?? '';
      const finalSlug =
        rawSlug.length > 0 ? rawSlug.slice(0, 64) : slugFromTagName(input.name);
      const existingTag = await ctx.db
        .select({ id: tags.id })
        .from(tags)
        .where(eq(tags.slug, finalSlug))
        .limit(1);

      if (existingTag.length > 0) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Tag already exists.' });
      }

      if (isAdmin) {
        const [createdTag] = await ctx.db
          .insert(tags)
          .values({
            name: input.name,
            slug: finalSlug,
            createdBy: ctx.user.id,
            approvedBy: ctx.user.id,
          })
          .returning();
        return createdTag;
      }

      const existingRequest = await ctx.db
        .select({ id: tagRequests.id })
        .from(tagRequests)
        .where(and(eq(tagRequests.slug, finalSlug), eq(tagRequests.status, 'pending')))
        .limit(1);

      if (existingRequest.length > 0) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Tag request already pending.' });
      }

      const [created] = await ctx.db
        .insert(tagRequests)
        .values({
          name: input.name,
          slug: finalSlug,
          requestedBy: ctx.user.id,
          status: 'pending',
        })
        .returning();

      return created;
    }),
  requestEdit: protectedProcedure
    .input(tagEditInput)
    .mutation(async ({ ctx, input }) => {
      const isAdmin = ctx.profile?.role === 'admin';
      const rawName = input.name?.trim() ?? '';
      const rawSlug = input.slug?.trim() ?? '';
      const hasName = rawName.length > 0;
      const hasSlug = rawSlug.length > 0;

      if (!hasName && !hasSlug) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Name or slug is required.',
        });
      }

      const [existingTag] = await ctx.db
        .select({ id: tags.id, name: tags.name, slug: tags.slug })
        .from(tags)
        .where(eq(tags.id, input.tagId))
        .limit(1);

      if (!existingTag) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Tag not found.' });
      }

      const nextName = hasName ? rawName.slice(0, 64) : existingTag.name;
      const nextSlug = hasSlug
        ? rawSlug.slice(0, 64)
        : hasName
          ? slugFromTagName(nextName)
          : existingTag.slug;

      if (nextSlug !== existingTag.slug) {
        const conflict = await ctx.db
          .select({ id: tags.id })
          .from(tags)
          .where(eq(tags.slug, nextSlug))
          .limit(1);
        if (conflict.length > 0) {
          throw new TRPCError({ code: 'CONFLICT', message: 'Slug already exists.' });
        }
      }

      if (isAdmin) {
        const [updated] = await ctx.db
          .update(tags)
          .set({ name: nextName, slug: nextSlug })
          .where(eq(tags.id, existingTag.id))
          .returning();
        return updated;
      }

      const [revision] = await ctx.db
        .insert(tagRevisions)
        .values({
          tagId: existingTag.id,
          authorId: ctx.user.id,
          name: nextName,
          slug: nextSlug,
          status: 'pending',
        })
        .returning();

      return revision;
    }),
});

const archiveRouter = router({
  listByDate: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: posts.id,
        title: posts.title,
        slug: posts.slug,
        publishedAt: posts.publishedAt,
      })
      .from(posts)
      .where(eq(posts.status, 'published'))
      .orderBy(desc(posts.publishedAt));

    const grouped: Record<string, typeof rows> = {};
    for (const row of rows) {
      const date = row.publishedAt ? new Date(row.publishedAt) : new Date();
      const key = date.toISOString().slice(0, 10); // YYYY-MM-DD
      grouped[key] = grouped[key] || [];
      grouped[key].push(row);
    }

    return grouped;
  }),
});

const adminRouter = router({
  listPendingPosts: adminProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(posts)
      .where(eq(posts.status, 'pending'))
      .orderBy(desc(posts.createdAt));
  }),
  approvePost: adminProcedure
    .input(z.object({ postId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      const [updated] = await ctx.db
        .update(posts)
        .set({ status: 'published', publishedAt: now, updatedAt: now })
        .where(eq(posts.id, input.postId))
        .returning();

      if (updated) {
        await upsertAlgoliaPost(ctx.db, updated.id);
      }
      return updated;
    }),
  rejectPost: adminProcedure
    .input(z.object({ postId: z.string().uuid(), note: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(posts)
        .set({ status: 'rejected' })
        .where(eq(posts.id, input.postId))
        .returning();

      await removeAlgoliaPost(input.postId);
      return updated;
    }),
  deletePost: adminProcedure
    .input(z.object({ postId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const commentIds = await ctx.db
        .select({ id: comments.id })
        .from(comments)
        .where(eq(comments.postId, input.postId));

      if (commentIds.length > 0) {
        await ctx.db
          .delete(commentRevisions)
          .where(inArray(commentRevisions.commentId, commentIds.map((c) => c.id)));
      }

      await ctx.db.delete(comments).where(eq(comments.postId, input.postId));
      await ctx.db.delete(postLikes).where(eq(postLikes.postId, input.postId));
      await ctx.db.delete(postTags).where(eq(postTags.postId, input.postId));
      await ctx.db.delete(postRevisions).where(eq(postRevisions.postId, input.postId));
      await ctx.db.delete(posts).where(eq(posts.id, input.postId));
      await removeAlgoliaPost(input.postId);
      return { ok: true };
    }),
  listPendingPostEdits: adminProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: postRevisions.id,
        postId: postRevisions.postId,
        title: postRevisions.title,
        excerpt: postRevisions.excerpt,
        content: postRevisions.content,
        tagNames: postRevisions.tagNames,
        createdAt: postRevisions.createdAt,
        status: postRevisions.status,
        slug: posts.slug,
        postTitle: posts.title,
      })
      .from(postRevisions)
      .innerJoin(posts, eq(postRevisions.postId, posts.id))
      .where(eq(postRevisions.status, 'pending'))
      .orderBy(desc(postRevisions.createdAt));
  }),
  approvePostEdit: adminProcedure
    .input(z.object({ revisionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const revision = await ctx.db
        .select()
        .from(postRevisions)
        .where(eq(postRevisions.id, input.revisionId))
        .limit(1);

      if (revision.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Revision not found.' });
      }

      const patch = revision[0];
      const now = new Date();
      const updatePayload: Partial<typeof posts.$inferInsert> = {
        updatedAt: now,
      };
      if (patch.title) updatePayload.title = patch.title;
      if (patch.excerpt) updatePayload.excerpt = patch.excerpt;
      if (patch.content) updatePayload.content = patch.content;

      await ctx.db
        .update(posts)
        .set(updatePayload)
        .where(eq(posts.id, patch.postId));

      if (patch.tagIds !== undefined || patch.tagNames !== undefined) {
        if (!ctx.user) {
          throw new TRPCError({ code: 'UNAUTHORIZED' });
        }
        const resolvedTagIds = await resolveTagInputs({
          db: ctx.db,
          userId: ctx.user.id,
          tagIds: patch.tagIds ?? undefined,
          tagNames: patch.tagNames ?? undefined,
          isAdmin: true,
        });
        await ctx.db.delete(postTags).where(eq(postTags.postId, patch.postId));
        if (resolvedTagIds.length > 0) {
          await ctx.db.insert(postTags).values(
            resolvedTagIds.map((tagId) => ({
              postId: patch.postId,
              tagId,
            }))
          );
        }
      }

      await upsertAlgoliaPost(ctx.db, patch.postId);

      const [updated] = await ctx.db
        .update(postRevisions)
        .set({
          status: 'approved',
          reviewedAt: now,
          reviewedBy: ctx.user.id,
        })
        .where(eq(postRevisions.id, input.revisionId))
        .returning();

      return updated;
    }),
  rejectPostEdit: adminProcedure
    .input(z.object({ revisionId: z.string().uuid(), note: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(postRevisions)
        .set({
          status: 'rejected',
          reviewedAt: new Date(),
          reviewedBy: ctx.user.id,
          reviewerNote: input.note,
        })
        .where(eq(postRevisions.id, input.revisionId))
        .returning();

      return updated;
    }),
  listPendingComments: adminProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(comments)
      .where(eq(comments.status, 'pending'))
      .orderBy(desc(comments.createdAt));
  }),
  approveComment: adminProcedure
    .input(z.object({ commentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(comments)
        .set({
          status: 'approved',
          approvedAt: new Date(),
          reviewedBy: ctx.user.id,
        })
        .where(eq(comments.id, input.commentId))
        .returning();
      return updated;
    }),
  rejectComment: adminProcedure
    .input(z.object({ commentId: z.string().uuid(), note: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(comments)
        .set({
          status: 'rejected',
          reviewedBy: ctx.user.id,
        })
        .where(eq(comments.id, input.commentId))
        .returning();
      return updated;
    }),
  listPendingCommentEdits: adminProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(commentRevisions)
      .where(eq(commentRevisions.status, 'pending'))
      .orderBy(desc(commentRevisions.createdAt));
  }),
  approveCommentEdit: adminProcedure
    .input(z.object({ revisionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const revision = await ctx.db
        .select()
        .from(commentRevisions)
        .where(eq(commentRevisions.id, input.revisionId))
        .limit(1);

      if (revision.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Revision not found.' });
      }

      const patch = revision[0];
      const now = new Date();

      await ctx.db
        .update(comments)
        .set({ body: patch.body, updatedAt: now })
        .where(eq(comments.id, patch.commentId));

      const [updated] = await ctx.db
        .update(commentRevisions)
        .set({ status: 'approved', reviewedAt: now, reviewedBy: ctx.user.id })
        .where(eq(commentRevisions.id, input.revisionId))
        .returning();

      return updated;
    }),
  rejectCommentEdit: adminProcedure
    .input(z.object({ revisionId: z.string().uuid(), note: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(commentRevisions)
        .set({
          status: 'rejected',
          reviewedAt: new Date(),
          reviewedBy: ctx.user.id,
          reviewerNote: input.note,
        })
        .where(eq(commentRevisions.id, input.revisionId))
        .returning();
      return updated;
    }),
  editComment: adminProcedure
    .input(z.object({ commentId: z.string().uuid(), body: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(comments)
        .set({ body: input.body, updatedAt: new Date(), reviewedBy: ctx.user.id })
        .where(eq(comments.id, input.commentId))
        .returning();
      return updated;
    }),
  deleteComment: adminProcedure
    .input(z.object({ commentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(commentRevisions).where(eq(commentRevisions.commentId, input.commentId));
      await ctx.db.delete(comments).where(eq(comments.id, input.commentId));
      return { ok: true };
    }),
  listTagRequests: adminProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(tagRequests)
      .where(eq(tagRequests.status, 'pending'))
      .orderBy(desc(tagRequests.createdAt));
  }),
  listTagEdits: adminProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: tagRevisions.id,
        tagId: tagRevisions.tagId,
        name: tagRevisions.name,
        slug: tagRevisions.slug,
        createdAt: tagRevisions.createdAt,
        currentName: tags.name,
        currentSlug: tags.slug,
      })
      .from(tagRevisions)
      .innerJoin(tags, eq(tagRevisions.tagId, tags.id))
      .where(eq(tagRevisions.status, 'pending'))
      .orderBy(desc(tagRevisions.createdAt));
  }),
  approveTagRequest: adminProcedure
    .input(z.object({ requestId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.db
        .select()
        .from(tagRequests)
        .where(eq(tagRequests.id, input.requestId))
        .limit(1);

      if (request.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Request not found.' });
      }

      const payload = request[0];
      await ctx.db.insert(tags).values({
        name: payload.name,
        slug: payload.slug,
        createdBy: payload.requestedBy,
        approvedBy: ctx.user.id,
      });

      const [updated] = await ctx.db
        .update(tagRequests)
        .set({
          status: 'approved',
          reviewedAt: new Date(),
          reviewedBy: ctx.user.id,
        })
        .where(eq(tagRequests.id, input.requestId))
        .returning();

      return updated;
    }),
  approveTagEdit: adminProcedure
    .input(z.object({ revisionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [revision] = await ctx.db
        .select()
        .from(tagRevisions)
        .where(eq(tagRevisions.id, input.revisionId))
        .limit(1);

      if (!revision) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Tag revision not found.' });
      }

      const [updatedTag] = await ctx.db
        .update(tags)
        .set({ name: revision.name, slug: revision.slug })
        .where(eq(tags.id, revision.tagId))
        .returning();

      await ctx.db
        .update(tagRevisions)
        .set({
          status: 'approved',
          reviewedAt: new Date(),
          reviewedBy: ctx.user.id,
        })
        .where(eq(tagRevisions.id, revision.id));

      return updatedTag;
    }),
  rejectTagRequest: adminProcedure
    .input(z.object({ requestId: z.string().uuid(), note: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(tagRequests)
        .set({
          status: 'rejected',
          reviewedAt: new Date(),
          reviewedBy: ctx.user.id,
          reviewerNote: input.note,
        })
        .where(eq(tagRequests.id, input.requestId))
        .returning();

      return updated;
    }),
  rejectTagEdit: adminProcedure
    .input(z.object({ revisionId: z.string().uuid(), note: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(tagRevisions)
        .set({
          status: 'rejected',
          reviewedAt: new Date(),
          reviewedBy: ctx.user.id,
          reviewerNote: input.note,
        })
        .where(eq(tagRevisions.id, input.revisionId));
    }),
  deleteTag: adminProcedure
    .input(z.object({ tagId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(postTags).where(eq(postTags.tagId, input.tagId));
      await ctx.db.delete(tagRevisions).where(eq(tagRevisions.tagId, input.tagId));
      await ctx.db.delete(tags).where(eq(tags.id, input.tagId));
      return { ok: true };
    }),
});

export const appRouter = router({
  auth: router({
    session: publicProcedure.query(({ ctx }) => ctx.session),
  }),
  posts: postRouter,
  comments: commentRouter,
  tags: tagRouter,
  archive: archiveRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
