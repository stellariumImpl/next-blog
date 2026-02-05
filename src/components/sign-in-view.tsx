"use client";

import { useState, type FormEvent } from "react";
import { Chrome, Github, Mail, Send, Shield } from "lucide-react";
import { authClient } from "@/lib/auth-client";

const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_ENABLED === "true";

export default function SignInView({
  initialTheme = "dark",
}: {
  initialTheme?: "dark" | "light";
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const isDark = initialTheme === "dark";
  const pageClass = isDark
    ? "bg-black text-white"
    : "bg-zinc-100 text-zinc-900";
  const mutedText = isDark ? "text-zinc-400" : "text-zinc-600";
  const mutedLabel = isDark ? "text-zinc-500" : "text-zinc-600";
  const borderColor = isDark ? "border-zinc-800" : "border-zinc-200";
  const cardBg = isDark ? "bg-zinc-950" : "bg-white";
  const buttonBorder = isDark ? "border-zinc-700" : "border-zinc-300";
  const buttonHover = isDark
    ? "hover:bg-white hover:text-black"
    : "hover:bg-black hover:text-white";
  const disabledBorder = isDark
    ? "border-zinc-900 text-zinc-600"
    : "border-zinc-200 text-zinc-400";
  const inputBorder = isDark
    ? "border-zinc-700 focus:border-white"
    : "border-zinc-300 focus:border-black";
  const iconMuted = isDark ? "text-zinc-500" : "text-zinc-500";

  const handleMagicLink = async (event: FormEvent) => {
    event.preventDefault();
    if (!email) {
      setStatus("Enter an email address.");
      return;
    }
    setLoading(true);
    setStatus("Sending magic link...");
    const result = await authClient.signIn.magicLink({
      email,
      callbackURL: "/",
    });
    if (result?.error) {
      setStatus(result.error.message || "Failed to send magic link.");
    } else {
      setStatus("Check your inbox for the sign-in link.");
    }
    setLoading(false);
  };

  const handleSocial = async (provider: "github" | "google") => {
    setStatus("Redirecting...");
    await authClient.signIn.social({
      provider,
      callbackURL: "/",
    });
  };

  return (
    <div
      className={`min-h-screen ${pageClass} flex items-center justify-center px-6`}
    >
      <div className={`w-full max-w-md border ${borderColor} ${cardBg} p-8`}>
        <div
          className={`flex items-center gap-2 text-xs uppercase tracking-[0.4em] ${mutedLabel}`}
        >
          <Shield className="w-4 h-4" />
          Sign In
        </div>
        <h1 className="mt-4 text-3xl font-black">Access Your Workspace</h1>
        <p className={`mt-2 ${mutedText} text-sm`}>
          Posts, comments, and tag requests are reviewed before publishing.
        </p>

        <div className="mt-6 space-y-3">
          <button
            type="button"
            className={`w-full flex items-center justify-center gap-2 border ${buttonBorder} px-4 py-2 uppercase text-xs tracking-[0.3em] ${buttonHover} transition`}
            onClick={() => handleSocial("github")}
          >
            <Github className="w-4 h-4" />
            GitHub Sign In
          </button>
          <button
            type="button"
            className={`w-full flex items-center justify-center gap-2 border px-4 py-2 uppercase text-xs tracking-[0.3em] transition ${
              googleEnabled
                ? `${buttonBorder} ${buttonHover}`
                : `${disabledBorder} cursor-not-allowed`
            }`}
            onClick={() => googleEnabled && handleSocial("google")}
          >
            <Chrome className="w-4 h-4" />
            Google Sign In
          </button>
          {!googleEnabled && (
            <div className="text-[10px] uppercase tracking-[0.3em] text-center text-zinc-500">
              Google login coming soon
            </div>
          )}
        </div>

        <div className={`my-6 border-t ${borderColor}`} />

        <form onSubmit={handleMagicLink} className="space-y-3">
          <label className={`text-xs uppercase tracking-[0.3em] ${mutedLabel}`}>
            Email Magic Link
          </label>
          <div className="flex items-center gap-2">
            <Mail className={`w-4 h-4 ${iconMuted}`} />
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className={`flex-1 bg-transparent border ${inputBorder} px-3 py-2 text-sm outline-none`}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 border border-[#00ff41]/40 px-4 py-2 uppercase text-xs tracking-[0.3em] text-[#00ff41] hover:bg-[#00ff41] hover:text-black transition"
          >
            <Send className="w-4 h-4" />
            {loading ? "Sending..." : "Send Magic Link"}
          </button>
        </form>

        {status && <p className={`mt-4 text-xs ${mutedText}`}>{status}</p>}
      </div>
    </div>
  );
}
