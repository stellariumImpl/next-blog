"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import { Braces, Code2, Image as ImageIcon, Link2 } from "lucide-react";
import TagInput from "@/components/forms/tag-input";
import { useUIStore } from "@/store/ui";
import { createIdempotencyKey } from "@/lib/idempotency";

export type TagOption = { id: string; name: string; slug: string };

export type PostEditorState = {
  ok: boolean;
  message: string;
  redirectTo?: string | null;
};

const actionButton =
  "inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] app-muted hover:text-[color:var(--accent)] transition";

const hintText = "Write Markdown. Use $...$ for inline math, $$...$$ for blocks.";

function insertAtCursor(
  textarea: HTMLTextAreaElement | null,
  value: string,
  fallback: (next: string) => void,
) {
  if (!textarea) {
    fallback(value);
    return;
  }
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  const before = textarea.value.slice(0, start);
  const after = textarea.value.slice(end);
  const next = `${before}${value}${after}`;
  fallback(next);
  requestAnimationFrame(() => {
    textarea.focus();
    const cursor = start + value.length;
    textarea.setSelectionRange(cursor, cursor);
  });
}

export default function PostEditorForm({
  action,
  tags = [],
  mode,
  initialTitle = "",
  initialExcerpt = "",
  initialContent = "",
  initialTagIds = [],
  initialTagNames,
  isAdmin = false,
  submitLabel,
}: {
  action: (
    prevState: PostEditorState,
    formData: FormData,
  ) => Promise<PostEditorState>;
  tags?: TagOption[];
  mode: "create" | "edit";
  initialTitle?: string;
  initialExcerpt?: string;
  initialContent?: string;
  initialTagIds?: string[];
  initialTagNames?: string[];
  isAdmin?: boolean;
  submitLabel?: string;
}) {
  const [state, formAction] = useFormState(action, {
    ok: false,
    message: "",
    redirectTo: null,
  });
  const [title, setTitle] = useState(initialTitle);
  const [excerpt, setExcerpt] = useState(initialExcerpt);
  const [markdown, setMarkdown] = useState(initialContent);
  const resolvedInitialTags = useMemo(() => {
    if (initialTagNames && initialTagNames.length > 0) {
      return initialTagNames;
    }
    if (!tags.length || initialTagIds.length === 0) {
      return [];
    }
    const lookup = new Map(tags.map((tag) => [tag.id, tag.name]));
    return initialTagIds
      .map((id) => lookup.get(id))
      .filter((value): value is string => Boolean(value));
  }, [initialTagIds, initialTagNames, tags]);
  const [tagNames, setTagNames] = useState<string[]>(resolvedInitialTags);
  const tagTouchedRef = useRef(false);
  const router = useRouter();
  const redirectedRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(createIdempotencyKey());

  useEffect(() => {
    setTitle(initialTitle);
    setExcerpt(initialExcerpt);
    setMarkdown(initialContent);
  }, [initialTitle, initialExcerpt, initialContent]);

  useEffect(() => {
    if (tagTouchedRef.current) return;
    setTagNames(resolvedInitialTags);
  }, [resolvedInitialTags]);

  const handleTagChange = (next: string[]) => {
    tagTouchedRef.current = true;
    setTagNames(next);
  };

  useEffect(() => {
    if (!redirectedRef.current && state.ok && state.redirectTo) {
      redirectedRef.current = true;
      router.push(state.redirectTo);
    }
  }, [router, state.ok, state.redirectTo]);

  useEffect(() => {
    if (state.ok) {
      setIdempotencyKey(createIdempotencyKey());
    }
  }, [state.ok]);

  const handleLink = () => {
    const url = window.prompt("Enter URL");
    if (!url) return;
    insertAtCursor(textareaRef.current, `[link](${url})`, setMarkdown);
  };

  const handleImage = () => {
    const url = window.prompt("Image URL");
    if (!url) return;
    insertAtCursor(textareaRef.current, `![image](${url})`, setMarkdown);
  };

  const compressImage = async (file: File) => {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      throw new Error("Only PNG, JPG, or WEBP images are allowed.");
    }
    const img = document.createElement("img");
    const blobUrl = URL.createObjectURL(file);
    try {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Image load failed"));
        img.src = blobUrl;
      });
      const maxWidth = 1600;
      const maxHeight = 1600;
      const scale = Math.min(
        1,
        maxWidth / img.width,
        maxHeight / img.height,
      );
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not available");
      ctx.drawImage(img, 0, 0, width, height);
      const outputType = "image/webp";
      const quality = 0.82;
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, outputType, quality),
      );
      if (!blob) throw new Error("Compression failed");
      const nameBase = file.name.replace(/\.[^/.]+$/, "");
      const nextName = `${nameBase}.webp`;
      return new File([blob], nextName, { type: outputType });
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  };

  const uploadWithProgress = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const formData = new FormData();
      formData.append("file", file);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/uploads/github", true);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setUploadProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText) as { url: string };
            if (data.url) resolve(data.url);
            else reject(new Error("Upload failed"));
          } catch {
            reject(new Error("Upload failed"));
          }
        } else {
          try {
            const data = JSON.parse(xhr.responseText);
            reject(new Error(data?.error || "Upload failed"));
          } catch {
            reject(new Error("Upload failed"));
          }
        }
      };
      xhr.onerror = () => reject(new Error("Upload failed"));
      xhr.send(formData);
    });

  const handleUpload = async (file: File) => {
    if (!file) return;
    try {
      setUploading(true);
      setUploadProgress(0);
      const compressed = await compressImage(file);
      const url = await uploadWithProgress(compressed);
      insertAtCursor(textareaRef.current, `![image](${url})`, setMarkdown);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Upload failed";
      flashSystemMsg(message);
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const handleCodeBlock = () => {
    insertAtCursor(
      textareaRef.current,
      "\n```ts\n// code\n```\n",
      setMarkdown,
    );
  };

  const handleInlineCode = () => {
    insertAtCursor(textareaRef.current, "`code`", setMarkdown);
  };

  const introText = isAdmin
    ? "Changes apply immediately."
    : mode === "create"
      ? "Submissions are reviewed before publishing."
      : "Edits are reviewed before updating the live post.";

  const buttonLabel =
    submitLabel ??
    (mode === "create" ? (isAdmin ? "Publish" : "Submit") : isAdmin ? "Save" : "Submit Update");

  const normalizedTagSet = useMemo(() => {
    return new Set(tagNames.map((tag) => tag.toLowerCase()));
  }, [tagNames]);
  const suggestedTags = useMemo(
    () => tags.filter((tag) => !normalizedTagSet.has(tag.name.toLowerCase())),
    [tags, normalizedTagSet],
  );
  const flashSystemMsg = useUIStore((state) => state.flashSystemMsg);

  return (
    <form
      action={formAction}
      className="space-y-6"
      noValidate
      onSubmit={(event) => {
        if (!title.trim()) {
          event.preventDefault();
          flashSystemMsg("TITLE_REQUIRED");
        }
      }}
    >
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <div className="border app-border panel-bg p-4">
        <div className="text-xs uppercase tracking-[0.3em] app-muted">Editor</div>
        <p className="mt-2 text-sm app-muted-strong">{introText}</p>
        <p className="mt-2 text-xs app-muted">{hintText}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-[0.3em] app-muted">Title</label>
          <input
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full border app-border bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--app-text)]"
            placeholder="A concise, technical headline"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-[0.3em] app-muted">Excerpt</label>
          <input
            name="excerpt"
            value={excerpt}
            onChange={(event) => setExcerpt(event.target.value)}
            className="w-full border app-border bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--app-text)]"
            placeholder="Short summary for the feed"
          />
        </div>
      </div>

      <div className="space-y-3">
        <TagInput
          value={tagNames}
          onChange={handleTagChange}
          placeholder="Type a tag, press Enter"
          hint={
            tags.length > 0
              ? "Existing tags are matched automatically. New tags will be reviewed."
              : "No approved tags yet. New tags will be reviewed."
          }
        />
        {suggestedTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.3em] app-muted">
            <span>Approved tags:</span>
            {suggestedTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() =>
                  setTagNames((prev) =>
                    prev.some((item) => item.toLowerCase() === tag.name.toLowerCase())
                      ? prev
                      : [...prev, tag.name],
                  )
                }
                className="border app-border px-2 py-1 hover:border-[#00ff41] transition"
              >
                {tag.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="border app-border panel-bg p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs uppercase tracking-[0.3em] app-muted">Markdown editor</div>
          <div className="flex flex-wrap items-center gap-4">
            <button type="button" onClick={handleInlineCode} className={actionButton}>
              <Code2 className="h-3 w-3" />
              Code
            </button>
            <button type="button" onClick={handleCodeBlock} className={actionButton}>
              <Braces className="h-3 w-3" />
              Block
            </button>
            <button type="button" onClick={handleLink} className={actionButton}>
              <Link2 className="h-3 w-3" />
              Link
            </button>
            <button type="button" onClick={handleImage} className={actionButton}>
              <ImageIcon className="h-3 w-3" />
              Image URL
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={actionButton}
            >
              <ImageIcon className="h-3 w-3" />
              Upload
            </button>
          </div>
        </div>
        <textarea
          ref={textareaRef}
          name="content"
          value={markdown}
          onChange={(event) => setMarkdown(event.target.value)}
          onPaste={(event) => {
            const items = event.clipboardData?.items;
            if (!items) return;
            const file = Array.from(items)
              .map((item) => item.getAsFile())
              .find((f) => f && f.type.startsWith("image/"));
            if (file) {
              event.preventDefault();
              void handleUpload(file);
            }
          }}
          className="markdown-editor w-full bg-transparent outline-none text-sm app-muted-strong"
          placeholder="Write your article in Markdown..."
        />
        {uploading && (
          <div className="text-xs uppercase tracking-[0.3em] app-muted flex items-center gap-3">
            <div className="h-1.5 w-32 border app-border">
              <div
                className="h-full bg-[color:var(--accent)] transition-all"
                style={{ width: `${uploadProgress ?? 0}%` }}
              />
            </div>
            <span>{uploadProgress ?? 0}%</span>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void handleUpload(file);
          }
          if (event.target) {
            event.target.value = "";
          }
        }}
      />

      <button
        type="submit"
        className="flex items-center gap-2 border border-[#00ff41]/40 px-4 py-2 text-xs uppercase tracking-[0.3em] text-[#00ff41] hover:bg-[#00ff41] hover:text-black transition"
      >
        {buttonLabel}
      </button>

      {state.message && (
        <div className={`text-sm ${state.ok ? "text-[#00ff41]" : "text-red-400"}`}>
          {state.message}
        </div>
      )}
    </form>
  );
}
