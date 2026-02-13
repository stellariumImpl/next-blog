import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { postTags, posts, tags, user } from '@/db/schema';
import MarkdownRenderer from '@/components/markdown/markdown-renderer';
import TimeStamp from '@/components/ui/time-stamp';

export default async function PendingPostPreviewPage({
  params,
}: {
  params: { postId: string };
}) {
  const [post] = await db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      excerpt: posts.excerpt,
      content: posts.content,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
      pendingTagSlugs: posts.pendingTagSlugs,
      authorName: user.name,
      authorEmail: user.email,
    })
    .from(posts)
    .leftJoin(user, eq(posts.authorId, user.id))
    .where(and(eq(posts.id, params.postId), eq(posts.status, 'pending')))
    .limit(1);

  if (!post) {
    notFound();
  }

  const approvedTags = await db
    .select({ name: tags.name, slug: tags.slug })
    .from(postTags)
    .innerJoin(tags, eq(postTags.tagId, tags.id))
    .where(eq(postTags.postId, post.id));

  const pendingTagSlugs = post.pendingTagSlugs ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">Pending Post Preview</div>
          <h1 className="mt-2 text-2xl font-semibold text-white break-all">{post.title}</h1>
          <div className="mt-2 text-xs text-zinc-500">
            Author: {post.authorName ?? post.authorEmail ?? 'Unknown'} · Created{' '}
            <TimeStamp value={post.createdAt} /> · Updated <TimeStamp value={post.updatedAt} />
          </div>
        </div>
        <Link
          href="/admin/posts"
          className="border border-zinc-700 px-3 py-1 text-xs uppercase tracking-[0.3em] text-zinc-200 hover:bg-zinc-800 transition"
        >
          Back
        </Link>
      </div>

      {(approvedTags.length > 0 || pendingTagSlugs.length > 0) && (
        <div className="border border-zinc-800 bg-zinc-950/60 p-4">
          <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">Tags</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {approvedTags.map((tag) => (
              <span
                key={`approved-${tag.slug}`}
                className="border border-[#00ff41]/40 px-2 py-1 text-xs uppercase tracking-[0.2em] text-[#00ff41]"
              >
                {tag.name}
              </span>
            ))}
            {pendingTagSlugs.map((slug) => (
              <span
                key={`pending-${slug}`}
                className="border border-zinc-700 px-2 py-1 text-xs uppercase tracking-[0.2em] text-zinc-300"
              >
                {slug} (pending)
              </span>
            ))}
          </div>
        </div>
      )}

      {post.excerpt && (
        <div className="border border-zinc-800 bg-zinc-950/60 p-4">
          <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">Excerpt</div>
          <p className="mt-2 text-sm text-zinc-300 break-all">{post.excerpt}</p>
        </div>
      )}

      <article className="border border-zinc-800 bg-zinc-950/60 p-6">
        <div className="markdown-content">
          <MarkdownRenderer content={post.content || 'No content provided.'} />
        </div>
      </article>
    </div>
  );
}
