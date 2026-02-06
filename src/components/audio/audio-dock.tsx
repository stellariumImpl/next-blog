"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pause,
  Play,
  SkipBack,
  SkipForward,
  X,
  Volume2,
} from "lucide-react";
import { useAudioStore } from "@/store/audio";
import { useUIStore } from "@/store/ui";

const formatTime = (value: number) => {
  if (!Number.isFinite(value)) return "0:00";
  const mins = Math.floor(value / 60);
  const secs = Math.floor(value % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export default function AudioDock() {
  const {
    isOpen,
    tracks,
    currentIndex,
    isPlaying,
    volume,
    close,
    setPlaying,
    setCurrentIndex,
    next,
    prev,
    setVolume,
  } = useAudioStore();
  const flashSystemMsg = useUIStore((state) => state.flashSystemMsg);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const currentTrack = tracks[currentIndex];

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack?.src) return;
    audio.src = currentTrack.src;
    audio.load();
    if (isPlaying) {
      audio
        .play()
        .catch(() => flashSystemMsg("AUDIO_PLAY_FAILED"));
    }
  }, [currentTrack?.src, isPlaying, flashSystemMsg]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleTime = () => setCurrentTime(audio.currentTime);
    const handleLoaded = () => setDuration(audio.duration || 0);
    const handleEnded = () => next();
    audio.addEventListener("timeupdate", handleTime);
    audio.addEventListener("loadedmetadata", handleLoaded);
    audio.addEventListener("ended", handleEnded);
    return () => {
      audio.removeEventListener("timeupdate", handleTime);
      audio.removeEventListener("loadedmetadata", handleLoaded);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [next]);

  const safeTracks = useMemo(() => tracks.filter((track) => track.src), [tracks]);

  useEffect(() => {
    if (!isOpen) return;
    const container = listRef.current;
    if (!container) return;
    const run = () => {
      const activeNode = container.querySelector<HTMLElement>(
        'button[data-active="true"]',
      );
      if (!activeNode) return;
      const prefersReducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      activeNode.scrollIntoView({
        block: "center",
        behavior: prefersReducedMotion ? "auto" : "smooth",
      });
    };
    const raf = window.requestAnimationFrame(run);
    return () => window.cancelAnimationFrame(raf);
  }, [isOpen, currentIndex]);

  const handlePlayPause = () => {
    if (!currentTrack?.src) {
      flashSystemMsg("AUDIO_SOURCE_MISSING");
      return;
    }
    const nextState = !isPlaying;
    setPlaying(nextState);
    const audio = audioRef.current;
    if (!audio) return;
    if (nextState) {
      audio.play().catch(() => flashSystemMsg("AUDIO_PLAY_FAILED"));
    } else {
      audio.pause();
    }
  };

  const handleSeek = (value: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value;
    setCurrentTime(value);
  };

  return (
    <>
      <audio ref={audioRef} preload="metadata" />
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-6">
          <div className="w-full max-w-2xl max-h-[90vh] md:max-h-[80vh] overflow-hidden border app-border panel-bg p-4 md:p-6 shadow-[0_0_60px_rgba(0,0,0,0.35)]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="h-9 w-9 md:h-10 md:w-10 rounded-full bg-[color:var(--accent)]/20 flex items-center justify-center text-[color:var(--accent)] font-black shrink-0">
                  ♪
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] md:text-xs uppercase tracking-[0.35em] app-muted">
                    Currently Playing
                  </div>
                  <div className="text-base md:text-lg font-semibold app-text break-words">
                    {currentTrack?.title ?? "No track selected"}
                  </div>
                  <div className="text-xs app-muted break-words">
                    {currentTrack?.artist ?? "Add audio sources in audio-playlist.ts"}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={close}
                className="h-8 w-8 flex items-center justify-center border app-border hover:border-[color:var(--accent)] transition self-end md:self-auto"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6">
              {safeTracks.length === 0 ? (
                <div className="border app-border panel-bg p-4 text-xs uppercase tracking-[0.3em] app-muted">
                  No audio sources configured
                </div>
              ) : (
                <div
                  ref={listRef}
                  className="max-h-[36vh] sm:max-h-[40vh] md:max-h-[44vh] overflow-y-auto pr-2 space-y-3"
                >
                  {safeTracks.map((track, index) => {
                    const active = tracks[currentIndex]?.id === track.id;
                    return (
                      <button
                        key={track.id}
                        type="button"
                        data-active={active ? "true" : "false"}
                        onClick={() => {
                          setCurrentIndex(index);
                          setPlaying(true);
                        }}
                        className={`flex w-full flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border app-border px-4 py-3 text-left transition ${
                          active
                            ? "border-[color:var(--accent)]/70 shadow-[0_0_20px_rgba(0,0,0,0.2)]"
                            : "hover:border-[color:var(--accent)]/40"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold app-text break-words">
                            {track.title}
                          </div>
                          <div className="text-xs app-muted break-words">
                            {track.artist}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 sm:justify-end">
                          <span className="text-[9px] md:text-[10px] uppercase tracking-[0.3em] app-muted">
                            {active ? "Playing" : "Queued"}
                          </span>
                          <div
                            className={`h-6 w-6 rounded-full border app-border flex items-center justify-center ${
                              active ? "text-[color:var(--accent)]" : "app-muted"
                            }`}
                          >
                            {active && isPlaying ? (
                              <div className="flex items-end gap-[2px]">
                                <span className="h-3 w-[2px] bg-[color:var(--accent)] animate-pulse" />
                                <span className="h-4 w-[2px] bg-[color:var(--accent)] animate-pulse" />
                                <span className="h-2 w-[2px] bg-[color:var(--accent)] animate-pulse" />
                              </div>
                            ) : (
                              <Play className="h-3 w-3" />
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-6 border-t app-border pt-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <div className="flex items-center justify-center gap-3 md:gap-4 md:justify-start">
                <button
                  type="button"
                  onClick={prev}
                  className="h-9 w-9 md:h-10 md:w-10 flex items-center justify-center border app-border hover:border-[color:var(--accent)] transition"
                >
                  <SkipBack className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handlePlayPause}
                  className="h-11 w-11 md:h-12 md:w-12 flex items-center justify-center border app-border text-[color:var(--accent)] hover:border-[color:var(--accent)] transition"
                >
                  {isPlaying ? (
                    <Pause className="h-5 w-5" />
                  ) : (
                    <Play className="h-5 w-5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={next}
                  className="h-9 w-9 md:h-10 md:w-10 flex items-center justify-center border app-border hover:border-[color:var(--accent)] transition"
                >
                  <SkipForward className="h-4 w-4" />
                </button>
                </div>

                <div className="flex-1 w-full">
                  <div className="flex items-center justify-between text-[9px] md:text-[10px] uppercase tracking-[0.3em] app-muted mb-2">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={duration || 0}
                    step={0.1}
                    value={Math.min(currentTime, duration || 0)}
                    onChange={(event) => handleSeek(Number(event.target.value))}
                    className="w-full accent-[color:var(--accent)]"
                  />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                  <Volume2 className="h-4 w-4 shrink-0" />
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={volume}
                    onChange={(event) => setVolume(Number(event.target.value))}
                    className="w-full md:w-24 accent-[color:var(--accent)]"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
