import Link from 'next/link';
import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { postTags, posts, tagRevisions, tags } from '@/db/schema';
import EmptyState from '@/components/ui/empty-state';
import { Inbox, Tag as TagIcon } from 'lucide-react';
import { getTheme } from '@/lib/theme';
import SiteHeader from '@/components/site-header';
import { getViewer } from '@/lib/viewer';
import StatusPill from '@/components/ui/status-pill';
import TagEditForm, { type TagEditState } from '@/components/forms/tag-edit-form';
import { getCaller } from '@/server/caller';
import TimeStamp from '@/components/ui/time-stamp';

async function editTagAction(
  tagId: string,
  tagSlug: string,
  prevState: TagEditState,
  formData: FormData
): Promise<TagEditState> {
  'use server';
  const name = (formData.get('name') as string | null)?.trim() ?? '';
  const slug = (formData.get('slug') as string | null)?.trim() ?? '';

  if (!name && !slug) {
    return { ok: false, message: 'Provide a new name or slug.' };
  }

  try {
    const caller = await getCaller();
    const updated = await caller.tags.requestEdit({
      tagId,
      name: name || undefined,
      slug: slug || undefined,
    });
    const message =
      updated && 'status' in updated && updated.status !== 'applied'
        ? 'Tag update submitted for review.'
        : 'Tag updated.';
    revalidatePath('/tags');
    revalidatePath(`/tags/${tagSlug}`);
    revalidatePath('/admin/tags');
    revalidatePath('/');
    return { ok: true, message };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Update failed.';
    return { ok: false, message };
  }
}

export default async function TagPage({ params }: { params: { tag: string } }) {
  const theme = getTheme();
  const { viewer, session } = await getViewer();
  const viewerId = session?.user?.id ?? null;
  const isAdmin = viewer?.role === 'admin';
  const [tag] = await db
    .select()
    .from(tags)
    .where(eq(tags.slug, params.tag))
    .limit(1);

  if (!tag) {
    return (
      <div className="min-h-screen app-bg">
        <SiteHeader viewer={viewer} initialTheme={theme} active="tags" />
        <div className="max-w-3xl mx-auto px-6 pt-24 pb-24">
          <EmptyState
            icon={<Inbox className="h-5 w-5" />}
            title="Tag not found"
            description="This tag is not available yet."
            action={
              <Link
                href="/tags"
               
                className="border border-[#00ff41]/40 px-4 py-2 text-xs uppercase tracking-[0.3em] text-[#00ff41] hover:bg-[#00ff41] hover:text-black transition"
              >
                Back to tags
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const tagPostsRows = await db
    .select({ postId: postTags.postId })
    .from(postTags)
    .where(eq(postTags.tagId, tag.id));

  const postIds = tagPostsRows.map((row) => row.postId);
  const tagPosts = postIds.length
    ? await db
        .select({
          id: posts.id,
          slug: posts.slug,
          title: posts.title,
          excerpt: posts.excerpt,
          publishedAt: posts.publishedAt,
          createdAt: posts.createdAt,
          status: posts.status,
          authorId: posts.authorId,
        })
        .from(posts)
        .where(
          and(
            inArray(posts.id, postIds),
            viewerId
              ? or(eq(posts.status, 'published'), eq(posts.authorId, viewerId))
              : eq(posts.status, 'published')
          )
        )
        .orderBy(desc(sql`coalesce(${posts.publishedAt}, ${posts.createdAt})`))
    : [];

  const [latestTagEdit] = viewerId
    ? await db
        .select({
          status: tagRevisions.status,
          createdAt: tagRevisions.createdAt,
          name: tagRevisions.name,
          slug: tagRevisions.slug,
        })
        .from(tagRevisions)
        .where(and(eq(tagRevisions.tagId, tag.id), eq(tagRevisions.authorId, viewerId)))
        .orderBy(desc(tagRevisions.createdAt))
        .limit(1)
    : [];

  return (
    <div className="min-h-screen app-bg">
      <SiteHeader viewer={viewer} initialTheme={theme} active="tags" />
      <div className="max-w-screen-xl mx-auto px-6 pt-24 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-8">
            <div className="max-w-3xl space-y-10">
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.4em] app-muted">
                  <TagIcon className="h-4 w-4" />
                  Tag
                </div>
                <h1 className="mt-4 text-4xl font-black">{tag.name}</h1>
                <p className="mt-3 app-muted-strong">/{tag.slug}</p>
              </div>

              {latestTagEdit && latestTagEdit.status !== 'approved' && (
                <div className="border app-border panel-bg p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs uppercase tracking-[0.3em] app-muted">
                      Update status
                    </div>
                    <StatusPill
                      status={latestTagEdit.status}
                      label={
                        latestTagEdit.status === 'pending'
                          ? 'Pending Review'
                          : 'Rejected'
                      }
                    />
                  </div>
                  <p className="mt-2 text-sm app-muted-strong">
                    Proposed /{latestTagEdit.slug} · Submitted{" "}
                    <TimeStamp value={latestTagEdit.createdAt} />
                  </p>
                </div>
              )}

              {tagPosts.length === 0 ? (
                <EmptyState
                  icon={<Inbox className="h-5 w-5" />}
                  title="No posts for this tag"
                  description="Posts will appear here once they are approved and tagged."
                />
              ) : (
                <div className="space-y-4">
                  {tagPosts.map((post) => (
                    <Link
                      key={post.id}
                      href={`/posts/${post.slug}`}
                     
                      className="block border app-border panel-bg p-4 hover:border-[#00ff41] transition"
                    >
                      <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.3em] app-muted">
                        <span>
                          {post.status === 'published' ? 'Published' : 'Submitted'}{' '}
                          <TimeStamp value={post.publishedAt || post.createdAt} />
                        </span>
                        {post.status !== 'published' && post.authorId === viewerId && (
                          <StatusPill
                            status={post.status}
                            label={post.status === 'pending' ? 'Pending Review' : 'Rejected'}
                          />
                        )}
                      </div>
                      <div className="mt-2 text-lg font-semibold app-text">
                        {post.title}
                      </div>
                      {post.excerpt && (
                        <p className="mt-2 text-sm app-muted-strong">{post.excerpt}</p>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {viewerId && (
            <aside className="lg:col-span-4">
              <div className="lg:sticky lg:top-24 space-y-4">
                <div className="border app-border panel-bg p-6">
                  <TagEditForm
                    action={editTagAction.bind(null, tag.id, tag.slug)}
                    initialName={tag.name}
                    initialSlug={tag.slug}
                    isAdmin={isAdmin}
                  />
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
