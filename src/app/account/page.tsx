import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth-guard';
import { db } from '@/db';
import { comments, posts, postRevisions, tagRequests, tags } from '@/db/schema';
import EmptyState from '@/components/ui/empty-state';
import StatusPill from '@/components/ui/status-pill';
import { Inbox, User } from 'lucide-react';
import { getTheme } from '@/lib/theme';
import SiteHeader from '@/components/site-header';
import { ensureUserProfile } from '@/lib/user-profile';
import TimeStamp from '@/components/ui/time-stamp';

export default async function AccountPage() {
  const { session } = await requireUser();
  const userId = session.user.id;
  const theme = getTheme();
  const viewerProfile = session?.user
    ? await ensureUserProfile({ id: session.user.id, email: session.user.email })
    : null;
  const viewer = session?.user
    ? {
        email: session.user.email,
        role: viewerProfile?.role ?? 'user',
        name: session.user.name ?? undefined,
        image: session.user.image ?? undefined,
      }
    : null;

  const [myPosts, myComments, myTagRequests, myPostRevisions, approvedTags] = await Promise.all([
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
      .where(eq(posts.authorId, userId))
      .orderBy(desc(posts.createdAt)),
    db
      .select({
        id: comments.id,
        body: comments.body,
        status: comments.status,
        createdAt: comments.createdAt,
      })
      .from(comments)
      .where(eq(comments.authorId, userId))
      .orderBy(desc(comments.createdAt)),
    db
      .select({
        id: tagRequests.id,
        name: tagRequests.name,
        slug: tagRequests.slug,
        status: tagRequests.status,
        createdAt: tagRequests.createdAt,
      })
      .from(tagRequests)
      .where(eq(tagRequests.requestedBy, userId))
      .orderBy(desc(tagRequests.createdAt)),
    db
      .select({
        id: postRevisions.id,
        postId: postRevisions.postId,
        status: postRevisions.status,
        createdAt: postRevisions.createdAt,
        title: posts.title,
        slug: posts.slug,
      })
      .from(postRevisions)
      .innerJoin(posts, eq(postRevisions.postId, posts.id))
      .where(eq(postRevisions.authorId, userId))
      .orderBy(desc(postRevisions.createdAt)),
    db.select({ slug: tags.slug }).from(tags),
  ]);
  const tagSlugSet = new Set(approvedTags.map((tag) => tag.slug));

  return (
    <div className="min-h-screen app-bg">
      <SiteHeader viewer={viewer} initialTheme={theme} />
      <div className="max-w-4xl mx-auto space-y-10 px-6 pt-24 pb-24">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.4em] app-muted">
            <User className="h-4 w-4" />
            Account
          </div>
          <h1 className="mt-4 text-4xl font-black">Your Activity</h1>
          <p className="mt-3 app-muted-strong">
            Track submissions, moderation status, and recent requests.
          </p>
        </div>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Your Posts</h2>
          {myPosts.length === 0 ? (
            <EmptyState
              icon={<Inbox className="h-5 w-5" />}
              title="No submissions yet"
              description="Submit your first post to kick off your archive."
              action={
                <Link
                  href="/submit"
                 
                  className="border border-[#00ff41]/40 px-4 py-2 text-xs uppercase tracking-[0.3em] text-[#00ff41] hover:bg-[#00ff41] hover:text-black transition"
                >
                  Submit a post
                </Link>
              }
            />
          ) : (
            <div className="space-y-3">
              {myPosts.map((post) => (
                <div key={post.id} className="border app-border panel-bg p-4">
                  <div className="text-xs uppercase tracking-[0.3em] app-muted">
                    {post.status}
                  </div>
                  <div className="mt-2 text-lg font-semibold app-text">{post.title}</div>
                  <div className="mt-1 text-xs app-muted">
                    Submitted <TimeStamp value={post.createdAt} />
                  </div>
                  {post.status === 'published' && (
                    <Link
                      href={`/posts/${post.slug}`}
                     
                      className="mt-3 inline-block text-xs uppercase tracking-[0.3em] text-[#00ff41] hover:underline"
                    >
                      View post
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Post Updates</h2>
          {myPostRevisions.length === 0 ? (
            <EmptyState
              icon={<Inbox className="h-5 w-5" />}
              title="No updates submitted"
              description="Edits you request will appear here with their review status."
            />
          ) : (
            <div className="space-y-3">
              {myPostRevisions.map((revision) => (
                <div key={revision.id} className="border app-border panel-bg p-4">
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={`/posts/${revision.slug}`}
                     
                      className="text-sm font-semibold app-text hover:text-[#00ff41] transition"
                    >
                      {revision.title}
                    </Link>
                    <StatusPill
                      status={revision.status}
                      label={
                        revision.status === 'pending'
                          ? 'Pending Review'
                          : revision.status === 'approved'
                            ? 'Applied'
                            : 'Rejected'
                      }
                    />
                  </div>
                  <div className="mt-2 text-xs app-muted">
                    Submitted <TimeStamp value={revision.createdAt} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Your Comments</h2>
          {myComments.length === 0 ? (
            <EmptyState
              icon={<Inbox className="h-5 w-5" />}
              title="No comments yet"
              description="Join the discussion on published posts."
            />
          ) : (
            <div className="space-y-3">
              {myComments.map((comment) => (
                <div key={comment.id} className="border app-border panel-bg p-4">
                  <div className="text-xs uppercase tracking-[0.3em] app-muted">
                    {comment.status}
                  </div>
                  <div className="mt-2 text-sm app-muted-strong whitespace-pre-line">
                    {comment.body}
                  </div>
                  <div className="mt-1 text-xs app-muted">
                    Submitted <TimeStamp value={comment.createdAt} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Your Tag Requests</h2>
          {myTagRequests.length === 0 ? (
            <EmptyState
              icon={<Inbox className="h-5 w-5" />}
              title="No tag requests"
              description="Request new tags from the tag directory."
              action={
                <Link
                  href="/tags"
                 
                  className="border border-[#00ff41]/40 px-4 py-2 text-xs uppercase tracking-[0.3em] text-[#00ff41] hover:bg-[#00ff41] hover:text-black transition"
                >
                  Browse tags
                </Link>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {myTagRequests.map((request) => {
                const resolved =
                  tagSlugSet.has(request.slug) && request.status !== 'approved';
                const pillStatus = resolved ? 'approved' : request.status;
                const label = resolved
                  ? 'Resolved'
                  : request.status === 'pending'
                    ? 'Pending Review'
                    : request.status === 'approved'
                      ? 'Approved'
                      : 'Rejected';
                return (
                  <div key={request.id} className="border app-border panel-bg p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-lg font-semibold app-text">
                        {request.name}
                      </div>
                      <StatusPill status={pillStatus} label={label} />
                    </div>
                    <div className="mt-2 text-xs app-muted">/{request.slug}</div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
