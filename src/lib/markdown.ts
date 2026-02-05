export type HeadingItem = {
  id: string;
  text: string;
  level: number;
};

export type Slugger = {
  slug: (value: string) => string;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function createSlugger(): Slugger {
  const counts = new Map<string, number>();
  return {
    slug(value: string) {
      const base = slugify(value) || "section";
      const count = counts.get(base) ?? 0;
      counts.set(base, count + 1);
      return count === 0 ? base : `${base}-${count}`;
    },
  };
}

export function stripMarkdown(value: string) {
  return value
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .trim();
}

export function extractHeadings(
  markdown: string,
  options: { minLevel?: number; maxLevel?: number } = {},
) {
  const minLevel = options.minLevel ?? 2;
  const maxLevel = options.maxLevel ?? 4;
  const slugger = createSlugger();
  const headings: HeadingItem[] = [];
  const lines = markdown.split(/\r?\n/);
  let inFence = false;
  let fenceMarker: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
      const marker = trimmed.slice(0, 3);
      if (!inFence) {
        inFence = true;
        fenceMarker = marker;
      } else if (fenceMarker === marker) {
        inFence = false;
        fenceMarker = null;
      }
      continue;
    }
    if (inFence) continue;

    const match = /^(#{1,6})\s+(.+)$/.exec(line);
    if (!match) continue;
    const level = match[1].length;
    if (level < minLevel || level > maxLevel) continue;
    const raw = match[2].replace(/\s+#+\s*$/, "");
    const text = stripMarkdown(raw);
    if (!text) continue;
    const id = slugger.slug(text);
    headings.push({ id, text, level });
  }

  return headings;
}
