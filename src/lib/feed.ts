import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { comments, postLikes, postTags, posts, tags } from "@/db/schema";

export type FeedCursor = {
  date: string;
  id: string;
};

export type FeedPost = {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  createdAt: string;
  publishedAt?: string | null;
  updatedAt: string;
  edited: boolean;
  status: "published" | "pending" | "rejected";
  isMine: boolean;
  tags: { name: string; slug: string }[];
  stats: { views: number; likes: number; comments: number };
};

type FeedOptions = {
  viewerId?: string | null;
  isAdmin?: boolean;
  tagSlugs?: string[];
  match?: "any" | "all";
  cursor?: FeedCursor | null;
  limit?: number;
  from?: string | null;
  to?: string | null;
};

function isEdited(createdAt: Date | string | null, updatedAt: Date | string | null) {
  if (!createdAt || !updatedAt) return false;
  const created = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  const updated = typeof updatedAt === "string" ? new Date(updatedAt) : updatedAt;
  if (Number.isNaN(created.getTime()) || Number.isNaN(updated.getTime())) return false;
  return updated.getTime() - created.getTime() > 60_000;
}

export async function getFeed({
  viewerId,
  isAdmin = false,
  tagSlugs = [],
  match = "any",
  cursor,
  limit = 9,
  from,
  to,
}: FeedOptions) {
  const visibility = isAdmin
    ? sql`true`
    : viewerId
      ? or(eq(posts.status, "published"), eq(posts.authorId, viewerId))
      : eq(posts.status, "published");

  let filterPostIds: string[] | null = null;

  if (tagSlugs.length > 0) {
    const tagRows = await db
      .select({ id: tags.id })
      .from(tags)
      .where(inArray(tags.slug, tagSlugs));

    const tagIds = tagRows.map((row) => row.id);
    if (tagIds.length === 0) {
      return { posts: [], nextCursor: null };
    }

    if (match === "all") {
      const rows = await db
        .select({
          postId: postTags.postId,
          count: sql<number>`count(distinct ${postTags.tagId})`.mapWith(Number),
        })
        .from(postTags)
        .where(inArray(postTags.tagId, tagIds))
        .groupBy(postTags.postId)
        .having(eq(sql`count(distinct ${postTags.tagId})`, tagIds.length));
      filterPostIds = rows.map((row) => row.postId);
    } else {
      const rows = await db
        .selectDistinct({ postId: postTags.postId })
        .from(postTags)
        .where(inArray(postTags.tagId, tagIds));
      filterPostIds = rows.map((row) => row.postId);
    }

    if (filterPostIds.length === 0) {
      return { posts: [], nextCursor: null };
    }
  }

  const sortExpr = sql`coalesce(${posts.publishedAt}, ${posts.createdAt})`;
  const conditions = [visibility];

  if (from) {
    const fromDate = new Date(from);
    if (!Number.isNaN(fromDate.getTime())) {
      conditions.push(sql`${sortExpr} >= ${fromDate}`);
    }
  }

  if (to) {
    const toDate = new Date(to);
    if (!Number.isNaN(toDate.getTime())) {
      const next = new Date(toDate);
      next.setUTCDate(next.getUTCDate() + 1);
      conditions.push(sql`${sortExpr} < ${next}`);
    }
  }

  if (filterPostIds) {
    conditions.push(inArray(posts.id, filterPostIds));
  }

  if (cursor?.date && cursor?.id) {
    const cursorDate = new Date(cursor.date);
    conditions.push(
      sql`(${sortExpr} < ${cursorDate} OR (${sortExpr} = ${cursorDate} AND ${posts.id} < ${cursor.id}))`
    );
  }

  const rows = await db
    .select({
      id: posts.id,
      slug: posts.slug,
      title: posts.title,
      excerpt: posts.excerpt,
      views: posts.views,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
      publishedAt: posts.publishedAt,
      status: posts.status,
      authorId: posts.authorId,
    })
    .from(posts)
    .where(and(...conditions))
    .orderBy(desc(sortExpr), desc(posts.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);
  const nextCursor = hasMore && last
    ? {
        date: (last.publishedAt ?? last.createdAt).toISOString(),
        id: last.id,
      }
    : null;

  const postIds = page.map((post) => post.id);

  const tagRows = postIds.length
    ? await db
        .select({
          postId: postTags.postId,
          name: tags.name,
          slug: tags.slug,
        })
        .from(postTags)
        .innerJoin(tags, eq(postTags.tagId, tags.id))
        .where(inArray(postTags.postId, postIds))
    : [];

  const commentCounts = postIds.length
    ? await db
        .select({
          postId: comments.postId,
          total: sql<number>`count(*)`.mapWith(Number),
        })
        .from(comments)
        .where(and(eq(comments.status, "approved"), inArray(comments.postId, postIds)))
        .groupBy(comments.postId)
    : [];

  const likeCounts = postIds.length
    ? await db
        .select({
          postId: postLikes.postId,
          total: sql<number>`count(*)`.mapWith(Number),
        })
        .from(postLikes)
        .where(inArray(postLikes.postId, postIds))
        .groupBy(postLikes.postId)
    : [];

  const tagsByPost = new Map<string, { name: string; slug: string }[]>();
  for (const row of tagRows) {
    const list = tagsByPost.get(row.postId) ?? [];
    list.push({ name: row.name, slug: row.slug });
    tagsByPost.set(row.postId, list);
  }

  const commentCountByPost = new Map<string, number>();
  for (const row of commentCounts) {
    commentCountByPost.set(row.postId, row.total);
  }

  const likeCountByPost = new Map<string, number>();
  for (const row of likeCounts) {
    likeCountByPost.set(row.postId, row.total);
  }

  const postsForView: FeedPost[] = page.map((post) => ({
    id: post.id,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    createdAt: post.createdAt.toISOString(),
    publishedAt: post.publishedAt?.toISOString() ?? null,
    updatedAt: (post.updatedAt ?? post.createdAt).toISOString(),
    edited: isEdited(post.createdAt, post.updatedAt),
    status: post.status,
    isMine: viewerId ? post.authorId === viewerId : false,
    tags: tagsByPost.get(post.id) ?? [],
    stats: {
      views: post.views ?? 0,
      likes: likeCountByPost.get(post.id) ?? 0,
      comments: commentCountByPost.get(post.id) ?? 0,
    },
  }));

  return { posts: postsForView, nextCursor };
}
