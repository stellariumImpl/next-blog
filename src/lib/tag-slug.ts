import Kuroshiro from "kuroshiro";
import KuromojiAnalyzer from "kuroshiro-analyzer-kuromoji";
import { pinyin } from "pinyin-pro";

const MAX_SLUG_LENGTH = 64;
const slugAllowed = /^[a-z0-9]+$/;
const hasCjk = (value: string) =>
  /[\u3040-\u30ff\u31f0-\u31ff\u4e00-\u9fff]/.test(value);

const slugifyAscii = (value: string) => {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, MAX_SLUG_LENGTH);
};

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36).slice(0, 8);
};

let kuroshiroInstance: Kuroshiro | null = null;
let kuroshiroInit: Promise<Kuroshiro> | null = null;

const getKuroshiro = async () => {
  if (kuroshiroInstance) return kuroshiroInstance;
  if (!kuroshiroInit) {
    const instance = new Kuroshiro();
    kuroshiroInit = instance
      .init(new KuromojiAnalyzer())
      .then(() => {
        kuroshiroInstance = instance;
        return instance;
      });
  }
  return kuroshiroInit;
};

const toRomaji = async (value: string) => {
  try {
    const kuroshiro = await getKuroshiro();
    return await kuroshiro.convert(value, {
      to: "romaji",
      romajiSystem: "hepburn",
      mode: "spaced",
    });
  } catch {
    return "";
  }
};

export const normalizeUserSlug = (value: string) => {
  const normalized = value.toLowerCase().trim();
  if (!normalized) return "";
  if (!slugAllowed.test(normalized)) return null;
  return normalized.slice(0, MAX_SLUG_LENGTH);
};

export const generateTagSlug = async (name: string) => {
  const direct = slugifyAscii(name);
  if (direct) return direct;

  if (hasCjk(name)) {
    const romaji = await toRomaji(name);
    const romajiSlug = slugifyAscii(romaji);
    if (romajiSlug) return romajiSlug;

    try {
      const pinyinText = pinyin(name, { toneType: "none" });
      const pinyinSlug = slugifyAscii(pinyinText);
      if (pinyinSlug) return pinyinSlug;
    } catch {
      // fall through to hash
    }
  }

  return `tag${hashString(name)}`.slice(0, MAX_SLUG_LENGTH);
};
