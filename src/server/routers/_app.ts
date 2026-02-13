import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { and, desc, eq, gte, inArray, isNull, or, sql } from 'drizzle-orm';
import {
  comments,
  commentRevisions,
  postRevisions,
  posts,
  postLikes,
  postTags,
  siteSettings,
  tagRequests,
  tagRevisions,
  tags,
} from '@/db/schema';
import {
  removeAlgoliaPost,
  removeAlgoliaTag,
  upsertAlgoliaPost,
  upsertAlgoliaTag,
} from '@/lib/algolia';
import { resolvePostExcerpt } from '@/lib/excerpt';
import { generateTagSlug, normalizeUserSlug } from '@/lib/tag-slug';
import { adminProcedure, protectedProcedure, publicProcedure, router } from '@/server/trpc';

const postInput = z.object({
  title: z.string().min(1).max(256),
  slug: z.string().max(256).optional(),
  excerpt: z.string().max(500).optional(),
  content: z.string().optional(),
  tagIds: z.array(z.string().uuid()).optional(),
  tagNames: z.array(z.string().min(1).max(64)).optional(),
  idempotencyKey: z.string().uuid(),
});

const postEditInput = z
  .object({
    postId: z.string().uuid(),
    title: z.string().min(1).max(256).optional(),
    excerpt: z.string().max(500).nullable().optional(),
    content: z.string().min(1).optional(),
    tagIds: z.array(z.string().uuid()).optional(),
    tagNames: z.array(z.string().min(1).max(64)).optional(),
    idempotencyKey: z.string().uuid(),
  })
  .refine(
    (data) =>
      data.title !== undefined ||
      data.excerpt !== undefined ||
      data.content !== undefined ||
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
  idempotencyKey: z.string().uuid(),
});

const commentEditInput = z.object({
  commentId: z.string().uuid(),
  body: z.string().min(1).max(2000),
  idempotencyKey: z.string().uuid(),
});

const tagRequestInput = z.object({
  name: z.string().min(1).max(64),
  slug: z.string().max(64).optional(),
  idempotencyKey: z.string().uuid(),
});

