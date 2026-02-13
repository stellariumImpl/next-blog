import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { desc } from 'drizzle-orm';
import { db } from '@/db';
import { tags } from '@/db/schema';
import { getCaller } from '@/server/caller';
import EmptyState from '@/components/ui/empty-state';
import { Inbox, Tag as TagIcon } from 'lucide-react';

async function approveTagAction(formData: FormData) {
  'use server';
  const requestId = formData.get('requestId') as string | null;
  if (!requestId) return;
  const caller = await getCaller();
  await caller.admin.approveTagRequest({ requestId });
  revalidatePath('/admin/tags');
  revalidatePath('/tags');
  revalidatePath('/');
}

async function rejectTagAction(formData: FormData) {
  'use server';
  const requestId = formData.get('requestId') as string | null;
  if (!requestId) return;
  const caller = await getCaller();
  await caller.admin.rejectTagRequest({ requestId });
  revalidatePath('/admin/tags');
}

async function approveTagEditAction(formData: FormData) {
  'use server';
  const revisionId = formData.get('revisionId') as string | null;
  if (!revisionId) return;
  const caller = await getCaller();
  await caller.admin.approveTagEdit({ revisionId });
  revalidatePath('/admin/tags');
  revalidatePath('/tags');
  revalidatePath('/');
}

async function rejectTagEditAction(formData: FormData) {
  'use server';
  const revisionId = formData.get('revisionId') as string | null;
  if (!revisionId) return;
  const caller = await getCaller();
  await caller.admin.rejectTagEdit({ revisionId });
  revalidatePath('/admin/tags');
}

async function deleteTagsAction(formData: FormData) {
  'use server';
  const tagIds = Array.from(
    new Set(
      formData
        .getAll('tagIds')
        .map((value) => String(value))
        .filter(Boolean)
    )
  );
  if (tagIds.length === 0) return;
  const caller = await getCaller();
  await caller.admin.deleteTags({ tagIds });
  revalidatePath('/admin/tags');
  revalidatePath('/tags');
  revalidatePath('/');
}

export default async function AdminTags() {
  const caller = await getCaller();
  const [requests, edits, tagList] = await Promise.all([
    caller.admin.listTagRequests(),
    caller.admin.listTagEdits(),
    db.select().from(tags).orderBy(desc(tags.createdAt)),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.4em] text-zinc-500">
          <TagIcon className="h-4 w-4" />
          Tags
        </div>
        <h1 className="mt-4 text-3xl font-semibold">Tag Governance</h1>
        <p className="mt-2 text-zinc-400">
          Review tag requests and maintain the taxonomy list.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Pending Tag Requests</h2>
        {requests.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-5 w-5" />}
            title="No tag requests"
            description="New tag requests will appear here for review."
          />
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <div key={request.id} className="border border-zinc-800 bg-zinc-950/60 p-4">
                <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">Request</div>
                <div className="mt-2 text-lg font-semibold text-white">{request.name}</div>
                <div className="text-xs text-zinc-500">/{request.slug}</div>
                <div className="mt-4 flex gap-3">
                  <form action={approveTagAction}>
                    <input type="hidden" name="requestId" value={request.id} />
                    <button className="border border-[#00ff41]/40 px-3 py-1 text-xs uppercase tracking-[0.3em] text-[#00ff41] hover:bg-[#00ff41] hover:text-black transition">
                      Approve
                    </button>
                  </form>
                  <form action={rejectTagAction}>
                    <input type="hidden" name="requestId" value={request.id} />
                    <button className="border border-red-500/40 px-3 py-1 text-xs uppercase tracking-[0.3em] text-red-400 hover:bg-red-500 hover:text-black transition">
                      Reject
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Pending Tag Edits</h2>
        {edits.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-5 w-5" />}
            title="No tag edits"
            description="Tag edit requests will appear here for review."
          />
        ) : (
          <div className="space-y-4">
            {edits.map((edit) => (
              <div key={edit.id} className="border border-zinc-800 bg-zinc-950/60 p-4">
                <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">Edit</div>
                <div className="mt-2 text-lg font-semibold text-white">{edit.currentName}</div>
                <div className="text-xs text-zinc-500">/{edit.currentSlug}</div>
                <div className="mt-4 border-t border-zinc-800 pt-3">
                  <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                    Proposed update
                  </div>
                  <div className="mt-2 text-sm text-white">{edit.name}</div>
                  <div className="text-xs text-zinc-500">/{edit.slug}</div>
                </div>
                <div className="mt-4 flex gap-3">
                  <form action={approveTagEditAction}>
                    <input type="hidden" name="revisionId" value={edit.id} />
                    <button className="border border-[#00ff41]/40 px-3 py-1 text-xs uppercase tracking-[0.3em] text-[#00ff41] hover:bg-[#00ff41] hover:text-black transition">
                      Approve
                    </button>
                  </form>
                  <form action={rejectTagEditAction}>
                    <input type="hidden" name="revisionId" value={edit.id} />
                    <button className="border border-red-500/40 px-3 py-1 text-xs uppercase tracking-[0.3em] text-red-400 hover:bg-red-500 hover:text-black transition">
                      Reject
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Approved Tags</h2>
          <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">
            Select tags then batch delete
          </p>
        </div>
        {tagList.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-5 w-5" />}
            title="No approved tags"
            description="Approved tags will appear in this list."
          />
        ) : (
          <form action={deleteTagsAction} className="space-y-4">
            <div className="flex justify-end">
              <button
                className="border border-red-500/40 px-3 py-1 text-xs uppercase tracking-[0.3em] text-red-400 hover:bg-red-500 hover:text-black transition"
                type="submit"
              >
                Delete Selected
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {tagList.map((tag) => (
                <label
                  key={tag.id}
                  className="border border-zinc-800 bg-zinc-950/60 p-4 flex cursor-pointer gap-3"
                >
                  <input
                    type="checkbox"
                    name="tagIds"
                    value={tag.id}
                    className="mt-1 h-4 w-4 accent-[#00ff41]"
                  />
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">Tag</div>
                    <div className="mt-2 text-lg font-semibold text-white">{tag.name}</div>
                    <div className="text-xs text-zinc-500">/{tag.slug}</div>
                    <div className="mt-4 flex gap-3">
                      <Link
                        href={`/tags/${tag.slug}`}
                        className="border border-[#00ff41]/40 px-3 py-1 text-xs uppercase tracking-[0.3em] text-[#00ff41] hover:bg-[#00ff41] hover:text-black transition"
                      >
                        Edit
                      </Link>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
