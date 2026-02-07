import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { ensureUserProfile } from "@/lib/user-profile";
import { db } from "@/db";
import {
  commentRevisions,
  comments,
  postRevisions,
  postTags,
  postLikes,
  posts,
  tags,
  user,
  userProfiles,
} from "@/db/schema";
import { type CommentState } from "@/components/forms/comment-form";
import CommentThread from "@/components/comments/comment-thread";
import { getCaller } from "@/server/caller";
import { getTheme } from "@/lib/theme";
import SiteHeader from "@/components/site-header";
import StatusPill from "@/components/ui/status-pill";
import MarkdownRenderer from "@/components/markdown/markdown-renderer";
import PostToc from "@/components/post-toc";
import { extractHeadings } from "@/lib/markdown";
import PostEngagement from "@/components/post-engagement";
import TimeStamp from "@/components/ui/time-stamp";

async function createCommentAction(
  postId: string,
  slug: string,
  prevState: CommentState,
  formData: FormData,
): Promise<CommentState> {
  "use server";

  const body = (formData.get("body") as string | null)?.trim() ?? "";
  const idempotencyKey =
    (formData.get("idempotencyKey") as string | null)?.trim() ?? "";
  const parentId =
    (formData.get("parentId") as string | null)?.trim() || undefined;
  if (!body) {
    return { ok: false, message: "Comment body is required." };
  }
  if (!idempotencyKey) {
    return { ok: false, message: "Missing submission key." };
  }

  try {
    const caller = await getCaller();
    const created = await caller.comments.submit({
      postId,
      body,
      parentId,
      idempotencyKey,
    });
    const message =
      created?.status === "approved"
        ? "Comment published."
        : "Comment submitted for review.";
    revalidatePath(`/posts/${slug}`);
    return { ok: true, message };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Comment failed.";
    return { ok: false, message };
  }
}

async function editCommentAction(
  slug: string,
  commentId: string,
  prevState: CommentState,
  formData: FormData,
): Promise<CommentState> {
  "use server";

  const body = (formData.get("body") as string | null)?.trim() ?? "";
  const idempotencyKey =
    (formData.get("idempotencyKey") as string | null)?.trim() ?? "";
  if (!body) {
    return { ok: false, message: "Comment body is required." };
  }
  if (!idempotencyKey) {
    return { ok: false, message: "Missing submission key." };
  }

  try {
    const caller = await getCaller();
    const updated = await caller.comments.requestEdit({
      commentId,
      body,
      idempotencyKey,
    });
    const message =
      updated && "status" in updated && updated.status !== "applied"
        ? "Edit submitted for review."
        : "Comment updated.";
    revalidatePath(`/posts/${slug}`);
    revalidatePath("/account");
    return { ok: true, message };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Edit failed.";
    return { ok: false, message };
  }
}

