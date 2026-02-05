import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { desc, eq, sql } from 'drizzle-orm';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { tagRequests, tags } from '@/db/schema';
import TagRequestForm, { type TagRequestState } from '@/components/forms/tag-request-form';
import EmptyState from '@/components/ui/empty-state';
import { Inbox, Tag as TagIcon } from 'lucide-react';
import { getCaller } from '@/server/caller';
import { getTheme } from '@/lib/theme';
import SiteHeader from '@/components/site-header';
import { getViewer } from '@/lib/viewer';
import StatusPill from '@/components/ui/status-pill';
import TimeStamp from '@/components/ui/time-stamp';

async function createTagRequestAction(
  prevState: TagRequestState,
  formData: FormData
): Promise<TagRequestState> {
  'use server';

  const name = (formData.get('name') as string | null)?.trim() ?? '';
  const rawSlug = (formData.get('slug') as string | null)?.trim() ?? '';

  if (!name) {
    return { ok: false, message: 'Tag name is required.' };
  }

  const slug = rawSlug || name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');

  try {
    const caller = await getCaller();
    const created = await caller.tags.requestNew({ name, slug });
    const message =
      created && 'status' in created
        ? 'Tag request submitted for review.'
        : 'Tag created.';
    revalidatePath('/tags');
    revalidatePath('/admin/tags');
    revalidatePath('/');
    return { ok: true, message };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed.';
    return { ok: false, message };
  }
}

export default async function TagsPage() {
  const theme = getTheme();
  const { viewer, session } = await getViewer();
  const isAdmin = viewer?.role === 'admin';
  const fallbackSession = session ?? (await auth.api.getSession({ headers: await headers() }));
  const isSignedIn = !!fallbackSession?.user;
  const viewerId = fallbackSession?.user?.id ?? null;

  const tagList = await db.select().from(tags).orderBy(desc(tags.createdAt));
  const pendingCount = isAdmin
    ? await db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(tagRequests)
        .where(eq(tagRequests.status, 'pending'))
    : null;
  const myTagRequests = !isAdmin && viewerId
    ? await db
        .select({
          id: tagRequests.id,
          name: tagRequests.name,
          slug: tagRequests.slug,
          status: tagRequests.status,
          createdAt: tagRequests.createdAt,
        })
        .from(tagRequests)
        .where(eq(tagRequests.requestedBy, viewerId))
        .orderBy(desc(tagRequests.createdAt))
    : [];
  const tagSlugSet = new Set(tagList.map((tag) => tag.slug));
  const totalTags = tagList.length;
  const myRequestCount = isAdmin ? 0 : myTagRequests.length;
  const pendingRequests = isAdmin
    ? pendingCount?.[0]?.count ?? 0
    : myTagRequests.filter((request) => request.status === 'pending').length;
  const latestTag = tagList[0];

  return (
    <div className="min-h-screen app-bg">
      <SiteHeader viewer={viewer} initialTheme={theme} active="tags" />
      <div className="max-w-screen-xl mx-auto space-y-10 px-6 pt-24 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
          <div className="lg:col-span-8">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.4em] app-muted">
              <TagIcon className="h-4 w-4" />
              Tags
            </div>
            <h1 className="mt-4 text-4xl font-black">Tag Directory</h1>
            <p className="mt-3 app-muted-strong">
              {isAdmin
                ? 'Browse the taxonomy or create new tags instantly.'
                : 'Browse the taxonomy or request a new tag for editorial review.'}
            </p>
          </div>
          <div className="lg:col-span-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="border app-border panel-bg p-4">
                <div className="text-[10px] uppercase tracking-[0.3em] app-muted">Total Tags</div>
                <div className="mt-2 text-2xl font-black app-text">{totalTags}</div>
              </div>
              <div className="border app-border panel-bg p-4">
                <div className="text-[10px] uppercase tracking-[0.3em] app-muted">Pending</div>
                <div className="mt-2 text-2xl font-black app-text">{pendingRequests}</div>
              </div>
              {!isAdmin ? (
                <div className="border app-border panel-bg p-4">
                  <div className="text-[10px] uppercase tracking-[0.3em] app-muted">Your Requests</div>
                  <div className="mt-2 text-2xl font-black app-text">
                    {isSignedIn ? myRequestCount : 0}
                  </div>
                </div>
              ) : (
                <div className="border app-border panel-bg p-4">
                <div className="text-[10px] uppercase tracking-[0.3em] app-muted">Latest Tag</div>
                <div className="mt-2 text-sm font-semibold app-text">
                    {latestTag ? <TimeStamp value={latestTag.createdAt} /> : '--'}
                </div>
              </div>
              )}
              <div className="border app-border panel-bg p-4">
                <div className="text-[10px] uppercase tracking-[0.3em] app-muted">Status</div>
                <div className="mt-2 text-sm font-semibold app-text">
                  {isSignedIn ? (isAdmin ? 'Admin' : 'Member') : 'Guest'}
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="border app-border panel-bg p-6 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div className="text-xs uppercase tracking-[0.4em] app-muted">
              Tag Library
            </div>
            <div className="text-[10px] uppercase tracking-[0.3em] app-muted">
              {totalTags} tags
            </div>
          </div>
          {tagList.length === 0 ? (
            <EmptyState
              icon={<Inbox className="h-5 w-5" />}
              title="No tags yet"
              description="Once tags are approved, they will appear here."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {tagList.map((tag) => (
                <Link
                  key={tag.id}
                  href={`/tags/${tag.slug}`}
                 
                  className="border app-border card-bg p-4 transition hover:border-[color:var(--accent)]/60 hover:shadow-[0_0_20px_rgba(0,0,0,0.05)]"
                >
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] app-muted">
                    <TagIcon className="h-4 w-4" />
                    Tag
                  </div>
                  <div className="mt-3 text-lg font-semibold app-text">
                    {tag.name}
                  </div>
                  <div className="mt-1 text-xs app-muted">/{tag.slug}</div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {isSignedIn && !isAdmin && myTagRequests.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-[0.4em] app-muted">
                Your tag requests
              </div>
              <div className="text-[10px] uppercase tracking-[0.3em] app-muted">
                {myRequestCount} total
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {myTagRequests.map((request) => (
                <div key={request.id} className="border app-border panel-bg p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold app-text">
                      {request.name}
                    </div>
                    <StatusPill
                      status={
                        tagSlugSet.has(request.slug) && request.status !== 'approved'
                          ? 'approved'
                          : request.status
                      }
                      label={
                        tagSlugSet.has(request.slug) && request.status !== 'approved'
                          ? 'Resolved'
                          : request.status === 'pending'
                            ? 'Pending Review'
                            : request.status === 'approved'
                              ? 'Approved'
                              : 'Rejected'
                      }
                    />
                  </div>
                  <div className="mt-1 text-xs app-muted">/{request.slug}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {isSignedIn && (
          <section className="border app-border panel-bg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-[0.4em] app-muted">
                {isAdmin ? 'Create a new tag' : 'Request a new tag'}
              </div>
              <div className="text-[10px] uppercase tracking-[0.3em] app-muted">
                {isAdmin ? 'Instant publish' : 'Requires review'}
              </div>
            </div>
            <TagRequestForm
              action={createTagRequestAction}
              disabled={!isSignedIn}
              isAdmin={isAdmin}
            />
          </section>
        )}
      </div>
    </div>
  );
}
