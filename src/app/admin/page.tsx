import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  comments,
  commentRevisions,
  postRevisions,
  posts,
  tagRequests,
  tagRevisions,
} from '@/db/schema';
import EmptyState from '@/components/ui/empty-state';
import { Inbox, Shield } from 'lucide-react';
import Link from 'next/link';

export default async function AdminHome() {
  const [pendingPosts] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(posts)
    .where(eq(posts.status, 'pending'))
    .limit(1);
  const [pendingPostEdits] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(postRevisions)
    .where(eq(postRevisions.status, 'pending'))
    .limit(1);
  const [pendingComments] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(comments)
    .where(eq(comments.status, 'pending'))
    .limit(1);
  const [pendingCommentEdits] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(commentRevisions)
    .where(eq(commentRevisions.status, 'pending'))
    .limit(1);
  const [pendingTags] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(tagRequests)
    .where(eq(tagRequests.status, 'pending'))
    .limit(1);
  const [pendingTagEdits] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(tagRevisions)
    .where(eq(tagRevisions.status, 'pending'))
    .limit(1);

  const totalPending =
    (pendingPosts?.count ?? 0) +
    (pendingPostEdits?.count ?? 0) +
    (pendingComments?.count ?? 0) +
    (pendingCommentEdits?.count ?? 0) +
    (pendingTags?.count ?? 0) +
    (pendingTagEdits?.count ?? 0);

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.4em] text-zinc-500">
          <Shield className="h-4 w-4" />
          Admin Console
        </div>
        <h1 className="mt-4 text-3xl font-semibold">Editorial Overview</h1>
        <p className="mt-2 text-zinc-400">
          Monitor submissions, reviews, and user requests across the platform.
        </p>
      </div>

      {totalPending === 0 ? (
        <EmptyState
          icon={<Inbox className="h-5 w-5" />}
          title="No pending reviews"
          description="Everything is reviewed and up to date."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <Link
            href="/admin/posts"
            className="border border-zinc-800 rounded p-4 bg-zinc-900/40 hover:border-[#00ff41] transition"
          >
            <div className="text-xs uppercase text-zinc-500">Posts</div>
            <div className="mt-2 text-lg">Review pending posts and edits</div>
          </Link>
          <Link
            href="/admin/comments"
            className="border border-zinc-800 rounded p-4 bg-zinc-900/40 hover:border-[#00ff41] transition"
          >
            <div className="text-xs uppercase text-zinc-500">Comments</div>
            <div className="mt-2 text-lg">Approve or reject comment activity</div>
          </Link>
          <Link
            href="/admin/tags"
            className="border border-zinc-800 rounded p-4 bg-zinc-900/40 hover:border-[#00ff41] transition"
          >
            <div className="text-xs uppercase text-zinc-500">Tags</div>
            <div className="mt-2 text-lg">Manage taxonomy requests</div>
          </Link>
        </div>
      )}
    </div>
  );
}