const tagEditInput = z.object({
  tagId: z.string().uuid(),
  name: z.string().max(64).optional(),
  slug: z.string().max(64).optional(),
  idempotencyKey: z.string().uuid(),
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

const normalizeTagName = (value: string) =>
  value.trim().replace(/\s+/g, ' ').slice(0, 64);

const MAX_SETTINGS_CODE_SIZE = 50000;
const isValidFaviconUrl = (value: string) =>
  value.startsWith('/') || value.startsWith('http://') || value.startsWith('https://');
const normalizeOptionalText = (value?: string | null) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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
    const slug = await generateTagSlug(name);
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
      await db
        .update(tagRequests)
        .set({
          status: 'approved',
          reviewedAt: new Date(),
          reviewedBy: userId,
        })
        .where(inArray(tagRequests.slug, newTags.map((tag) => tag.slug)));
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

  const pendingTagSlugs = isAdmin
    ? []
    : Array.from(new Set(newTags.map((tag) => tag.slug)));

  return { resolvedTagIds: Array.from(finalIds), pendingTagSlugs };
};

const resolveApprovedTags = async ({
  db,
  tagIds,
  tagNames,
}: {
  db: typeof import('@/db').db;
  tagIds?: string[];
  tagNames?: string[];
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
    const slug = await generateTagSlug(name);
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

  const approvedIds = new Set<string>(uniqueIds);
  const pendingSlugs: string[] = [];

  for (const [slug, name] of slugMap) {
    const existing = existingBySlug.get(slug);
    if (existing) {
      approvedIds.add(existing.id);
    } else {
      const existingName = existingByName.get(name.toLowerCase());
      if (existingName) {
        approvedIds.add(existingName.id);
      } else {
        pendingSlugs.push(slug);
      }
    }
  }

  return {
    approvedTagIds: Array.from(approvedIds),
    pendingTagSlugs: Array.from(new Set(pendingSlugs)),
  };
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
    if (!ctx.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }
    const userId = ctx.user.id;

    const normalizedInputExcerpt = input.excerpt?.trim() || null;
    const normalizedInputContent = input.content?.trim() || null;
    const existingByKey = await ctx.db
      .select()
      .from(posts)
      .where(and(eq(posts.authorId, userId), eq(posts.idempotencyKey, input.idempotencyKey)))
      .limit(1);
    if (existingByKey.length > 0) {
      return existingByKey[0];
    }

    const dedupeSince = new Date(Date.now() - 10 * 60 * 1000);
    const duplicatePost = await ctx.db
      .select()
      .from(posts)
      .where(
        and(
          eq(posts.authorId, userId),
          eq(posts.title, input.title),
          sql`coalesce(${posts.excerpt}, '') = ${normalizedInputExcerpt ?? ''}`,
          sql`coalesce(${posts.content}, '') = ${normalizedInputContent ?? ''}`,
          gte(posts.createdAt, dedupeSince)
        )
      )
      .orderBy(desc(posts.createdAt))
      .limit(1);
    if (duplicatePost.length > 0) {
      return duplicatePost[0];
    }

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

    const now = new Date();
    const { resolvedTagIds, pendingTagSlugs } = await resolveTagInputs({
      db: ctx.db,
      userId,
      tagIds: input.tagIds,
      tagNames: input.tagNames,
      isAdmin,
    });
    const resolvedExcerpt = await resolvePostExcerpt({
      title: input.title,
      content: normalizedInputContent,
      excerpt: normalizedInputExcerpt,
    });

    const inserted = await ctx.db
      .insert(posts)
      .values({
        authorId: userId,
        title: input.title,
        slug: finalSlug,
        idempotencyKey: input.idempotencyKey,
        excerpt: resolvedExcerpt,
        content: normalizedInputContent,
        pendingTagSlugs: pendingTagSlugs.length > 0 ? pendingTagSlugs : null,
        status: isAdmin ? 'published' : 'pending',
        publishedAt: isAdmin ? now : null,
      })
      .onConflictDoNothing({
        target: [posts.authorId, posts.idempotencyKey],
      })
      .returning();

    const created = inserted[0];
    if (!created) {
      const [existingPost] = await ctx.db
        .select()
        .from(posts)
        .where(
          and(
            eq(posts.authorId, userId),
            eq(posts.idempotencyKey, input.idempotencyKey)
          )
        )
        .limit(1);
      if (existingPost) {
        return existingPost;
      }
      throw new TRPCError({ code: 'CONFLICT', message: 'Duplicate submission detected.' });
    }

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
      const normalizedEditExcerpt =
        input.excerpt === undefined
          ? undefined
          : input.excerpt === null
            ? null
            : input.excerpt.trim();
      const normalizedEditContent =
        input.content === undefined ? undefined : input.content.trim();

      if (!isAdmin && existing[0].authorId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your post.' });
      }

      if (!isAdmin) {
        const existingRevisionByKey = await ctx.db
          .select()
          .from(postRevisions)
          .where(
            and(
              eq(postRevisions.authorId, userId),
              eq(postRevisions.idempotencyKey, input.idempotencyKey)
            )
          )
          .limit(1);
        if (existingRevisionByKey.length > 0) {
          return existingRevisionByKey[0];
        }
      }

      if (isAdmin) {
        const nextTitle = input.title ?? existing[0].title;
        const nextContent = normalizedEditContent ?? existing[0].content ?? null;
        const nextExcerpt = await resolvePostExcerpt({
          title: nextTitle,
          content: nextContent,
          excerpt:
            normalizedEditExcerpt === undefined
              ? existing[0].excerpt
              : normalizedEditExcerpt,
        });
        const updatePayload: Partial<typeof posts.$inferInsert> = {
          updatedAt: new Date(),
          excerpt: nextExcerpt ?? null,
        };
        if (input.title) updatePayload.title = input.title;
        if (normalizedEditContent !== undefined) updatePayload.content = normalizedEditContent;
        await ctx.db.update(posts).set(updatePayload).where(eq(posts.id, input.postId));
        if (input.tagIds !== undefined || input.tagNames !== undefined) {
          const { resolvedTagIds } = await resolveTagInputs({
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
      let revisionExcerpt: string | null | undefined = undefined;
      if (input.tagIds !== undefined || input.tagNames !== undefined) {
        resolvedTagIds = (await resolveTagInputs({
          db: ctx.db,
          userId,
          tagIds: input.tagIds,
          tagNames: input.tagNames,
          isAdmin: false,
        })).resolvedTagIds;
      }
      if (normalizedEditExcerpt !== undefined || !existing[0].excerpt) {
        revisionExcerpt =
          (await resolvePostExcerpt({
            title: input.title ?? existing[0].title,
            content: normalizedEditContent ?? existing[0].content ?? null,
            excerpt: normalizedEditExcerpt,
          })) ?? null;
      }
      const effectiveRevisionExcerpt =
        revisionExcerpt === undefined ? existing[0].excerpt ?? null : revisionExcerpt;

      const dedupeSince = new Date(Date.now() - 10 * 60 * 1000);
      const duplicateRevision = await ctx.db
        .select()
        .from(postRevisions)
        .where(
          and(
            eq(postRevisions.authorId, userId),
            eq(postRevisions.postId, input.postId),
            eq(postRevisions.status, 'pending'),
            gte(postRevisions.createdAt, dedupeSince),
            sql`coalesce(${postRevisions.title}, '') = ${input.title ?? ''}`,
            sql`coalesce(${postRevisions.excerpt}, '') = ${effectiveRevisionExcerpt ?? ''}`,
            sql`coalesce(${postRevisions.content}, '') = ${normalizedEditContent ?? ''}`,
            sql`coalesce(${postRevisions.tagNames}, 'null'::jsonb) = ${JSON.stringify(
              input.tagNames ?? null
            )}::jsonb`,
            sql`coalesce(${postRevisions.tagIds}, 'null'::jsonb) = ${JSON.stringify(
              resolvedTagIds ?? null
            )}::jsonb`
          )
        )
        .orderBy(desc(postRevisions.createdAt))
        .limit(1);
      if (duplicateRevision.length > 0) {
        return duplicateRevision[0];
      }

      const inserted = await ctx.db
        .insert(postRevisions)
        .values({
          postId: input.postId,
          authorId: userId,
          idempotencyKey: input.idempotencyKey,
          title: input.title,
          excerpt: effectiveRevisionExcerpt,
          content: normalizedEditContent,
          tagIds: resolvedTagIds ?? undefined,
          tagNames: input.tagNames ?? undefined,
          status: 'pending',
        })
        .onConflictDoNothing({
          target: [postRevisions.authorId, postRevisions.idempotencyKey],
        })
        .returning();

      const revision = inserted[0];
      if (!revision) {
        const [existingRevision] = await ctx.db
          .select()
          .from(postRevisions)
          .where(
            and(
              eq(postRevisions.authorId, userId),
              eq(postRevisions.idempotencyKey, input.idempotencyKey)
            )
          )
          .limit(1);
        if (existingRevision) {
          return existingRevision;
        }
        throw new TRPCError({ code: 'CONFLICT', message: 'Duplicate update detected.' });
      }

      return revision;
    }),
});

const commentRouter = router({
  submit: protectedProcedure
    .input(commentInput)
    .mutation(async ({ ctx, input }) => {
      const isAdmin = ctx.profile?.role === 'admin';

      const existingByKey = await ctx.db
        .select()
        .from(comments)
        .where(
          and(
            eq(comments.authorId, ctx.user.id),
            eq(comments.idempotencyKey, input.idempotencyKey)
          )
        )
        .limit(1);
      if (existingByKey.length > 0) {
        return existingByKey[0];
      }

      const dedupeSince = new Date(Date.now() - 5 * 60 * 1000);
      const duplicateComment = await ctx.db
        .select()
        .from(comments)
        .where(
          and(
            eq(comments.authorId, ctx.user.id),
            eq(comments.postId, input.postId),
            eq(comments.body, input.body),
            input.parentId
              ? eq(comments.parentId, input.parentId)
              : isNull(comments.parentId),
            gte(comments.createdAt, dedupeSince)
          )
        )
        .orderBy(desc(comments.createdAt))
        .limit(1);
      if (duplicateComment.length > 0) {
        return duplicateComment[0];
      }

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
      const inserted = await ctx.db
        .insert(comments)
        .values({
          postId: input.postId,
          authorId: ctx.user.id,
          idempotencyKey: input.idempotencyKey,
          body: input.body,
          parentId: input.parentId ?? null,
          status: isAdmin ? 'approved' : 'pending',
          approvedAt: isAdmin ? now : null,
        })
        .onConflictDoNothing({
          target: [comments.authorId, comments.idempotencyKey],
        })
        .returning();

      const created = inserted[0];
      if (!created) {
        const [existingComment] = await ctx.db
          .select()
          .from(comments)
          .where(
            and(
              eq(comments.authorId, ctx.user.id),
              eq(comments.idempotencyKey, input.idempotencyKey)
            )
          )
          .limit(1);
        if (existingComment) {
          return existingComment;
        }
        throw new TRPCError({ code: 'CONFLICT', message: 'Duplicate comment detected.' });
      }

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

      if (!isAdmin) {
        const existingRevisionByKey = await ctx.db
          .select()
          .from(commentRevisions)
          .where(
            and(
              eq(commentRevisions.authorId, ctx.user.id),
              eq(commentRevisions.idempotencyKey, input.idempotencyKey)
            )
          )
          .limit(1);
        if (existingRevisionByKey.length > 0) {
          return existingRevisionByKey[0];
        }
      }

      if (isAdmin) {
        await ctx.db
          .update(comments)
          .set({ body: input.body, updatedAt: new Date() })
          .where(eq(comments.id, input.commentId));
        return { status: 'applied' };
      }

      const dedupeSince = new Date(Date.now() - 10 * 60 * 1000);
      const duplicateRevision = await ctx.db
        .select()
        .from(commentRevisions)
        .where(
          and(
            eq(commentRevisions.authorId, ctx.user.id),
            eq(commentRevisions.commentId, input.commentId),
            eq(commentRevisions.status, 'pending'),
            eq(commentRevisions.body, input.body),
            gte(commentRevisions.createdAt, dedupeSince)
          )
        )
        .orderBy(desc(commentRevisions.createdAt))
        .limit(1);
      if (duplicateRevision.length > 0) {
        return duplicateRevision[0];
      }

      const inserted = await ctx.db
        .insert(commentRevisions)
        .values({
          commentId: input.commentId,
          authorId: ctx.user.id,
          idempotencyKey: input.idempotencyKey,
          body: input.body,
          status: 'pending',
        })
        .onConflictDoNothing({
          target: [commentRevisions.authorId, commentRevisions.idempotencyKey],
        })
        .returning();

      const revision = inserted[0];
      if (!revision) {
        const [existingRevision] = await ctx.db
          .select()
          .from(commentRevisions)
          .where(
            and(
              eq(commentRevisions.authorId, ctx.user.id),
              eq(commentRevisions.idempotencyKey, input.idempotencyKey)
            )
          )
          .limit(1);
        if (existingRevision) {
          return existingRevision;
        }
        throw new TRPCError({ code: 'CONFLICT', message: 'Duplicate edit detected.' });
      }

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
      const normalizedSlug = rawSlug.length > 0 ? normalizeUserSlug(rawSlug) : '';
      if (normalizedSlug === null) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Slug can only contain lowercase letters and numbers.',
        });
      }
      const finalSlug =
        normalizedSlug.length > 0 ? normalizedSlug : await generateTagSlug(input.name);

      const existingByKey = await ctx.db
        .select()
        .from(tagRequests)
        .where(
          and(
            eq(tagRequests.requestedBy, ctx.user.id),
            eq(tagRequests.idempotencyKey, input.idempotencyKey)
          )
        )
        .limit(1);
      if (existingByKey.length > 0) {
        return existingByKey[0];
      }

      const existingTag = await ctx.db
        .select()
        .from(tags)
        .where(eq(tags.slug, finalSlug))
        .limit(1);

      if (existingTag.length > 0) {
        if (isAdmin) {
          return existingTag[0];
        }
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
        if (createdTag) {
          try {
            await upsertAlgoliaTag(ctx.db, createdTag.id);
          } catch (error) {
            console.warn('tag sync failed', createdTag.id, error);
          }
        }
        return createdTag;
      }

      const existingRequest = await ctx.db
        .select()
        .from(tagRequests)
        .where(
          and(
            eq(tagRequests.slug, finalSlug),
            eq(tagRequests.status, 'pending'),
            eq(tagRequests.requestedBy, ctx.user.id)
          )
        )
        .limit(1);

      if (existingRequest.length > 0) {
        return existingRequest[0];
      }

      const pendingOther = await ctx.db
        .select({ id: tagRequests.id })
        .from(tagRequests)
        .where(and(eq(tagRequests.slug, finalSlug), eq(tagRequests.status, 'pending')))
        .limit(1);
      if (pendingOther.length > 0) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Tag request already pending.' });
      }

      const inserted = await ctx.db
        .insert(tagRequests)
        .values({
          name: input.name,
          slug: finalSlug,
          requestedBy: ctx.user.id,
          status: 'pending',
          idempotencyKey: input.idempotencyKey,
        })
        .onConflictDoNothing({
          target: [tagRequests.requestedBy, tagRequests.idempotencyKey],
        })
        .returning();

      const created = inserted[0];
      if (!created) {
        const [existingRequest] = await ctx.db
          .select()
          .from(tagRequests)
          .where(
            and(
              eq(tagRequests.requestedBy, ctx.user.id),
              eq(tagRequests.idempotencyKey, input.idempotencyKey)
            )
          )
          .limit(1);
        if (existingRequest) {
          return existingRequest;
        }
        throw new TRPCError({ code: 'CONFLICT', message: 'Duplicate request detected.' });
      }

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
      const normalizedSlug = hasSlug ? normalizeUserSlug(rawSlug) : '';

      if (!hasName && !hasSlug) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Name or slug is required.',
        });
      }
      if (normalizedSlug === null) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Slug can only contain lowercase letters and numbers.',
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
        ? normalizedSlug
        : hasName
          ? await generateTagSlug(nextName)
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
        if (updated) {
          try {
            await upsertAlgoliaTag(ctx.db, updated.id);
          } catch (error) {
            console.warn('tag sync failed', updated.id, error);
          }
        }
        return updated;
      }

      const existingRevisionByKey = await ctx.db
        .select()
        .from(tagRevisions)
        .where(
          and(
            eq(tagRevisions.authorId, ctx.user.id),
            eq(tagRevisions.idempotencyKey, input.idempotencyKey)
          )
        )
        .limit(1);
      if (existingRevisionByKey.length > 0) {
        return existingRevisionByKey[0];
      }

      const dedupeSince = new Date(Date.now() - 10 * 60 * 1000);
      const duplicateRevision = await ctx.db
        .select()
        .from(tagRevisions)
        .where(
          and(
            eq(tagRevisions.authorId, ctx.user.id),
            eq(tagRevisions.tagId, existingTag.id),
            eq(tagRevisions.status, 'pending'),
            eq(tagRevisions.name, nextName),
            eq(tagRevisions.slug, nextSlug),
            gte(tagRevisions.createdAt, dedupeSince)
          )
        )
        .orderBy(desc(tagRevisions.createdAt))
        .limit(1);
      if (duplicateRevision.length > 0) {
        return duplicateRevision[0];
      }

      const inserted = await ctx.db
        .insert(tagRevisions)
        .values({
          tagId: existingTag.id,
          authorId: ctx.user.id,
          idempotencyKey: input.idempotencyKey,
          name: nextName,
          slug: nextSlug,
          status: 'pending',
        })
        .onConflictDoNothing({
          target: [tagRevisions.authorId, tagRevisions.idempotencyKey],
        })
        .returning();

      const revision = inserted[0];
      if (!revision) {
        const [existingRevision] = await ctx.db
          .select()
          .from(tagRevisions)
          .where(
            and(
              eq(tagRevisions.authorId, ctx.user.id),
              eq(tagRevisions.idempotencyKey, input.idempotencyKey)
            )
          )
          .limit(1);
        if (existingRevision) {
          return existingRevision;
        }
        throw new TRPCError({ code: 'CONFLICT', message: 'Duplicate request detected.' });
      }

      return revision;
    }),
  deleteRequest: protectedProcedure
    .input(z.object({ requestId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [request] = await ctx.db
        .select({
          id: tagRequests.id,
          name: tagRequests.name,
          slug: tagRequests.slug,
          status: tagRequests.status,
          requestedBy: tagRequests.requestedBy,
        })
        .from(tagRequests)
        .where(eq(tagRequests.id, input.requestId))
        .limit(1);

      if (!request) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Request not found.' });
      }

      if (!ctx.user || request.requestedBy !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your request.' });
      }

      await ctx.db.delete(tagRequests).where(eq(tagRequests.id, request.id));

      if (request.status !== 'approved') {
        await ctx.db.execute(sql`
          UPDATE ${posts}
          SET pending_tag_slugs = (
            SELECT CASE
              WHEN COUNT(*) = 0 THEN NULL
              ELSE jsonb_agg(value)
            END
            FROM jsonb_array_elements_text(${posts.pendingTagSlugs}) value
            WHERE value <> ${request.slug}
          )
          WHERE author_id = ${request.requestedBy}
            AND pending_tag_slugs @> ${JSON.stringify([request.slug])}::jsonb
        `);

        await ctx.db.execute(sql`
          UPDATE ${postRevisions}
          SET tag_names = (
            SELECT CASE
              WHEN COUNT(*) = 0 THEN NULL
              ELSE jsonb_agg(value)
            END
            FROM jsonb_array_elements_text(${postRevisions.tagNames}) value
            WHERE value <> ${request.name}
          )
          WHERE author_id = ${request.requestedBy}
            AND status = 'pending'
            AND tag_names @> ${JSON.stringify([request.name])}::jsonb
        `);
      }

      return { ok: true };
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
        .returning({
          id: posts.id,
          pendingTagSlugs: posts.pendingTagSlugs,
        });

      if (updated) {
        const pendingTagSlugs = (updated.pendingTagSlugs ?? []) as string[];
        if (pendingTagSlugs.length > 0) {
          const approved = await ctx.db
            .select({ id: tags.id, slug: tags.slug })
            .from(tags)
            .where(inArray(tags.slug, pendingTagSlugs));

          if (approved.length > 0) {
            await ctx.db.insert(postTags).values(
              approved.map((tag) => ({
                postId: updated.id,
                tagId: tag.id,
              }))
            );
            const approvedSlugs = new Set(approved.map((tag) => tag.slug));
            const remaining = pendingTagSlugs.filter(
              (slug) => !approvedSlugs.has(slug)
            );
            await ctx.db
              .update(posts)
              .set({
                pendingTagSlugs: remaining.length > 0 ? remaining : null,
              })
              .where(eq(posts.id, updated.id));
          }
        }

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
        tagIds: postRevisions.tagIds,
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
      const currentPost = await ctx.db
        .select({
          title: posts.title,
          excerpt: posts.excerpt,
          content: posts.content,
        })
        .from(posts)
        .where(eq(posts.id, patch.postId))
        .limit(1);

      if (currentPost.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Post not found.' });
      }

      const nextTitle = patch.title ?? currentPost[0].title;
      const nextContent = patch.content ?? currentPost[0].content;
      const requestedExcerpt = patch.excerpt;
      const nextExcerpt = await resolvePostExcerpt({
        title: nextTitle,
        content: nextContent,
        excerpt: requestedExcerpt,
      });
      const now = new Date();
      const updatePayload: Partial<typeof posts.$inferInsert> = {
        updatedAt: now,
        excerpt: nextExcerpt ?? null,
      };
      if (patch.title) updatePayload.title = patch.title;
      if (patch.content) updatePayload.content = patch.content;

      await ctx.db
        .update(posts)
        .set(updatePayload)
        .where(eq(posts.id, patch.postId));

      if (patch.tagIds !== undefined || patch.tagNames !== undefined) {
        const { approvedTagIds, pendingTagSlugs } = await resolveApprovedTags({
          db: ctx.db,
          tagIds: patch.tagIds ?? undefined,
          tagNames: patch.tagNames ?? undefined,
        });

        await ctx.db.delete(postTags).where(eq(postTags.postId, patch.postId));
        if (approvedTagIds.length > 0) {
          await ctx.db.insert(postTags).values(
            approvedTagIds.map((tagId) => ({
              postId: patch.postId,
              tagId,
            }))
          );
        }
        await ctx.db
          .update(posts)
          .set({
            pendingTagSlugs: pendingTagSlugs.length > 0 ? pendingTagSlugs : null,
            updatedAt: now,
          })
          .where(eq(posts.id, patch.postId));
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
      const [createdTag] = await ctx.db
        .insert(tags)
        .values({
          name: payload.name,
          slug: payload.slug,
          createdBy: payload.requestedBy,
          approvedBy: ctx.user.id,
        })
        .returning({ id: tags.id, slug: tags.slug });

      if (createdTag) {
        const slug = createdTag.slug;
        const pendingPosts = await ctx.db.execute(sql`
          SELECT id
          FROM ${posts}
          WHERE pending_tag_slugs @> ${JSON.stringify([slug])}::jsonb
        `);
        const postIds = (pendingPosts.rows ?? []).map((row) =>
          String(row.id)
        );
        if (postIds.length > 0) {
          await ctx.db
            .insert(postTags)
            .values(
              postIds.map((postId) => ({
                postId,
                tagId: createdTag.id,
              }))
            )
            .onConflictDoNothing();

          await ctx.db.execute(sql`
            UPDATE ${posts}
            SET pending_tag_slugs = (
              SELECT CASE
                WHEN COUNT(*) = 0 THEN NULL
                ELSE jsonb_agg(value)
              END
              FROM jsonb_array_elements_text(${posts.pendingTagSlugs}) value
              WHERE value <> ${slug}
            )
            WHERE pending_tag_slugs @> ${JSON.stringify([slug])}::jsonb
          `);
        }
        try {
          await upsertAlgoliaTag(ctx.db, createdTag.id);
        } catch (error) {
          console.warn('tag sync failed', createdTag.id, error);
        }
      }

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
      if (updatedTag) {
        try {
          await upsertAlgoliaTag(ctx.db, updatedTag.id);
        } catch (error) {
          console.warn('tag sync failed', updatedTag.id, error);
        }
      }

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
      await removeAlgoliaTag(input.tagId);
      return { ok: true };
    }),
  deleteTags: adminProcedure
    .input(
      z.object({
        tagIds: z.array(z.string().uuid()).min(1).max(200),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const uniqueTagIds = Array.from(new Set(input.tagIds));
      const existing = await ctx.db
        .select({ id: tags.id })
        .from(tags)
        .where(inArray(tags.id, uniqueTagIds));
      const existingIds = existing.map((item) => item.id);
      if (existingIds.length === 0) {
        return { ok: true, deleted: 0 };
      }

      await ctx.db.delete(postTags).where(inArray(postTags.tagId, existingIds));
      await ctx.db.delete(tagRevisions).where(inArray(tagRevisions.tagId, existingIds));
      await ctx.db.delete(tags).where(inArray(tags.id, existingIds));

      const syncResults = await Promise.allSettled(
        existingIds.map((id) => removeAlgoliaTag(id))
      );
      syncResults.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.warn('tag delete sync failed', existingIds[index], result.reason);
        }
      });

      return { ok: true, deleted: existingIds.length };
    }),
  getSiteSettings: adminProcedure.query(async ({ ctx }) => {
    const [row] = await ctx.db
      .select({
        faviconUrl: siteSettings.faviconUrl,
        customCss: siteSettings.customCss,
        customJs: siteSettings.customJs,
        customHtml: siteSettings.customHtml,
      })
      .from(siteSettings)
      .where(eq(siteSettings.id, 1))
      .limit(1);

    return {
      faviconUrl: row?.faviconUrl ?? null,
      customCss: row?.customCss ?? '',
      customJs: row?.customJs ?? '',
      customHtml: row?.customHtml ?? '',
    };
  }),
  updateSiteSettings: adminProcedure
    .input(
      z.object({
        faviconUrl: z.string().max(2048).optional().nullable(),
        customCss: z.string().max(MAX_SETTINGS_CODE_SIZE).optional().nullable(),
        customJs: z.string().max(MAX_SETTINGS_CODE_SIZE).optional().nullable(),
        customHtml: z.string().max(MAX_SETTINGS_CODE_SIZE).optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const normalizedFavicon = normalizeOptionalText(input.faviconUrl);
      if (normalizedFavicon && !isValidFaviconUrl(normalizedFavicon)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Favicon URL must be absolute (http/https) or root-relative.',
        });
      }

      const updatePayload: Partial<typeof siteSettings.$inferInsert> = {
        updatedAt: new Date(),
      };

      const normalizedCss = normalizeOptionalText(input.customCss);
      const normalizedJs = normalizeOptionalText(input.customJs);
      const normalizedHtml = normalizeOptionalText(input.customHtml);

      if (normalizedFavicon !== undefined) updatePayload.faviconUrl = normalizedFavicon;
      if (normalizedCss !== undefined) updatePayload.customCss = normalizedCss;
      if (normalizedJs !== undefined) updatePayload.customJs = normalizedJs;
      if (normalizedHtml !== undefined) updatePayload.customHtml = normalizedHtml;

      const [updated] = await ctx.db
        .insert(siteSettings)
        .values({ id: 1, ...updatePayload })
        .onConflictDoUpdate({
          target: siteSettings.id,
          set: updatePayload,
        })
        .returning({
          faviconUrl: siteSettings.faviconUrl,
          customCss: siteSettings.customCss,
          customJs: siteSettings.customJs,
          customHtml: siteSettings.customHtml,
        });

      return {
        faviconUrl: updated?.faviconUrl ?? null,
        customCss: updated?.customCss ?? '',
        customJs: updated?.customJs ?? '',
        customHtml: updated?.customHtml ?? '',
      };
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
