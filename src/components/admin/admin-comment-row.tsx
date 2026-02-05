"use client";

import { useState } from "react";
import { Pencil, Trash2, Save, X } from "lucide-react";
import TimeStamp from "@/components/ui/time-stamp";

type CommentRowProps = {
  id: string;
  body: string;
  status: string;
  createdAt: Date | string;
  postTitle?: string | null;
  postSlug?: string | null;
  authorName?: string | null;
  authorEmail?: string | null;
  onEdit: (formData: FormData) => void;
  onDelete: (formData: FormData) => void;
};

export default function AdminCommentRow({
  id,
  body,
  status,
  createdAt,
  postTitle,
  postSlug,
  authorName,
  authorEmail,
  onEdit,
  onDelete,
}: CommentRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(body);

  return (
    <div className="border border-zinc-800 bg-zinc-950/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
          {status}
        </div>
        <div className="text-xs text-zinc-500">
          <TimeStamp value={createdAt} />
        </div>
      </div>

      {editing ? (
        <form
          action={(formData) => {
            formData.set("commentId", id);
            formData.set("body", draft);
            onEdit(formData);
            setEditing(false);
          }}
          className="mt-3 space-y-3"
        >
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={4}
            className="w-full border border-zinc-800 bg-black/40 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-600"
          />
          <div className="flex gap-3">
            <button className="border border-[#00ff41]/40 px-3 py-1 text-xs uppercase tracking-[0.3em] text-[#00ff41] hover:bg-[#00ff41] hover:text-black transition flex items-center gap-2">
              <Save className="h-3 w-3" />
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(body);
                setEditing(false);
              }}
              className="border border-zinc-700 px-3 py-1 text-xs uppercase tracking-[0.3em] text-zinc-300 hover:text-white hover:bg-zinc-900 transition flex items-center gap-2"
            >
              <X className="h-3 w-3" />
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-2 text-sm text-zinc-200 whitespace-pre-line">{body}</div>
      )}

      <div className="mt-3 text-xs text-zinc-500">
        Post: {postTitle ?? postSlug ?? "Unknown"}
      </div>
      <div className="text-xs text-zinc-600">
        By: {authorName ?? authorEmail ?? "Unknown"}
      </div>

      {!editing && (
        <div className="mt-4 flex gap-3">
          <button
            onClick={() => setEditing(true)}
            className="border border-[#00ff41]/40 px-3 py-1 text-xs uppercase tracking-[0.3em] text-[#00ff41] hover:bg-[#00ff41] hover:text-black transition flex items-center gap-2"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
          <form
            action={(formData) => {
              formData.set("commentId", id);
              onDelete(formData);
            }}
          >
            <button className="border border-red-500/40 px-3 py-1 text-xs uppercase tracking-[0.3em] text-red-400 hover:bg-red-500 hover:text-black transition flex items-center gap-2">
              <Trash2 className="h-3 w-3" />
              Delete
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
