"use client";

import { create } from "zustand";

export type MatchMode = "any" | "all";

type TagLookup = Record<string, string>;

type FeedFilterState = {
  selectedTags: string[];
  match: MatchMode;
  tagLookup: TagLookup;
  setSelectedTags: (tags: string[]) => void;
  toggleTag: (slug: string, name?: string) => void;
  removeTag: (slug: string) => void;
  clearTags: () => void;
  setMatch: (mode: MatchMode) => void;
  setTagLookup: (tags: { slug: string; name: string }[]) => void;
};

const uniq = (values: string[]) => Array.from(new Set(values));

export const useFeedFilterStore = create<FeedFilterState>((set, get) => ({
  selectedTags: [],
  match: "any",
  tagLookup: {},
  setSelectedTags: (tags) =>
    set({
      selectedTags: uniq(tags).filter(Boolean),
    }),
  toggleTag: (slug, name) => {
    const current = get().selectedTags;
    const exists = current.includes(slug);
    const next = exists ? current.filter((tag) => tag !== slug) : [...current, slug];
    set((state) => ({
      selectedTags: uniq(next),
      tagLookup: name ? { ...state.tagLookup, [slug]: name } : state.tagLookup,
    }));
  },
  removeTag: (slug) =>
    set((state) => ({
      selectedTags: state.selectedTags.filter((tag) => tag !== slug),
    })),
  clearTags: () => set({ selectedTags: [] }),
  setMatch: (mode) => set({ match: mode }),
  setTagLookup: (tags) =>
    set((state) => ({
      tagLookup: tags.reduce<TagLookup>((acc, tag) => {
        acc[tag.slug] = tag.name;
        return acc;
      }, { ...state.tagLookup }),
    })),
}));
