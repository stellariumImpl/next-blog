import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { postRevisions, postTags, posts, tags, user } from '@/db/schema';
import MarkdownRenderer from '@/components/markdown/markdown-renderer';
import TimeStamp from '@/components/ui/time-stamp';

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export default async function PendingPostRevisionPreviewPage({
  params,
}: {
  params: { revisionId: string };
}) {
  const [revision] = await db
    .select({
      id: postRevisions.id,
      postId: postRevisions.postId,
      title: postRevisions.title,
      excerpt: postRevisions.excerpt,
      content: postRevisions.content,
      tagIds: postRevisions.tagIds,
      tagNames: postRevisions.tagNames,
      createdAt: postRevisions.createdAt,
      postSlug: posts.slug,
      postTitle: posts.title,
      postExcerpt: posts.excerpt,
      postContent: posts.content,
      authorName: user.name,
      authorEmail: user.email,
    })
    .from(postRevisions)
    .innerJoin(posts, eq(postRevisions.postId, posts.id))
    .leftJoin(user, eq(postRevisions.authorId, user.id))
    .where(and(eq(postRevisions.id, params.revisionId), eq(postRevisions.status, 'pending')))
    .limit(1);

  if (!revision) {
    notFound();
  }

  const currentTagRows = await db
    .select({ name: tags.name })
    .from(postTags)
    .innerJoin(tags, eq(postTags.tagId, tags.id))
    .where(eq(postTags.postId, revision.postId));

  const currentTags = currentTagRows.map((row) => row.name);

  const revisionTagIds = revision.tagIds ?? [];
  const revisionTagIdRows =
    revisionTagIds.length > 0
      ? await db
          .select({ name: tags.name })
          .from(tags)
          .where(inArray(tags.id, revisionTagIds))
      : [];

  const proposedTags =
    revision.tagIds !== undefined || revision.tagNames !== undefined
      ? unique([
          ...revisionTagIdRows.map((row) => row.name),
          ...((revision.tagNames ?? []) as string[]),
        ])
      : currentTags;

  const proposedTitle = revision.title ?? revision.postTitle;
  const proposedExcerpt = revision.excerpt ?? revision.postExcerpt;
  const proposedContent = revision.content ?? revision.postContent;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">Pending Edit Preview</div>
          <h1 className="mt-2 text-2xl font-semibold text-white">{revision.postTitle}</h1>
          <div className="mt-2 text-xs text-zinc-500">
            Editor: {revision.authorName ?? revision.authorEmail ?? 'Unknown'} · Submitted{' '}
            <TimeStamp value={revision.createdAt} />
          </div>
        </div>
        <Link
          href="/admin/posts"
          className="border border-zinc-700 px-3 py-1 text-xs uppercase tracking-[0.3em] text-zinc-200 hover:bg-zinc-800 transition"
        >
          Back
        </Link>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="border border-zinc-800 bg-zinc-950/60 p-4">
          <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">Current</div>
          <div className="mt-3 space-y-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Title</div>
              <div className="mt-1 text-sm text-white">{revision.postTitle}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Excerpt</div>
              <div className="mt-1 text-sm text-zinc-300">{revision.postExcerpt || 'No excerpt.'}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Tags</div>
              <div className="mt-1 flex flex-wrap gap-2">
                {currentTags.length > 0 ? (
                  currentTags.map((name) => (
                    <span key={`current-${name}`} className="border border-zinc-700 px-2 py-1 text-xs text-zinc-300">
                      {name}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-zinc-500">No tags.</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="border border-[#00ff41]/30 bg-zinc-950/60 p-4">
          <div className="text-xs uppercase tracking-[0.3em] text-[#00ff41]">Proposed</div>
          <div className="mt-3 space-y-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Title</div>
              <div className="mt-1 text-sm text-white">{proposedTitle}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Excerpt</div>
              <div className="mt-1 text-sm text-zinc-300">{proposedExcerpt || 'No excerpt.'}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Tags</div>
              <div className="mt-1 flex flex-wrap gap-2">
                {proposedTags.length > 0 ? (
                  proposedTags.map((name) => (
                    <span
                      key={`proposed-${name}`}
                      className="border border-[#00ff41]/40 px-2 py-1 text-xs text-[#00ff41]"
                    >
                      {name}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-zinc-500">No tags.</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">Proposed Article Preview</div>
        <article className="border border-zinc-800 bg-zinc-950/60 p-6">
          <div className="markdown-content">
            <MarkdownRenderer content={proposedContent || 'No content provided.'} />
          </div>
        </article>
      </section>

      <div className="flex gap-3">
        <Link
          href={`/posts/${revision.postSlug}`}
          className="border border-zinc-700 px-3 py-1 text-xs uppercase tracking-[0.3em] text-zinc-200 hover:bg-zinc-800 transition"
        >
          Open live post
        </Link>
      </div>
    </div>
  );
}