export default async function PostPage({
  params,
}: {
  params: { slug: string };
}) {
  const theme = getTheme();
  const proseClass =
    "prose max-w-none [color:var(--text-muted-strong)] prose-headings:[color:var(--app-text)] prose-strong:[color:var(--app-text)] prose-a:text-[color:var(--accent)]";
  const session = await auth.api.getSession({ headers: await headers() });
  const viewerId = session?.user?.id ?? null;
  const viewerProfile = session?.user
    ? await ensureUserProfile({
        id: session.user.id,
        email: session.user.email,
      })
    : null;
  const viewer = session?.user
    ? {
        email: session.user.email,
        role: viewerProfile?.role ?? "user",
        name: session.user.name ?? undefined,
        image: session.user.image ?? undefined,
      }
    : null;
  const isAdmin = viewer?.role === "admin";
  const [post] = await db
    .select({
      id: posts.id,
      authorId: posts.authorId,
      title: posts.title,
      excerpt: posts.excerpt,
      content: posts.content,
      createdAt: posts.createdAt,
      publishedAt: posts.publishedAt,
      updatedAt: posts.updatedAt,
      status: posts.status,
      views: posts.views,
    })
    .from(posts)
    .where(eq(posts.slug, params.slug))
    .limit(1);

  if (
    !post ||
    (post.status !== "published" &&
      post.authorId !== viewerId &&
      viewer?.role !== "admin")
  ) {
    notFound();
  }

  const isAuthor = viewerId && viewerId === post.authorId;
  const edited =
    post.createdAt &&
    post.updatedAt &&
    new Date(post.updatedAt).getTime() - new Date(post.createdAt).getTime() >
      60_000;

  const tagRows = await db
    .select({ name: tags.name, slug: tags.slug })
    .from(postTags)
    .innerJoin(tags, eq(postTags.tagId, tags.id))
    .where(eq(postTags.postId, post.id));

  const [latestRevision] = isAuthor
    ? await db
        .select({
          status: postRevisions.status,
          createdAt: postRevisions.createdAt,
        })
        .from(postRevisions)
        .where(
          and(
            eq(postRevisions.postId, post.id),
            eq(postRevisions.authorId, viewerId!),
          ),
        )
        .orderBy(desc(postRevisions.createdAt))
        .limit(1)
    : [];

  const commentFilter = isAdmin
    ? eq(comments.postId, post.id)
    : viewerId
      ? and(
          eq(comments.postId, post.id),
          or(eq(comments.status, "approved"), eq(comments.authorId, viewerId)),
        )
      : and(eq(comments.postId, post.id), eq(comments.status, "approved"));

  const visibleComments = await db
    .select({
      id: comments.id,
      authorId: comments.authorId,
      body: comments.body,
      createdAt: comments.createdAt,
      status: comments.status,
      parentId: comments.parentId,
      updatedAt: comments.updatedAt,
      authorName: user.name,
      authorEmail: user.email,
      authorImage: user.image,
      authorRole: userProfiles.role,
    })
    .from(comments)
    .leftJoin(user, eq(comments.authorId, user.id))
    .leftJoin(userProfiles, eq(comments.authorId, userProfiles.userId))
    .where(commentFilter)
    .orderBy(desc(comments.createdAt));

  const commentIds = visibleComments.map((comment) => comment.id);
  const commentEdits =
    viewerId && commentIds.length > 0
      ? await db
          .select({
            commentId: commentRevisions.commentId,
            body: commentRevisions.body,
            status: commentRevisions.status,
            createdAt: commentRevisions.createdAt,
          })
          .from(commentRevisions)
          .where(
            and(
              inArray(commentRevisions.commentId, commentIds),
              eq(commentRevisions.authorId, viewerId),
            ),
          )
          .orderBy(desc(commentRevisions.createdAt))
      : [];

  const latestCommentEdit = new Map<
    string,
    { body: string; status: "pending" | "approved" | "rejected" }
  >();
  commentEdits.forEach((edit) => {
    if (!latestCommentEdit.has(edit.commentId)) {
      latestCommentEdit.set(edit.commentId, {
        body: edit.body,
        status: edit.status,
      });
    }
  });

  const displayComments = visibleComments.map((comment) => {
    const edit = latestCommentEdit.get(comment.id);
    if (!edit || edit.status === "approved") {
      return comment;
    }
    return {
      ...comment,
      body: edit.body,
      status: edit.status,
    };
  });

  const isSignedIn = !!session?.user;
  const canComment = isSignedIn && post.status === "published";
  const headings = extractHeadings(post.content ?? "", {
    minLevel: 2,
    maxLevel: 4,
  });
  const hasToc = headings.length > 0;

  const [likeCount] = await db
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(postLikes)
    .where(eq(postLikes.postId, post.id));

  const [viewerLike] = viewerId
    ? await db
        .select({ postId: postLikes.postId })
        .from(postLikes)
        .where(
          and(eq(postLikes.postId, post.id), eq(postLikes.userId, viewerId)),
        )
        .limit(1)
    : [];

  return (
    <div className="min-h-screen app-bg">
      <SiteHeader viewer={viewer} initialTheme={theme} />
      <div className="max-w-6xl mx-auto px-6 sm:px-6 pt-24 pb-28 sm:pb-24">
        <div
          className={
            hasToc
              ? "grid gap-8 xl:grid-cols-[minmax(0,1fr)_260px]"
              : "grid gap-8"
          }
        >
          <div className="space-y-10">
            <div>
              <div className="text-xs uppercase tracking-[0.4em] app-muted">
                Article
              </div>
              <h1 className="mt-4 text-4xl font-black">{post.title}</h1>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-4 text-sm app-muted-strong">
                <span>
                  {post.status === "published" && post.publishedAt && (
                    <>
                      Published <TimeStamp value={post.publishedAt} /> ·{" "}
                    </>
                  )}
                  Updated <TimeStamp value={post.updatedAt} />
                  {edited && (
                    <span className="ml-2 text-[10px] uppercase tracking-[0.3em] text-[color:var(--accent)]">
                      Edited
                    </span>
                  )}
                </span>
                {(isAuthor || isAdmin) && (
                  <Link
                    href={`/posts/${params.slug}/edit`}
                    className="text-xs uppercase tracking-[0.3em] text-[#00ff41] border border-[#00ff41]/40 px-2 py-1 hover:bg-[#00ff41] hover:text-black transition"
                  >
                    Edit
                  </Link>
                )}
              </div>
              <PostEngagement
                postId={post.id}
                initialViews={post.views ?? 0}
                initialLikes={likeCount?.total ?? 0}
                initialLiked={Boolean(viewerLike)}
                canLike={Boolean(viewerId) && post.status === "published"}
                trackView={post.status === "published"}
                showSignIn={!viewerId}
              />
              {post.status !== "published" && (
                <div className="mt-6 border app-border panel-bg p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs uppercase tracking-[0.3em] app-muted">
                      Visibility
                    </div>
                    <StatusPill
                      status={post.status}
                      label={
                        post.status === "pending"
                          ? "Pending Review"
                          : "Rejected"
                      }
                    />
                  </div>
                  <p className="mt-2 text-sm app-muted-strong">
                    This post is only visible to you until moderation is
                    complete.
                  </p>
                </div>
              )}
              {isAuthor &&
                latestRevision &&
                latestRevision.status !== "approved" && (
                  <div className="mt-4 border app-border panel-bg p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs uppercase tracking-[0.3em] app-muted">
                        Update status
                      </div>
                      <StatusPill
                        status={latestRevision.status}
                        label={
                          latestRevision.status === "pending"
                            ? "Pending Update"
                            : "Update Rejected"
                        }
                      />
                    </div>
                    <p className="mt-2 text-sm app-muted-strong">
                      Latest update submitted{" "}
                      <TimeStamp value={latestRevision.createdAt} />.
                    </p>
                  </div>
                )}
              {tagRows.length > 0 && (
                <div className="mt-4 flex gap-2 flex-wrap">
                  {tagRows.map((tag) => (
                    <Link
                      key={tag.slug}
                      href={`/tags/${tag.slug}`}
                      className="text-xs text-[#00ff41] hover:text-[color:var(--app-text)] transition"
                    >
                      # {tag.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <article className={proseClass}>
              <div className="markdown-content">
                <MarkdownRenderer
                  content={
                    post.content ||
                    "Content will be available after editorial approval."
                  }
                />
              </div>
            </article>

            <CommentThread
              comments={displayComments}
              isSignedIn={isSignedIn}
              canComment={canComment}
              isAdmin={isAdmin}
              viewerId={viewerId}
              action={createCommentAction.bind(null, post.id, params.slug)}
              editAction={editCommentAction.bind(null, params.slug)}
            />
          </div>
          {hasToc && <PostToc headings={headings} />}
        </div>
      </div>
    </div>
  );
}
