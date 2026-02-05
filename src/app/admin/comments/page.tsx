import { revalidatePath } from 'next/cache';
import { getCaller } from '@/server/caller';
import { db } from '@/db';
import { comments, posts, user } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import EmptyState from '@/components/ui/empty-state';
import { Inbox, MessageSquare } from 'lucide-react';
import TimeStamp from '@/components/ui/time-stamp';
import AdminCommentRow from '@/components/admin/admin-comment-row';

async function approveCommentAction(formData: FormData) {
  'use server';
  const commentId = formData.get('commentId') as string | null;
  if (!commentId) return;
  const caller = await getCaller();
  await caller.admin.approveComment({ commentId });
  revalidatePath('/admin/comments');
}

async function rejectCommentAction(formData: FormData) {
  'use server';
  const commentId = formData.get('commentId') as string | null;
  if (!commentId) return;
  const caller = await getCaller();
  await caller.admin.rejectComment({ commentId });
  revalidatePath('/admin/comments');
}

async function approveCommentEditAction(formData: FormData) {
  'use server';
  const revisionId = formData.get('revisionId') as string | null;
  if (!revisionId) return;
  const caller = await getCaller();
  await caller.admin.approveCommentEdit({ revisionId });
  revalidatePath('/admin/comments');
}

async function rejectCommentEditAction(formData: FormData) {
  'use server';
  const revisionId = formData.get('revisionId') as string | null;
  if (!revisionId) return;
  const caller = await getCaller();
  await caller.admin.rejectCommentEdit({ revisionId });
  revalidatePath('/admin/comments');
}

async function editCommentAction(formData: FormData) {
  'use server';
  const commentId = formData.get('commentId') as string | null;
  const body = (formData.get('body') as string | null)?.trim() ?? '';
  if (!commentId || !body) return;
  const caller = await getCaller();
  await caller.admin.editComment({ commentId, body });
  revalidatePath('/admin/comments');
}

async function deleteCommentAction(formData: FormData) {
  'use server';
  const commentId = formData.get('commentId') as string | null;
  if (!commentId) return;
  const caller = await getCaller();
  await caller.admin.deleteComment({ commentId });
  revalidatePath('/admin/comments');
}

export default async function AdminComments() {
  const caller = await getCaller();
  const [pendingComments, pendingEdits, allComments] = await Promise.all([
    caller.admin.listPendingComments(),
    caller.admin.listPendingCommentEdits(),
    db
      .select({
        id: comments.id,
        body: comments.body,
        status: comments.status,
        createdAt: comments.createdAt,
        postSlug: posts.slug,
        postTitle: posts.title,
        authorName: user.name,
        authorEmail: user.email,
      })
      .from(comments)
      .leftJoin(posts, eq(comments.postId, posts.id))
      .leftJoin(user, eq(comments.authorId, user.id))
      .orderBy(desc(comments.createdAt)),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.4em] text-zinc-500">
          <MessageSquare className="h-4 w-4" />
          Comments
        </div>
        <h1 className="mt-4 text-3xl font-semibold">Comment Review Queue</h1>
        <p className="mt-2 text-zinc-400">
          Moderate new comments and edits before they appear publicly.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Pending Comments</h2>
        {pendingComments.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-5 w-5" />}
            title="No pending comments"
            description="New comments will appear here for review."
          />
        ) : (
          <div className="space-y-4">
            {pendingComments.map((comment) => (
              <div key={comment.id} className="border border-zinc-800 bg-zinc-950/60 p-4">
                <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">Comment</div>
                <div className="mt-2 text-sm text-zinc-400">Post ID: {comment.postId}</div>
                <p className="mt-2 text-sm text-zinc-200 whitespace-pre-line">{comment.body}</p>
                <div className="mt-4 flex gap-3">
                  <form action={approveCommentAction}>
                    <input type="hidden" name="commentId" value={comment.id} />
                    <button className="border border-[#00ff41]/40 px-3 py-1 text-xs uppercase tracking-[0.3em] text-[#00ff41] hover:bg-[#00ff41] hover:text-black transition">
                      Approve
                    </button>
                  </form>
                  <form action={rejectCommentAction}>
                    <input type="hidden" name="commentId" value={comment.id} />
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
        <h2 className="text-lg font-semibold">Pending Comment Edits</h2>
        {pendingEdits.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-5 w-5" />}
            title="No pending comment edits"
            description="Comment edits will show up here for approval."
          />
        ) : (
          <div className="space-y-4">
            {pendingEdits.map((revision) => (
              <div key={revision.id} className="border border-zinc-800 bg-zinc-950/60 p-4">
                <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">Edit Request</div>
                <div className="mt-2 text-sm text-zinc-400">Comment ID: {revision.commentId}</div>
                <p className="mt-2 text-sm text-zinc-200 whitespace-pre-line">{revision.body}</p>
                <div className="mt-4 flex gap-3">
                  <form action={approveCommentEditAction}>
                    <input type="hidden" name="revisionId" value={revision.id} />
                    <button className="border border-[#00ff41]/40 px-3 py-1 text-xs uppercase tracking-[0.3em] text-[#00ff41] hover:bg-[#00ff41] hover:text-black transition">
                      Approve
                    </button>
                  </form>
                  <form action={rejectCommentEditAction}>
                    <input type="hidden" name="revisionId" value={revision.id} />
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
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">All Comments</h2>
          <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
            Total: {allComments.length}
          </div>
        </div>
        {allComments.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-5 w-5" />}
            title="No comments yet"
            description="Approved comments will appear here with status."
          />
        ) : (
          <div className="space-y-4">
            {allComments.map((comment) => (
              <AdminCommentRow
                key={comment.id}
                id={comment.id}
                body={comment.body}
                status={comment.status}
                createdAt={comment.createdAt}
                postTitle={comment.postTitle}
                postSlug={comment.postSlug}
                authorName={comment.authorName}
                authorEmail={comment.authorEmail}
                onEdit={editCommentAction}
                onDelete={deleteCommentAction}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
