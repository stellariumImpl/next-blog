import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { comments, posts, tags, user, userProfiles } from "@/db/schema";
import SiteHeader from "@/components/site-header";
import TimeStamp from "@/components/ui/time-stamp";
import EmptyState from "@/components/ui/empty-state";
import StatusPill from "@/components/ui/status-pill";
import { Inbox, User } from "lucide-react";
import { getTheme } from "@/lib/theme";
import { getViewer } from "@/lib/viewer";

export default async function AboutPage({ params }: { params: { id: string } }) {
  const theme = getTheme();
  const { viewer, session } = await getViewer();
  const viewerId = session?.user?.id ?? null;
  const isSelf = viewerId === params.id;
  const isAdmin = viewer?.role === "admin";
  const showPrivate = isSelf || isAdmin;

  const [author] = await db
    .select({
      id: user.id,
      name: user.name,
      image: user.image,
      createdAt: user.createdAt,
      role: userProfiles.role,
    })
    .from(user)
    .leftJoin(userProfiles, eq(user.id, userProfiles.userId))
    .where(eq(user.id, params.id))
    .limit(1);

  if (!author) {
    notFound();
  }

  const postFilter = showPrivate
    ? eq(posts.authorId, author.id)
    : and(eq(posts.authorId, author.id), eq(posts.status, "published"));

  const commentFilter = showPrivate
    ? eq(comments.authorId, author.id)
    : and(
        eq(comments.authorId, author.id),
        eq(comments.status, "approved"),
        eq(posts.status, "published")
      );

  const [postCountRow, commentCountRow, tagCountRow, postRows, commentRows, tagRows] =
    await Promise.all([
      db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(posts)
        .where(postFilter)
        .limit(1),
      db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(comments)
        .leftJoin(posts, eq(comments.postId, posts.id))
        .where(commentFilter)
        .limit(1),
      db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(tags)
        .where(eq(tags.createdBy, author.id))
        .limit(1),
      db
        .select({
          id: posts.id,
          slug: posts.slug,
          title: posts.title,
          status: posts.status,
          createdAt: posts.createdAt,
          publishedAt: posts.publishedAt,
        })
        .from(posts)
        .where(postFilter)
        .orderBy(desc(posts.createdAt))
        .limit(12),
      db
        .select({
          id: comments.id,
          body: comments.body,
          status: comments.status,
          createdAt: comments.createdAt,
          postSlug: posts.slug,
          postTitle: posts.title,
        })
        .from(comments)
        .leftJoin(posts, eq(comments.postId, posts.id))
        .where(commentFilter)
        .orderBy(desc(comments.createdAt))
        .limit(12),
      db
        .select({
          id: tags.id,
          name: tags.name,
          slug: tags.slug,
          createdAt: tags.createdAt,
        })
        .from(tags)
        .where(eq(tags.createdBy, author.id))
        .orderBy(desc(tags.createdAt))
        .limit(12),
    ]);

  const postCount = postCountRow?.[0]?.count ?? 0;
  const commentCount = commentCountRow?.[0]?.count ?? 0;
  const tagCount = tagCountRow?.[0]?.count ?? 0;
  const displayName = author.name || "Member";
  const authorInitial = displayName.trim().charAt(0).toUpperCase() || "U";
  const roleLabel = author.role === "admin" ? "Admin" : "Member";

  return (
    <div className="min-h-screen app-bg">
      <SiteHeader viewer={viewer} initialTheme={theme} />
      <div className="max-w-5xl mx-auto space-y-10 px-6 pt-24 pb-24">
        <div className="flex flex-wrap items-center gap-4 border app-border panel-bg p-4">
          <div className="h-16 w-16 rounded-full border app-border bg-[color:var(--panel-bg)]/60 overflow-hidden flex items-center justify-center text-sm uppercase tracking-[0.3em] app-text">
            {author.image ? (
              <img
                src={author.image}
                alt={displayName}
                className="h-full w-full object-cover"
              />
            ) : (
              <span>{authorInitial}</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.4em] app-muted flex items-center gap-2">
              <User className="h-4 w-4" />
              Profile
            </div>
            <h1 className="mt-2 text-3xl font-black">{displayName}</h1>
            <div className="mt-2 text-sm app-muted-strong">
              {roleLabel} · Member since{" "}
              {author.createdAt ? <TimeStamp value={author.createdAt} /> : "--"}
            </div>
            {showPrivate ? (
              <div className="mt-2 text-xs app-muted">
                Private view enabled
              </div>
            ) : (
              <div className="mt-2 text-xs app-muted">
                Public profile
              </div>
            )}
          </div>
        </div>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="border app-border panel-bg p-4">
            <div className="text-[10px] uppercase tracking-[0.3em] app-muted">
              Posts
            </div>
            <div className="mt-2 text-2xl font-black app-text">{postCount}</div>
          </div>
          <div className="border app-border panel-bg p-4">
            <div className="text-[10px] uppercase tracking-[0.3em] app-muted">
              Comments
            </div>
            <div className="mt-2 text-2xl font-black app-text">
              {commentCount}
            </div>
          </div>
          <div className="border app-border panel-bg p-4">
            <div className="text-[10px] uppercase tracking-[0.3em] app-muted">
              Tags Created
            </div>
            <div className="mt-2 text-2xl font-black app-text">{tagCount}</div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Articles</h2>
          {postRows.length === 0 ? (
            <EmptyState
              icon={<Inbox className="h-5 w-5" />}
              title="No posts yet"
              description="Published articles will appear here."
            />
          ) : (
            <div className="space-y-3">
              {postRows.map((post) => (
                <div key={post.id} className="border app-border panel-bg p-4">
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={`/posts/${post.slug}`}
                      className="text-sm font-semibold app-text hover:text-[#00ff41] transition"
                    >
                      {post.title}
                    </Link>
                    {showPrivate && (
                      <StatusPill
                        status={post.status}
                        label={
                          post.status === "pending"
                            ? "Pending Review"
                            : post.status === "published"
                              ? "Published"
                              : "Rejected"
                        }
                      />
                    )}
                  </div>
                  <div className="mt-2 text-xs app-muted">
                    {post.publishedAt && post.status === "published" ? (
                      <>
                        Published <TimeStamp value={post.publishedAt} />
                      </>
                    ) : (
                      <>
                        Submitted <TimeStamp value={post.createdAt} />
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Comments</h2>
          {commentRows.length === 0 ? (
            <EmptyState
              icon={<Inbox className="h-5 w-5" />}
              title="No comments yet"
              description="Recent comment activity will show here."
            />
          ) : (
            <div className="space-y-3">
              {commentRows.map((comment) => (
                <div key={comment.id} className="border app-border panel-bg p-4">
                  <div className="text-sm app-muted-strong whitespace-pre-line">
                    {comment.body}
                  </div>
                  <div className="mt-2 text-xs app-muted">
                    <TimeStamp value={comment.createdAt} /> ·{" "}
                    {comment.postSlug ? (
                      <Link
                        href={`/posts/${comment.postSlug}`}
                        className="text-[#00ff41] hover:underline"
                      >
                        {comment.postTitle ?? "View post"}
                      </Link>
                    ) : (
                      "Post unavailable"
                    )}
                  </div>
                  {showPrivate && (
                    <div className="mt-2 text-[10px] uppercase tracking-[0.3em] app-muted">
                      {comment.status}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Tags Created</h2>
          {tagRows.length === 0 ? (
            <EmptyState
              icon={<Inbox className="h-5 w-5" />}
              title="No tags yet"
              description="Tags created by this user will appear here."
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {tagRows.map((tag) => (
                <Link
                  key={tag.id}
                  href={`/tags/${tag.slug}`}
                  className="border app-border px-3 py-1 text-xs uppercase tracking-[0.3em] text-[#00ff41] hover:bg-[#00ff41] hover:text-black transition"
                >
                  #{tag.name}
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
