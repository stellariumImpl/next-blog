"use client";

import {
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import {
  CornerUpLeft,
  Link2,
  MessageSquare,
  ArrowDownUp,
  Check,
  Pencil,
} from "lucide-react";
import Link from "next/link";
import CommentForm, {
  type CommentState,
} from "@/components/forms/comment-form";
import StatusPill from "@/components/ui/status-pill";
import TimeStamp from "@/components/ui/time-stamp";

type CommentItem = {
  id: string;
  body: string;
  createdAt: string | Date;
  updatedAt?: string | Date | null;
  status: "pending" | "approved" | "rejected";
  parentId?: string | null;
  authorId?: string | null;
  authorName?: string | null;
  authorEmail?: string | null;
  authorImage?: string | null;
  authorRole?: "admin" | "user" | null;
};

type CommentWithChildren = CommentItem & { children?: CommentWithChildren[] };

function isEdited(createdAt: string | Date, updatedAt?: string | Date | null) {
  if (!updatedAt) return false;
  const created = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  const updated = typeof updatedAt === "string" ? new Date(updatedAt) : updatedAt;
  if (Number.isNaN(created.getTime()) || Number.isNaN(updated.getTime())) return false;
  return updated.getTime() - created.getTime() > 60_000;
}

function getInitials(value?: string | null) {
  if (!value) return "U";
  const trimmed = value.trim();
  if (!trimmed) return "U";
  return trimmed.slice(0, 1).toUpperCase();
}

function getDisplayName(comment: CommentItem) {
  return (
    comment.authorName || comment.authorEmail?.split("@")[0] || "Unknown user"
  );
}

function flattenReplies(items: CommentWithChildren[], parentName: string) {
  const flat: { comment: CommentItem; replyTo: string }[] = [];
  items.forEach((item) => {
    flat.push({ comment: item, replyTo: parentName });
    if (item.children?.length) {
      flat.push(...flattenReplies(item.children, getDisplayName(item)));
    }
  });
  return flat;
}

export default function CommentThread({
  comments,
  isSignedIn,
  isAdmin,
  viewerId,
  canComment,
  action,
  editAction,
}: {
  comments: CommentItem[];
  isSignedIn: boolean;
  isAdmin: boolean;
  viewerId?: string | null;
  canComment?: boolean;
  action: (
    prevState: CommentState,
    formData: FormData,
  ) => Promise<CommentState>;
  editAction?: (
    commentId: string,
    prevState: CommentState,
    formData: FormData,
  ) => Promise<CommentState>;
}) {
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [replyDraft, setReplyDraft] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [deepExpanded, setDeepExpanded] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const formRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const replyTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const MAX_DEPTH = 2;

  const tree = useMemo(() => {
    const nodes = new Map<string, CommentWithChildren>();
    comments.forEach((comment) => {
      nodes.set(comment.id, { ...comment, children: [] });
    });
    const roots: CommentWithChildren[] = [];
    nodes.forEach((node) => {
      if (node.parentId && nodes.has(node.parentId)) {
        nodes.get(node.parentId)!.children!.push(node);
      } else {
        roots.push(node);
      }
    });

    const sortList = (list: CommentWithChildren[]) => {
      list.sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return sort === "newest" ? bTime - aTime : aTime - bTime;
      });
      list.forEach((item) => sortList(item.children ?? []));
    };
    sortList(roots);
    return roots;
  }, [comments, sort]);

  const handleReply = (comment: CommentItem) => {
    const displayName =
      comment.authorName || comment.authorEmail?.split("@")[0] || "Unknown";
    const preview = comment.body.split("\n")[0]?.slice(0, 140) ?? "";
    const quoted = preview
      ? `> ${preview}${comment.body.length > preview.length ? "…" : ""}`
      : "";
    const nextDraft = `@${displayName}\n\n${quoted}\n\n`;
    setReplyDraft(nextDraft);
    setReplyTo({ id: comment.id, name: displayName });
    requestAnimationFrame(() => {
      replyTextareaRef.current?.focus();
    });
  };

  const handleCopyLink = async (commentId: string) => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}${window.location.pathname}#comment-${commentId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(commentId);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      window.location.hash = `comment-${commentId}`;
    }
  };

  const handleSubmitted = () => {
    setDraft("");
    setReplyTo(null);
    setReplyDraft("");
  };

  const handleEdit = (comment: CommentItem) => {
    setEditingId(comment.id);
    setEditDraft(comment.body);
  };

  const handleEditSubmitted = () => {
    setEditingId(null);
    setEditDraft("");
  };

  const allowComment = canComment ?? isSignedIn;

  return (
    <section id="comments" className="space-y-6">
      <div className="border app-border panel-bg px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.4em] app-muted">
          <MessageSquare className="h-4 w-4" />
          <span>Comments</span>
          <span className="text-[9px] app-muted">({comments.length})</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.3em] app-muted">
          <button
            type="button"
            onClick={() => setSort("newest")}
            className={`flex items-center gap-2 border px-3 py-1 transition ${
              sort === "newest"
                ? "border-[#00ff41]/60 text-[#00ff41]"
                : "app-border hover:bg-[color:var(--panel-bg)]"
            }`}
          >
            <ArrowDownUp className="h-3 w-3" />
            Newest
          </button>
          <button
            type="button"
            onClick={() => setSort("oldest")}
            className={`flex items-center gap-2 border px-3 py-1 transition ${
              sort === "oldest"
                ? "border-[#00ff41]/60 text-[#00ff41]"
                : "app-border hover:bg-[color:var(--panel-bg)]"
            }`}
          >
            Oldest
          </button>
        </div>
      </div>

      <div ref={formRef} className="border app-border panel-bg p-6 space-y-4">
        <CommentForm
          action={action}
          disabled={!allowComment}
          draft={draft}
          onDraftChange={setDraft}
          onSubmitted={handleSubmitted}
          textareaRef={textareaRef}
        />
        {!isSignedIn && (
          <p className="text-xs app-muted">
            <Link href="/sign-in" className="underline app-text">
              Sign in
            </Link>{" "}
            to join the discussion. Your comment will{" "}
            {isAdmin
              ? "publish immediately."
              : "be reviewed before it appears."}
          </p>
        )}
        {isSignedIn && !allowComment && (
          <p className="text-xs app-muted">
            Comments will open once this post is published.
          </p>
        )}
      </div>

      {tree.length === 0 ? (
        <div className="border app-border panel-bg p-6 text-sm app-muted">
          No comments yet. Be the first to start the conversation.
        </div>
      ) : (
        <div className="space-y-5">
          {tree.map((comment) => (
            <CommentNode
              key={comment.id}
              comment={comment}
              replyTo={replyTo}
              replyDraft={replyDraft}
              editId={editingId}
              editDraft={editDraft}
              setEditDraft={setEditDraft}
              setReplyDraft={setReplyDraft}
              setReplyTo={setReplyTo}
              handleReply={handleReply}
              handleEdit={handleEdit}
              handleCopyLink={handleCopyLink}
              copiedId={copiedId}
              allowComment={allowComment}
              isSignedIn={isSignedIn}
              action={action}
              editAction={editAction}
              viewerId={viewerId}
              isAdmin={isAdmin}
              replyTextareaRef={replyTextareaRef}
              collapsed={collapsed}
              setCollapsed={setCollapsed}
              deepExpanded={deepExpanded}
              setDeepExpanded={setDeepExpanded}
              maxDepth={MAX_DEPTH}
              depth={0}
              onEditSubmitted={handleEditSubmitted}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function CommentNode({
  comment,
  depth,
  replyTo,
  replyDraft,
  editId,
  editDraft,
  setEditDraft,
  setReplyDraft,
  setReplyTo,
  handleReply,
  handleEdit,
  handleCopyLink,
  copiedId,
  allowComment,
  isSignedIn,
  action,
  editAction,
  viewerId,
  isAdmin,
  replyTextareaRef,
  collapsed,
  setCollapsed,
  deepExpanded,
  setDeepExpanded,
  maxDepth,
  onEditSubmitted,
}: {
  comment: CommentWithChildren;
  depth: number;
  replyTo: { id: string; name: string } | null;
  replyDraft: string;
  editId: string | null;
  editDraft: string;
  setEditDraft: (value: string) => void;
  setReplyDraft: (value: string) => void;
  setReplyTo: (value: { id: string; name: string } | null) => void;
  handleReply: (comment: CommentItem) => void;
  handleEdit: (comment: CommentItem) => void;
  handleCopyLink: (commentId: string) => void;
  copiedId: string | null;
  allowComment: boolean;
  isSignedIn: boolean;
  action: (
    prevState: CommentState,
    formData: FormData,
  ) => Promise<CommentState>;
  editAction?: (
    commentId: string,
    prevState: CommentState,
    formData: FormData,
  ) => Promise<CommentState>;
  viewerId?: string | null;
  isAdmin: boolean;
  replyTextareaRef: RefObject<HTMLTextAreaElement | null>;
  collapsed: Record<string, boolean>;
  setCollapsed: Dispatch<SetStateAction<Record<string, boolean>>>;
  deepExpanded: Record<string, boolean>;
  setDeepExpanded: Dispatch<SetStateAction<Record<string, boolean>>>;
  maxDepth: number;
  onEditSubmitted: () => void;
}) {
  const displayName = getDisplayName(comment);
  const isReplying = replyTo?.id === comment.id;
  const isEditing = editId === comment.id;
  const isCollapsed = collapsed[comment.id] ?? false;
  const depthLimited = depth >= maxDepth;
  const showDeep = deepExpanded[comment.id] ?? false;
  const canRenderChildren = depth < maxDepth;
  const showChildren = canRenderChildren ? !isCollapsed : showDeep;
  const flatReplies = depthLimited
    ? flattenReplies(comment.children ?? [], displayName)
    : [];
  const replyCount = depthLimited
    ? flatReplies.length
    : (comment.children?.length ?? 0);
  const canEdit =
    typeof editAction === "function" &&
    (isAdmin || (!!viewerId && viewerId === comment.authorId));
  return (
    <div
      id={`comment-${comment.id}`}
      className="border app-border panel-bg p-5 transition hover:border-[#00ff41]/40"
    >
      <div className="flex gap-4">
        {comment.authorImage ? (
          <img
            src={comment.authorImage}
            alt={displayName}
            className="h-9 w-9 rounded-full border app-border object-cover"
          />
        ) : (
          <div className="h-9 w-9 rounded-full border app-border flex items-center justify-center text-xs font-black app-muted">
            {getInitials(displayName)}
          </div>
        )}
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[color:var(--app-text)]">
              {displayName}
            </span>
            {comment.authorRole === "admin" && (
              <span className="text-[9px] uppercase tracking-[0.3em] border border-[#00ff41]/40 px-2 py-0.5 text-[#00ff41]">
                Admin
              </span>
            )}
            {comment.status !== "approved" && (
              <StatusPill
                status={comment.status}
                label={
                  comment.status === "pending" ? "Pending Review" : "Rejected"
                }
              />
            )}
            <span className="text-xs app-muted">
              · <TimeStamp value={comment.createdAt} />
            </span>
            {isEdited(comment.createdAt, comment.updatedAt) && (
              <span className="text-[10px] uppercase tracking-[0.3em] text-[color:var(--accent)]">
                Edited
              </span>
            )}
          </div>
          <p className="mt-3 text-sm leading-relaxed app-muted-strong whitespace-pre-line">
            {comment.body}
          </p>
          <div className="mt-4 flex items-center gap-4 text-[10px] uppercase tracking-[0.3em] app-muted">
            <button
              type="button"
              onClick={() => handleReply(comment)}
              className="flex items-center gap-2 hover:text-[color:var(--app-text)]"
            >
              <CornerUpLeft className="h-3 w-3" />
              Reply
            </button>
            {canEdit && (
              <button
                type="button"
                onClick={() => handleEdit(comment)}
                className="flex items-center gap-2 hover:text-[color:var(--app-text)]"
              >
                <Pencil className="h-3 w-3" />
                Edit
              </button>
            )}
            <button
              type="button"
              onClick={() => handleCopyLink(comment.id)}
              className="flex items-center gap-2 hover:text-[color:var(--app-text)]"
            >
              {copiedId === comment.id ? (
                <>
                  <Check className="h-3 w-3" />
                  Copied
                </>
              ) : (
                <>
                  <Link2 className="h-3 w-3" />
                  Link
                </>
              )}
            </button>
          </div>
          {isReplying && (
            <div className="mt-4 border app-border panel-bg p-4">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.3em] app-muted">
                <span>Replying to {replyTo?.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setReplyTo(null);
                    setReplyDraft("");
                  }}
                  className="hover:text-[color:var(--app-text)]"
                >
                  Cancel
                </button>
              </div>
              <CommentForm
                action={action}
                disabled={!allowComment}
                draft={replyDraft}
                onDraftChange={setReplyDraft}
                onSubmitted={() => {
                  setReplyDraft("");
                  setReplyTo(null);
                }}
                textareaRef={replyTextareaRef}
                label="Quick Reply"
                submitLabel="Send Reply"
                compact
                className="mt-3"
                parentId={comment.id}
              />
              {!isSignedIn && (
                <p className="mt-2 text-xs app-muted">
                  <Link href="/sign-in" className="underline app-text">
                    Sign in
                  </Link>{" "}
                  to reply.
                </p>
              )}
              {isSignedIn && !allowComment && (
                <p className="mt-2 text-xs app-muted">
                  Replies will open once this post is published.
                </p>
              )}
            </div>
          )}

          {isEditing && editAction && (
            <div className="mt-4 border app-border panel-bg p-4">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.3em] app-muted">
                <span>Editing comment</span>
                <button
                  type="button"
                  onClick={() => onEditSubmitted()}
                  className="hover:text-[color:var(--app-text)]"
                >
                  Cancel
                </button>
              </div>
              <CommentForm
                action={editAction.bind(null, comment.id)}
                draft={editDraft}
                onDraftChange={setEditDraft}
                onSubmitted={onEditSubmitted}
                label="Edit comment"
                submitLabel="Save edit"
                compact
                className="mt-3"
              />
            </div>
          )}

          {(comment.children?.length ?? 0) > 0 && (
            <div className="mt-5 border-l border-[#00ff41]/20 pl-5 space-y-4">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.3em] app-muted">
                <span>
                  Replies ({replyCount}){depthLimited && " · Depth limit"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (depthLimited) {
                      setDeepExpanded((prev) => ({
                        ...prev,
                        [comment.id]: !showDeep,
                      }));
                    } else {
                      setCollapsed((prev) => ({
                        ...prev,
                        [comment.id]: !isCollapsed,
                      }));
                    }
                  }}
                  className="hover:text-[color:var(--app-text)]"
                >
                  {depthLimited
                    ? showDeep
                      ? "Hide"
                      : "Show"
                    : isCollapsed
                      ? "Show"
                      : "Hide"}
                </button>
              </div>
              {showChildren && (
                <div className="space-y-4">
                  {depthLimited
                    ? flatReplies.map(
                        ({ comment: flatComment, replyTo: replyToName }) => (
                          <FlatReplyCard
                            key={flatComment.id}
                            comment={flatComment}
                            replyToLabel={replyToName}
                            activeReplyId={replyTo?.id ?? null}
                            activeReplyName={replyTo?.name ?? null}
                            replyDraft={replyDraft}
                            editId={editId}
                            editDraft={editDraft}
                            setEditDraft={setEditDraft}
                            setReplyDraft={setReplyDraft}
                            setReplyTo={setReplyTo}
                            handleReply={handleReply}
                            handleEdit={handleEdit}
                            handleCopyLink={handleCopyLink}
                            copiedId={copiedId}
                            allowComment={allowComment}
                            isSignedIn={isSignedIn}
                            action={action}
                            editAction={editAction}
                            viewerId={viewerId}
                            isAdmin={isAdmin}
                            replyTextareaRef={replyTextareaRef}
                            onEditSubmitted={onEditSubmitted}
                          />
                        ),
                      )
                    : (comment.children ?? []).map((child) => (
                        <CommentNode
                          key={child.id}
                          comment={child}
                          depth={canRenderChildren ? depth + 1 : maxDepth}
                          replyTo={replyTo}
                          replyDraft={replyDraft}
                          editId={editId}
                          editDraft={editDraft}
                          setEditDraft={setEditDraft}
                          setReplyDraft={setReplyDraft}
                          setReplyTo={setReplyTo}
                          handleReply={handleReply}
                          handleEdit={handleEdit}
                          handleCopyLink={handleCopyLink}
                          copiedId={copiedId}
                          allowComment={allowComment}
                          isSignedIn={isSignedIn}
                          action={action}
                          editAction={editAction}
                          viewerId={viewerId}
                          isAdmin={isAdmin}
                          replyTextareaRef={replyTextareaRef}
                          collapsed={collapsed}
                          setCollapsed={setCollapsed}
                          deepExpanded={deepExpanded}
                          setDeepExpanded={setDeepExpanded}
                          maxDepth={maxDepth}
                          onEditSubmitted={onEditSubmitted}
                        />
                      ))}
                </div>
              )}
              {depthLimited && !showDeep && (
                <div className="text-[10px] uppercase tracking-[0.3em] app-muted">
                  Expand to view deeper replies.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FlatReplyCard({
  comment,
  replyToLabel,
  activeReplyId,
  activeReplyName,
  replyDraft,
  editId,
  editDraft,
  setEditDraft,
  setReplyDraft,
  setReplyTo,
  handleReply,
  handleEdit,
  handleCopyLink,
  copiedId,
  allowComment,
  isSignedIn,
  action,
  editAction,
  viewerId,
  isAdmin,
  replyTextareaRef,
  onEditSubmitted,
}: {
  comment: CommentItem;
  replyToLabel: string;
  activeReplyId: string | null;
  activeReplyName: string | null;
  replyDraft: string;
  editId: string | null;
  editDraft: string;
  setEditDraft: (value: string) => void;
  setReplyDraft: (value: string) => void;
  setReplyTo: (value: { id: string; name: string } | null) => void;
  handleReply: (comment: CommentItem) => void;
  handleEdit: (comment: CommentItem) => void;
  handleCopyLink: (commentId: string) => void;
  copiedId: string | null;
  allowComment: boolean;
  isSignedIn: boolean;
  action: (
    prevState: CommentState,
    formData: FormData,
  ) => Promise<CommentState>;
  editAction?: (
    commentId: string,
    prevState: CommentState,
    formData: FormData,
  ) => Promise<CommentState>;
  viewerId?: string | null;
  isAdmin: boolean;
  replyTextareaRef: RefObject<HTMLTextAreaElement | null>;
  onEditSubmitted: () => void;
}) {
  const displayName = getDisplayName(comment);
  const isReplying = activeReplyId === comment.id;
  const isEditing = editId === comment.id;
  const canEdit =
    typeof editAction === "function" &&
    (isAdmin || (!!viewerId && viewerId === comment.authorId));

  return (
    <div
      id={`comment-${comment.id}`}
      className="border app-border panel-bg p-4"
    >
      <div className="flex gap-3">
        {comment.authorImage ? (
          <img
            src={comment.authorImage}
            alt={displayName}
            className="h-8 w-8 rounded-full border app-border object-cover"
          />
        ) : (
          <div className="h-8 w-8 rounded-full border app-border flex items-center justify-center text-[10px] font-black app-muted">
            {getInitials(displayName)}
          </div>
        )}
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[color:var(--app-text)]">
              {displayName}
            </span>
            {comment.authorRole === "admin" && (
              <span className="text-[9px] uppercase tracking-[0.3em] border border-[#00ff41]/40 px-2 py-0.5 text-[#00ff41]">
                Admin
              </span>
            )}
            {comment.status !== "approved" && (
              <StatusPill
                status={comment.status}
                label={
                  comment.status === "pending" ? "Pending Review" : "Rejected"
                }
              />
            )}
            <span className="text-xs app-muted">
              · <TimeStamp value={comment.createdAt} />
            </span>
            {isEdited(comment.createdAt, comment.updatedAt) && (
              <span className="text-[10px] uppercase tracking-[0.3em] text-[color:var(--accent)]">
                Edited
              </span>
            )}
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.3em] app-muted">
            Replying to {replyToLabel}
          </div>
          <p className="mt-3 text-sm leading-relaxed app-muted-strong whitespace-pre-line">
            {comment.body}
          </p>
          <div className="mt-4 flex items-center gap-4 text-[10px] uppercase tracking-[0.3em] app-muted">
            <button
              type="button"
              onClick={() => handleReply(comment)}
              className="flex items-center gap-2 hover:text-[color:var(--app-text)]"
            >
              <CornerUpLeft className="h-3 w-3" />
              Reply
            </button>
            {canEdit && (
              <button
                type="button"
                onClick={() => handleEdit(comment)}
                className="flex items-center gap-2 hover:text-[color:var(--app-text)]"
              >
                <Pencil className="h-3 w-3" />
                Edit
              </button>
            )}
            <button
              type="button"
              onClick={() => handleCopyLink(comment.id)}
              className="flex items-center gap-2 hover:text-[color:var(--app-text)]"
            >
              {copiedId === comment.id ? (
                <>
                  <Check className="h-3 w-3" />
                  Copied
                </>
              ) : (
                <>
                  <Link2 className="h-3 w-3" />
                  Link
                </>
              )}
            </button>
          </div>
          {isReplying && (
            <div className="mt-4 border app-border panel-bg p-4">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.3em] app-muted">
                <span>Replying to {activeReplyName ?? displayName}</span>
                <button
                  type="button"
                  onClick={() => {
                    setReplyTo(null);
                    setReplyDraft("");
                  }}
                  className="hover:text-[color:var(--app-text)]"
                >
                  Cancel
                </button>
              </div>
              <CommentForm
                action={action}
                disabled={!allowComment}
                draft={replyDraft}
                onDraftChange={setReplyDraft}
                onSubmitted={() => {
                  setReplyDraft("");
                  setReplyTo(null);
                }}
                textareaRef={replyTextareaRef}
                label="Quick Reply"
                submitLabel="Send Reply"
                compact
                className="mt-3"
                parentId={comment.id}
              />
              {!isSignedIn && (
                <p className="mt-2 text-xs app-muted">
                  <Link href="/sign-in" className="underline app-text">
                    Sign in
                  </Link>{" "}
                  to reply.
                </p>
              )}
              {isSignedIn && !allowComment && (
                <p className="mt-2 text-xs app-muted">
                  Replies will open once this post is published.
                </p>
              )}
            </div>
          )}

          {isEditing && editAction && (
            <div className="mt-4 border app-border panel-bg p-4">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.3em] app-muted">
                <span>Editing comment</span>
                <button
                  type="button"
                  onClick={() => onEditSubmitted()}
                  className="hover:text-[color:var(--app-text)]"
                >
                  Cancel
                </button>
              </div>
              <CommentForm
                action={editAction.bind(null, comment.id)}
                draft={editDraft}
                onDraftChange={setEditDraft}
                onSubmitted={onEditSubmitted}
                label="Edit comment"
                submitLabel="Save edit"
                compact
                className="mt-3"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
