import { revalidatePath } from 'next/cache';
import { desc } from 'drizzle-orm';
import { db } from '@/db';
import { posts } from '@/db/schema';
import { getCaller } from '@/server/caller';
import EmptyState from '@/components/ui/empty-state';
import StatusPill from '@/components/ui/status-pill';
import { Inbox, FileCheck, Layers } from 'lucide-react';
import Link from 'next/link';

async function approvePostAction(formData: FormData) {
  'use server';
  const postId = formData.get('postId') as string | null;
  const slug = formData.get('slug') as string | null;
  if (!postId) return;
  const caller = await getCaller();
  await caller.admin.approvePost({ postId });
  revalidatePath('/admin/posts');
  revalidatePath('/');
  revalidatePath('/archive');
  revalidatePath('/account');
  if (slug) revalidatePath(`/posts/${slug}`);
}

async function rejectPostAction(formData: FormData) {
  'use server';
  const postId = formData.get('postId') as string | null;
  const slug = formData.get('slug') as string | null;
  if (!postId) return;
  const caller = await getCaller();
  await caller.admin.rejectPost({ postId });
  revalidatePath('/admin/posts');
  revalidatePath('/account');
  if (slug) revalidatePath(`/posts/${slug}`);
}

async function approvePostEditAction(formData: FormData) {
  'use server';
  const revisionId = formData.get('revisionId') as string | null;
  const slug = formData.get('slug') as string | null;
  if (!revisionId) return;
  const caller = await getCaller();
  await caller.admin.approvePostEdit({ revisionId });
  revalidatePath('/admin/posts');
  revalidatePath('/');
  revalidatePath('/archive');
  revalidatePath('/account');
  if (slug) revalidatePath(`/posts/${slug}`);
}

async function rejectPostEditAction(formData: FormData) {
  'use server';
  const revisionId = formData.get('revisionId') as string | null;
  const slug = formData.get('slug') as string | null;
  if (!revisionId) return;
  const caller = await getCaller();
  await caller.admin.rejectPostEdit({ revisionId });
  revalidatePath('/admin/posts');
  revalidatePath('/account');
  if (slug) revalidatePath(`/posts/${slug}`);
}

async function deletePostAction(formData: FormData) {
  'use server';
  const postId = formData.get('postId') as string | null;
  const slug = formData.get('slug') as string | null;
  if (!postId) return;
  const caller = await getCaller();
  await caller.admin.deletePost({ postId });
  revalidatePath('/admin/posts');
  revalidatePath('/');
  revalidatePath('/archive');
  revalidatePath('/account');
  if (slug) revalidatePath(`/posts/${slug}`);
}

