"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, Heart, Loader2 } from "lucide-react";

export default function PostEngagement({
  postId,
  initialViews,
  initialLikes,
  initialLiked,
  canLike,
  trackView,
  showSignIn,
}: {
  postId: string;
  initialViews: number;
  initialLikes: number;
  initialLiked: boolean;
  canLike: boolean;
  trackView: boolean;
  showSignIn: boolean;
}) {
  const [views, setViews] = useState(initialViews);
  const [likes, setLikes] = useState(initialLikes);
  const [liked, setLiked] = useState(initialLiked);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!trackView) return;
    if (typeof window === "undefined") return;
    const key = `viewed:${postId}`;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
    fetch(`/api/posts/${postId}/view`, { method: "POST" })
      .then((response) => {
        if (response.ok) {
          setViews((prev) => prev + 1);
        }
      })
      .catch(() => {});
  }, [postId, trackView]);

  const toggleLike = async () => {
    if (!canLike || saving) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/posts/${postId}/like`, {
        method: "POST",
      });
      if (!response.ok) return;
      const data = (await response.json()) as { liked: boolean; likes: number };
      setLiked(data.liked);
      setLikes(data.likes);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 flex flex-wrap items-center gap-4 text-xs uppercase tracking-[0.3em] app-muted">
      <span className="flex items-center gap-2">
        <Eye className="h-3 w-3" /> {views}
      </span>
      {canLike ? (
        <button
          type="button"
          onClick={toggleLike}
          disabled={saving}
          className={`flex items-center gap-2 transition ${
            liked ? "text-[#00ff41]" : "hover:text-white"
          }`}
          aria-pressed={liked}
        >
          {saving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Heart className="h-3 w-3" />
          )}
          {likes}
        </button>
      ) : (
        <span className="flex items-center gap-2">
          <Heart className="h-3 w-3" /> {likes}
        </span>
      )}
      {showSignIn && (
        <Link href="/sign-in" className="text-[10px] underline app-muted-strong">
          Sign in to like
        </Link>
      )}
    </div>
  );
}
