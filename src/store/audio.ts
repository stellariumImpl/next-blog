import { create } from "zustand";
import { audioPlaylist, type AudioTrack } from "@/data/audio-playlist";

type AudioState = {
  isOpen: boolean;
  isPlaying: boolean;
  currentIndex: number;
  volume: number;
  tracks: AudioTrack[];
  open: () => void;
  close: () => void;
  toggle: () => void;
  setPlaying: (playing: boolean) => void;
  setCurrentIndex: (index: number) => void;
  next: () => void;
  prev: () => void;
  setVolume: (volume: number) => void;
};

export const useAudioStore = create<AudioState>((set, get) => ({
  isOpen: false,
  isPlaying: false,
  currentIndex: 0,
  volume: 0.7,
  tracks: audioPlaylist,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  setPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentIndex: (index) => {
    const safeIndex = Math.max(0, Math.min(index, get().tracks.length - 1));
    set({ currentIndex: safeIndex });
  },
  next: () => {
    const { currentIndex, tracks } = get();
    if (tracks.length === 0) return;
    set({ currentIndex: (currentIndex + 1) % tracks.length, isPlaying: true });
  },
  prev: () => {
    const { currentIndex, tracks } = get();
    if (tracks.length === 0) return;
    set({
      currentIndex: (currentIndex - 1 + tracks.length) % tracks.length,
      isPlaying: true,
    });
  },
  setVolume: (volume) => set({ volume }),
}));
