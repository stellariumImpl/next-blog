import "server-only";
// Algolia v5 CJS interop is inconsistent across bundlers; require avoids default-import issues.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const algoliaModule = () => require("algoliasearch");
import { eq } from "drizzle-orm";
import { posts, postTags, tags } from "@/db/schema";
import { stripMarkdown } from "@/lib/markdown";

type DbClient = typeof import("@/db").db;

const appId = process.env.ALGOLIA_APP_ID;
const adminKey = process.env.ALGOLIA_ADMIN_KEY;
const indexName = process.env.ALGOLIA_INDEX ?? "posts";
const tagsIndexName = process.env.ALGOLIA_TAGS_INDEX ?? "tags";

let cachedClient: any = null;
const getClient = () => {
  if (cachedClient) return cachedClient;
  if (!appId || !adminKey) return null;
  try {
    const { algoliasearch } = algoliaModule();
    cachedClient = algoliasearch(appId, adminKey);
    return cachedClient;
  } catch (error) {
    console.error("Algolia client init failed", error);
    return null;
  }
};

export const algoliaEnabled = Boolean(appId && adminKey);

const getClientOrThrow = () => {
  const client = getClient();
  if (!client) {
    throw new Error("Algolia index is not available. Check ALGOLIA_APP_ID/ALGOLIA_ADMIN_KEY.");
  }
  return client;
};

export type AlgoliaPostRecord = {
  objectID: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  content?: string | null;
  tags: string[];
  publishedAt?: string | null;
  updatedAt?: string | null;
};

export type AlgoliaTagRecord = {
  objectID: string;
  name: string;
  slug: string;
  createdAt?: string | null;
};

const buildRecord = async (
  db: DbClient,
  postId: string
): Promise<AlgoliaPostRecord | null> => {
  const [post] = await db
    .select({
      id: posts.id,
      slug: posts.slug,
      title: posts.title,
      excerpt: posts.excerpt,
      content: posts.content,
      status: posts.status,
      publishedAt: posts.publishedAt,
      updatedAt: posts.updatedAt,
    })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);

  if (!post || post.status !== "published") {
    return null;
  }

  const tagRows = await db
    .select({ name: tags.name })
    .from(postTags)
    .innerJoin(tags, eq(postTags.tagId, tags.id))
    .where(eq(postTags.postId, postId));

  const content = stripMarkdown(post.content ?? "").slice(0, 8000);

  return {
    objectID: post.id,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt ?? null,
    content: content || null,
    tags: tagRows.map((tag) => tag.name),
    publishedAt: post.publishedAt?.toISOString() ?? null,
    updatedAt: post.updatedAt?.toISOString() ?? null,
  };
};

export async function upsertAlgoliaPost(db: DbClient, postId: string) {
  const client = getClient();
  if (!client) return;
  try {
    const record = await buildRecord(db, postId);
    if (!record) {
      await client.deleteObject({ indexName, objectID: postId });
      return;
    }
    await client.saveObject({ indexName, body: record });
  } catch (error) {
    console.warn("Algolia upsert failed", error);
  }
}

export async function removeAlgoliaPost(postId: string) {
  const client = getClient();
  if (!client) return;
  try {
    await client.deleteObject({ indexName, objectID: postId });
  } catch (error) {
    console.warn("Algolia delete failed", error);
  }
}

const buildTagRecord = async (
  db: DbClient,
  tagId: string
): Promise<AlgoliaTagRecord | null> => {
  const [tag] = await db
    .select({
      id: tags.id,
      name: tags.name,
      slug: tags.slug,
      createdAt: tags.createdAt,
    })
    .from(tags)
    .where(eq(tags.id, tagId))
    .limit(1);

  if (!tag) return null;

  return {
    objectID: tag.id,
    name: tag.name,
    slug: tag.slug,
    createdAt: tag.createdAt?.toISOString() ?? null,
  };
};

export async function upsertAlgoliaTag(db: DbClient, tagId: string) {
  const client = getClient();
  if (!client) return;
  try {
    const record = await buildTagRecord(db, tagId);
    if (!record) {
      await client.deleteObject({ indexName: tagsIndexName, objectID: tagId });
      return;
    }
    await client.saveObject({ indexName: tagsIndexName, body: record });
  } catch (error) {
    console.warn("Algolia tag upsert failed", error);
  }
}

export async function removeAlgoliaTag(tagId: string) {
  const client = getClient();
  if (!client) return;
  try {
    await client.deleteObject({ indexName: tagsIndexName, objectID: tagId });
  } catch (error) {
    console.warn("Algolia tag delete failed", error);
  }
}

export async function reindexAlgoliaPosts(db: DbClient) {
  const client = getClientOrThrow();
  const rows = await db
    .select({ id: posts.id })
    .from(posts)
    .where(eq(posts.status, "published"));

  const records = (
    await Promise.all(rows.map((row) => buildRecord(db, row.id)))
  ).filter(Boolean) as AlgoliaPostRecord[];

  await client.replaceAllObjects({
    indexName,
    objects: records,
    batchSize: 1000,
  });
  return { ok: true, count: records.length };
}

export async function reindexAlgoliaTags(db: DbClient) {
  const client = getClientOrThrow();
  const rows = await db
    .select({
      id: tags.id,
      name: tags.name,
      slug: tags.slug,
      createdAt: tags.createdAt,
    })
    .from(tags);

  const records = rows.map((tag) => ({
    objectID: tag.id,
    name: tag.name,
    slug: tag.slug,
    createdAt: tag.createdAt?.toISOString() ?? null,
  })) as AlgoliaTagRecord[];

  await client.replaceAllObjects({
    indexName: tagsIndexName,
    objects: records,
    batchSize: 1000,
  });
  return { ok: true, count: records.length };
}