export default async function AdminPosts() {
  const caller = await getCaller();
  const [pendingPosts, pendingEdits, allPosts] = await Promise.all([
    caller.admin.listPendingPosts(),
    caller.admin.listPendingPostEdits(),
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
      .orderBy(desc(posts.createdAt)),
  ]);
  let dbHost = '';
  let dbName = '';
  let dbHint = '';
  try {
    const url = new URL(process.env.DATABASE_URL ?? '');
    dbHost = url.host;
    dbName = url.pathname.replace('/', '');
  } catch {
    dbHint = 'DATABASE_URL missing or invalid';
  }

  return (
    <div className="space-y-10">
      <div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.4em] text-zinc-500">
          <FileCheck className="h-4 w-4" />
          Posts
        </div>
        <h1 className="mt-4 text-3xl font-semibold">Post Review Queue</h1>
        <p className="mt-2 text-zinc-400">
          Approve new submissions and review edits before publishing.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Pending Posts</h2>
        {pendingPosts.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-5 w-5" />}
            title="No pending posts"
            description="New submissions will appear here for review."
          />
        ) : (
          <div className="space-y-4">
            {pendingPosts.map((post) => (
              <div key={post.id} className="border border-zinc-800 bg-zinc-950/60 p-4">
                <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">Draft</div>
                <div className="mt-2 text-lg font-semibold text-white">{post.title}</div>
                {post.excerpt && <p className="mt-2 text-sm text-zinc-400">{post.excerpt}</p>}
                <div className="mt-4 flex gap-3">
                  <form action={approvePostAction}>
                    <input type="hidden" name="postId" value={post.id} />
                    <input type="hidden" name="slug" value={post.slug} />
                    <button className="border border-[#00ff41]/40 px-3 py-1 text-xs uppercase tracking-[0.3em] text-[#00ff41] hover:bg-[#00ff41] hover:text-black transition">
                      Approve
                    </button>
                  </form>
                  <form action={rejectPostAction}>
                    <input type="hidden" name="postId" value={post.id} />
                    <input type="hidden" name="slug" value={post.slug} />
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
        <h2 className="text-lg font-semibold">Pending Post Edits</h2>
        {pendingEdits.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-5 w-5" />}
            title="No pending edits"
            description="Post edits will show up here for approval."
          />
        ) : (
          <div className="space-y-4">
            {pendingEdits.map((revision) => (
              <div key={revision.id} className="border border-zinc-800 bg-zinc-950/60 p-4">
                <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">Edit Request</div>
                <div className="mt-2 text-sm text-zinc-400">
                  Post: {revision.postTitle ?? revision.postId}
                </div>
                {revision.title && (
                  <div className="mt-2">
                    <div className="text-xs uppercase text-zinc-500">Title</div>
                    <div className="text-white">{revision.title}</div>
                  </div>
                )}
                {revision.excerpt && (
                  <div className="mt-2">
                    <div className="text-xs uppercase text-zinc-500">Excerpt</div>
                    <div className="text-zinc-400">{revision.excerpt}</div>
                  </div>
                )}
                {revision.content && (
                  <div className="mt-2">
                    <div className="text-xs uppercase text-zinc-500">Content</div>
                    <div className="text-zinc-400 whitespace-pre-line">{revision.content}</div>
                  </div>
                )}
                <div className="mt-4 flex gap-3">
                  <form action={approvePostEditAction}>
                    <input type="hidden" name="revisionId" value={revision.id} />
                    <input type="hidden" name="slug" value={revision.slug} />
                    <button className="border border-[#00ff41]/40 px-3 py-1 text-xs uppercase tracking-[0.3em] text-[#00ff41] hover:bg-[#00ff41] hover:text-black transition">
                      Approve
                    </button>
                  </form>
                  <form action={rejectPostEditAction}>
                    <input type="hidden" name="revisionId" value={revision.id} />
                    <input type="hidden" name="slug" value={revision.slug} />
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
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.4em] text-zinc-500">
          <Layers className="h-4 w-4" />
          All Posts
        </div>
        <div className="text-xs uppercase tracking-[0.3em] text-zinc-600">
          DB:{' '}
          {dbHost ? `${dbHost}/${dbName || 'unknown'}` : 'unknown'} · Total:{' '}
          {allPosts.length}
          {dbHint ? ` · ${dbHint}` : ''}
        </div>
        {allPosts.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-5 w-5" />}
            title="No posts yet"
            description="Approved posts will appear here with their status."
          />
        ) : (
          <div className="space-y-3">
            {allPosts.map((post) => (
              <div key={post.id} className="border border-zinc-800 bg-zinc-950/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                      {post.publishedAt ? "Published" : "Created"}
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      {post.title}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">{post.slug}</div>
                  </div>
                  <StatusPill status={post.status} />
                </div>
                <div className="mt-4 flex gap-3">
                  <Link
                    href={`/posts/${post.slug}/edit`}
                    className="border border-[#00ff41]/40 px-3 py-1 text-xs uppercase tracking-[0.3em] text-[#00ff41] hover:bg-[#00ff41] hover:text-black transition"
                  >
                    Edit
                  </Link>
                  <form action={deletePostAction}>
                    <input type="hidden" name="postId" value={post.id} />
                    <input type="hidden" name="slug" value={post.slug} />
                    <button className="border border-red-500/40 px-3 py-1 text-xs uppercase tracking-[0.3em] text-red-400 hover:bg-red-500 hover:text-black transition">
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
