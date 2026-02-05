import { desc, eq, sql } from 'drizzle-orm';
import { cookies, headers } from 'next/headers';
import { unstable_noStore as noStore } from 'next/cache';
import { auth } from '@/lib/auth';
import { ensureUserProfile } from '@/lib/user-profile';
import { db } from '@/db';
import { comments, posts, tags } from '@/db/schema';
import HomeView, { type HomePost } from '@/components/home-view';
import { getFeed, type FeedCursor } from '@/lib/feed';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function HomePage({
  searchParams,
}: {
  searchParams?: { tags?: string; match?: string; from?: string; to?: string };
}) {
  noStore();
  const theme = cookies().get('theme')?.value === 'light' ? 'light' : 'dark';
  const session = await auth.api.getSession({ headers: await headers() });
  const viewerProfile = session?.user
    ? await ensureUserProfile({ id: session.user.id, email: session.user.email })
    : null;

  const viewerId = session?.user?.id ?? null;
  const isAdmin = viewerProfile?.role === 'admin';

  const tagParam = searchParams?.tags ?? "";
  const tagSlugs = tagParam
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const match = searchParams?.match === "all" ? "all" : "any";
  const from = searchParams?.from ?? null;
  const to = searchParams?.to ?? null;

  const [feed, featuredTags, postCount, commentCount, tagCount] = await Promise.all([
    getFeed({
      viewerId,
      isAdmin,
      limit: 9,
      tagSlugs,
      match,
      from,
      to,
    }),
    db
      .select({ name: tags.name, slug: tags.slug })
      .from(tags)
      .orderBy(desc(tags.createdAt))
      .limit(8),
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(posts)
      .where(eq(posts.status, 'published')),
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(comments)
      .where(eq(comments.status, 'approved')),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(tags),
  ]);

  let dbHost = '';
  let dbName = '';
  try {
    const url = new URL(process.env.DATABASE_URL ?? '');
    dbHost = url.host;
    dbName = url.pathname.replace('/', '');
  } catch {
    // ignore
  }

  return (
    <HomeView
      initialTheme={theme}
      posts={feed.posts as HomePost[]}
      initialCursor={feed.nextCursor as FeedCursor | null}
      viewer={
        viewerProfile && session?.user?.email
          ? {
              email: session.user.email,
              role: viewerProfile.role,
              name: session.user.name ?? undefined,
              image: session.user.image ?? undefined,
            }
          : null
      }
      stats={{
        posts: postCount?.[0]?.count ?? 0,
        comments: commentCount?.[0]?.count ?? 0,
        tags: tagCount?.[0]?.count ?? 0,
      }}
      featuredTags={featuredTags}
      initialTagSlugs={tagSlugs}
      initialMatch={match}
      initialFrom={from ?? undefined}
      initialTo={to ?? undefined}
      debug={
        process.env.NODE_ENV === 'development'
          ? {
              db: dbHost ? `${dbHost}/${dbName || 'unknown'}` : 'unknown',
              serverPosts: feed.posts.length,
              statsPosts: postCount?.[0]?.count ?? 0,
            }
          : undefined
      }
    />
  );
}
