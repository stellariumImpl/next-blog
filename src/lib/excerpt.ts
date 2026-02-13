const DEFAULT_EXCERPT_MAX = 220;
const ABSOLUTE_EXCERPT_MAX = 500;
const AI_TIMEOUT_MS = 6000;
const AI_INPUT_LIMIT = 6000;
const MAX_SUMMARY_SENTENCES = 3;
type ExcerptProvider = "openai" | "cloudflare" | "google" | "deepseek" | "extractive";

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function isLowSignalText(value: string) {
  const normalized = collapseWhitespace(value).toLowerCase();
  if (normalized.length < 80) return false;
  const compact = normalized.replace(/\s+/g, '');
  if (!compact) return true;
  const uniqueChars = new Set(compact).size;
  const uniqueRatio = uniqueChars / compact.length;
  const repeatedRun = /(.)\1{10,}/.test(compact);
  return uniqueRatio < 0.18 || repeatedRun;
}

function clipText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  const slice = value.slice(0, maxLength);
  const cutAt = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('。'),
    slice.lastIndexOf('! '),
    slice.lastIndexOf('！'),
    slice.lastIndexOf('? '),
    slice.lastIndexOf('？')
  );
  if (cutAt > Math.floor(maxLength * 0.6)) {
    return `${slice.slice(0, cutAt + 1).trim()}...`;
  }
  return `${slice.trim()}...`;
}

function splitIntoSentences(value: string) {
  const normalized = collapseWhitespace(value);
  if (!normalized) return [] as string[];
  const byTerminal = normalized
    .split(/(?<=[。！？.!?])\s+/)
    .map(collapseWhitespace)
    .filter(Boolean);
  if (byTerminal.length > 1) return byTerminal;
  return normalized
    .split(/[;；]/)
    .map(collapseWhitespace)
    .filter(Boolean);
}

function markdownToText(value: string) {
  const withoutCodeFence = value.replace(/```[\s\S]*?```/g, ' ');
  const withoutInlineCode = withoutCodeFence.replace(/`[^`]*`/g, ' ');
  const withoutImages = withoutInlineCode.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');
  const withoutLinks = withoutImages.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  const withoutHtml = withoutLinks.replace(/<[^>]+>/g, ' ');
  const withoutMarkdown = withoutHtml
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\|/g, ' ');
  return collapseWhitespace(withoutMarkdown);
}

function hasUsefulContent(value: string) {
  const compact = collapseWhitespace(value);
  if (compact.length < 40) return false;
  if (isLowSignalText(compact)) return false;
  return true;
}

const SUMMARY_STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'about', 'have', 'has', 'had', 'are', 'was',
  'were', 'will', 'would', 'should', 'could', 'can', 'may', 'might', 'not', 'but', 'you', 'your', 'our',
  'their', 'its', 'they', 'them', 'there', 'here', 'when', 'where', 'what', 'which', 'who', 'whom',
  'a', 'an', 'to', 'of', 'in', 'on', 'at', 'by', 'as', 'or', 'is', 'be', 'it',
  '的', '了', '和', '与', '及', '在', '对', '把', '被', '是', '就', '都', '而', '及其', '以及',
  '一个', '一种', '我们', '你们', '他们', '她们', '它们', '这个', '那个', '这些', '那些',
]);

function normalizeForCompare(value: string) {
  return value.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
}

function tokenize(value: string) {
  const matches = value.toLowerCase().match(/[a-z0-9]{2,}|[\u4e00-\u9fff]{2,}/g) ?? [];
  return matches.filter((token) => !SUMMARY_STOPWORDS.has(token));
}

function tokenOverlapRatio(a: Set<string>, b: Set<string>) {
  if (a.size === 0 || b.size === 0) return 0;
  let hit = 0;
  for (const token of a) {
    if (b.has(token)) hit += 1;
  }
  return hit / Math.min(a.size, b.size);
}

function buildExtractiveSummary(title: string, plain: string, maxLength: number) {
  const limit = Math.min(maxLength, ABSOLUTE_EXCERPT_MAX);
  const sentences = splitIntoSentences(plain).filter((sentence) => sentence.length >= 10);
  if (sentences.length === 0) return null;
  if (sentences.length === 1) return clipText(sentences[0], limit);

  const titleTokens = new Set(tokenize(title));
  const sentenceTokens = sentences.map((sentence) => new Set(tokenize(sentence)));
  const tokenFreq = new Map<string, number>();

  for (const tokenSet of sentenceTokens) {
    for (const token of tokenSet) {
      tokenFreq.set(token, (tokenFreq.get(token) ?? 0) + 1);
    }
  }

  const ranked = sentences.map((sentence, index) => {
    const tokens = sentenceTokens[index];
    let score = 0;
    for (const token of tokens) {
      score += tokenFreq.get(token) ?? 0;
    }
    if (tokens.size > 0) score /= Math.sqrt(tokens.size);

    let titleOverlap = 0;
    for (const token of tokens) {
      if (titleTokens.has(token)) titleOverlap += 1;
    }
    score += titleOverlap * 1.5;
    if (/\d/.test(sentence)) score += 0.4;
    if (index > 0) score += 0.3;
    if (sentence.length < 16) score *= 0.7;

    return { index, sentence, tokens, score };
  });

  ranked.sort((a, b) => b.score - a.score);

  const selected: typeof ranked = [];
  for (const candidate of ranked) {
    if (selected.length >= MAX_SUMMARY_SENTENCES) break;
    const duplicate = selected.some(
      (existing) => tokenOverlapRatio(existing.tokens, candidate.tokens) > 0.85
    );
    if (!duplicate) selected.push(candidate);
  }

  if (selected.length === 0) selected.push(ranked[0]);

  const ordered = selected.sort((a, b) => a.index - b.index);
  let summary = '';
  for (const item of ordered) {
    const next = summary ? `${summary} ${item.sentence}` : item.sentence;
    if (next.length > limit) {
      if (!summary) summary = clipText(item.sentence, limit);
      break;
    }
    summary = next;
  }

  if (!summary) summary = clipText(ordered[0].sentence, limit);
  return clipText(summary, limit);
}

function isLikelyLeadSentenceCopy(summary: string, plainContent: string) {
  const [leadSentence] = splitIntoSentences(plainContent);
  if (!leadSentence) return false;
  const normalizedSummary = normalizeForCompare(summary);
  const normalizedLead = normalizeForCompare(leadSentence);
  if (!normalizedSummary || !normalizedLead) return false;
  if (normalizedSummary === normalizedLead) return true;

  const minLen = Math.min(normalizedSummary.length, normalizedLead.length);
  if (minLen < 24) return false;

  let prefix = 0;
  while (
    prefix < minLen &&
    normalizedSummary.charCodeAt(prefix) === normalizedLead.charCodeAt(prefix)
  ) {
    prefix += 1;
  }
  if (prefix / minLen > 0.8) return true;

  const summaryTokens = new Set(tokenize(summary));
  const leadTokens = new Set(tokenize(leadSentence));
  return tokenOverlapRatio(summaryTokens, leadTokens) > 0.92 && prefix > 12;
}

function normalizeUserExcerpt(excerpt?: string | null, maxLength = DEFAULT_EXCERPT_MAX) {
  if (excerpt === undefined || excerpt === null) return null;
  const cleaned = collapseWhitespace(excerpt);
  if (!cleaned) return null;
  return clipText(cleaned, Math.min(maxLength, ABSOLUTE_EXCERPT_MAX));
}

function fallbackExcerpt(title: string, content?: string | null, maxLength = DEFAULT_EXCERPT_MAX) {
  const plain = markdownToText(content ?? '');
  if (!plain) return null;
  if (!hasUsefulContent(plain)) return null;
  return buildExtractiveSummary(title, plain, maxLength);
}

async function generateExcerptWithCloudflareAI({
  title,
  content,
  maxLength,
}: {
  title: string;
  content?: string | null;
  maxLength: number;
}) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const model = process.env.CLOUDFLARE_AI_MODEL ?? '@cf/meta/llama-3.2-3b-instruct';

  if (!accountId || !apiToken) return null;

  const plainContent = markdownToText(content ?? '').slice(0, AI_INPUT_LIMIT);
  if (!hasUsefulContent(plainContent)) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content:
                'You summarize blog posts into one concise excerpt. Synthesize key idea and conclusion from the whole text, and do not copy the opening sentence. Return plain text in the same language as the content.',
            },
            {
              role: 'user',
              content: `Title: ${title}\n\nContent: ${plainContent}\n\nRequirements:\n1) One sentence only.\n2) Must represent the full article, not only the beginning.\n3) Keep <= ${maxLength} characters.\n4) No markdown, no quotes, no bullet points.`,
            },
          ],
          temperature: 0.2,
          max_tokens: 180,
        }),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      console.warn('excerpt ai request failed', response.status);
      return null;
    }

    const data = (await response.json()) as {
      result?: { response?: string; text?: string };
    };

    const raw = data?.result?.response ?? data?.result?.text ?? '';
    const cleaned = collapseWhitespace(raw).replace(/^['"`]+|['"`]+$/g, '');
    if (!cleaned) return null;
    if (isLowSignalText(cleaned)) return null;
    if (isLikelyLeadSentenceCopy(cleaned, plainContent)) return null;

    return clipText(cleaned, Math.min(maxLength, ABSOLUTE_EXCERPT_MAX));
  } catch (error) {
    console.warn('excerpt ai request error', error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function generateExcerptWithOpenAI({
  title,
  content,
  maxLength,
}: {
  title: string;
  content?: string | null;
  maxLength: number;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_EXCERPT_MODEL ?? "gpt-4.1-mini";
  if (!apiKey) return null;

  const plainContent = markdownToText(content ?? '').slice(0, AI_INPUT_LIMIT);
  if (!hasUsefulContent(plainContent)) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.15,
        max_tokens: 220,
        messages: [
          {
            role: "system",
            content:
              "You summarize technical blog posts. Produce one concise sentence in the same language as the content. It must reflect the whole article, not only the opening paragraph. No markdown, no quotes, no list markers.",
          },
          {
            role: "user",
            content: `Title: ${title}\n\nContent: ${plainContent}\n\nConstraints:\n1) <= ${maxLength} characters.\n2) Do not copy the first sentence.\n3) Mention the core goal/method/outcome when available.`,
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn("excerpt openai request failed", response.status);
      return null;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data?.choices?.[0]?.message?.content ?? "";
    const cleaned = collapseWhitespace(raw).replace(/^['"`]+|['"`]+$/g, "");
    if (!cleaned) return null;
    if (isLowSignalText(cleaned)) return null;
    if (isLikelyLeadSentenceCopy(cleaned, plainContent)) return null;

    return clipText(cleaned, Math.min(maxLength, ABSOLUTE_EXCERPT_MAX));
  } catch (error) {
    console.warn("excerpt openai request error", error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function generateExcerptWithDeepSeekAI({
  title,
  content,
  maxLength,
}: {
  title: string;
  content?: string | null;
  maxLength: number;
}) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const model = process.env.DEEPSEEK_EXCERPT_MODEL ?? 'deepseek-chat';
  const baseUrl = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1';
  if (!apiKey) return null;

  const plainContent = markdownToText(content ?? '').slice(0, AI_INPUT_LIMIT);
  if (!hasUsefulContent(plainContent)) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.15,
        max_tokens: 220,
        messages: [
          {
            role: 'system',
            content:
              'You summarize technical blog posts. Produce one concise sentence in the same language as the content. It must reflect the whole article, not only the opening paragraph. No markdown, no quotes, no list markers.',
          },
          {
            role: 'user',
            content: `Title: ${title}\n\nContent: ${plainContent}\n\nConstraints:\n1) <= ${maxLength} characters.\n2) Do not copy the first sentence.\n3) Mention the core goal/method/outcome when available.`,
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.warn('excerpt deepseek request failed', response.status, detail);
      return null;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data?.choices?.[0]?.message?.content ?? '';
    const cleaned = collapseWhitespace(raw).replace(/^['"`]+|['"`]+$/g, '');
    if (!cleaned) return null;
    if (isLowSignalText(cleaned)) return null;
    if (isLikelyLeadSentenceCopy(cleaned, plainContent)) return null;

    return clipText(cleaned, Math.min(maxLength, ABSOLUTE_EXCERPT_MAX));
  } catch (error) {
    console.warn('excerpt deepseek request error', error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function generateExcerptWithGoogleAI({
  title,
  content,
  maxLength,
}: {
  title: string;
  content?: string | null;
  maxLength: number;
}) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const preferredModel = process.env.GOOGLE_GENERATIVE_AI_MODEL ?? "gemini-2.0-flash";
  if (!apiKey) return null;

  const plainContent = markdownToText(content ?? "").slice(0, AI_INPUT_LIMIT);
  if (!hasUsefulContent(plainContent)) return null;

  const modelCandidates = Array.from(
    new Set([
      preferredModel,
      "gemini-1.5-flash",
      "gemini-1.5-flash-8b",
    ])
  );

  for (const model of modelCandidates) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          model
        )}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [
                {
                  text:
                    "You summarize technical blog posts. Produce one concise sentence in the same language as the content. It must reflect the whole article, not only the opening paragraph. No markdown, no quotes, no list markers.",
                },
              ],
            },
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: `Title: ${title}\n\nContent: ${plainContent}\n\nConstraints:\n1) <= ${maxLength} characters.\n2) Do not copy the first sentence.\n3) Mention the core goal/method/outcome when available.`,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.15,
              maxOutputTokens: 220,
            },
          }),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        console.warn("excerpt google request failed", model, response.status, detail);
        continue;
      }

      const data = (await response.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
      };
      const raw =
        data?.candidates?.[0]?.content?.parts
          ?.map((part) => part.text ?? "")
          .join(" ") ?? "";
      const cleaned = collapseWhitespace(raw).replace(/^['"`]+|['"`]+$/g, "");
      if (!cleaned) continue;
      if (isLowSignalText(cleaned)) continue;
      if (isLikelyLeadSentenceCopy(cleaned, plainContent)) continue;

      return clipText(cleaned, Math.min(maxLength, ABSOLUTE_EXCERPT_MAX));
    } catch (error) {
      console.warn("excerpt google request error", model, error);
    } finally {
      clearTimeout(timer);
    }
  }

  return null;
}

export async function resolvePostExcerpt({
  title,
  content,
  excerpt,
  maxLength = DEFAULT_EXCERPT_MAX,
}: {
  title: string;
  content?: string | null;
  excerpt?: string | null;
  maxLength?: number;
}) {
  const normalized = normalizeUserExcerpt(excerpt, maxLength);
  if (normalized) return normalized;

  const provider = (process.env.EXCERPT_AI_PROVIDER ?? "openai") as ExcerptProvider;

  if (provider === 'deepseek') {
    const deepseekExcerpt = await generateExcerptWithDeepSeekAI({
      title,
      content,
      maxLength,
    });
    if (deepseekExcerpt) return deepseekExcerpt;
    const openaiExcerpt = await generateExcerptWithOpenAI({
      title,
      content,
      maxLength,
    });
    if (openaiExcerpt) return openaiExcerpt;
    const googleExcerpt = await generateExcerptWithGoogleAI({
      title,
      content,
      maxLength,
    });
    if (googleExcerpt) return googleExcerpt;
    const cloudflareExcerpt = await generateExcerptWithCloudflareAI({
      title,
      content,
      maxLength,
    });
    if (cloudflareExcerpt) return cloudflareExcerpt;
  } else if (provider === "google") {
    const googleExcerpt = await generateExcerptWithGoogleAI({
      title,
      content,
      maxLength,
    });
    if (googleExcerpt) return googleExcerpt;
    const openaiExcerpt = await generateExcerptWithOpenAI({
      title,
      content,
      maxLength,
    });
    if (openaiExcerpt) return openaiExcerpt;
    const cloudflareExcerpt = await generateExcerptWithCloudflareAI({
      title,
      content,
      maxLength,
    });
    if (cloudflareExcerpt) return cloudflareExcerpt;
  } else if (provider === "openai") {
    const openaiExcerpt = await generateExcerptWithOpenAI({
      title,
      content,
      maxLength,
    });
    if (openaiExcerpt) return openaiExcerpt;
    const deepseekExcerpt = await generateExcerptWithDeepSeekAI({
      title,
      content,
      maxLength,
    });
    if (deepseekExcerpt) return deepseekExcerpt;
    const cloudflareExcerpt = await generateExcerptWithCloudflareAI({
      title,
      content,
      maxLength,
    });
    if (cloudflareExcerpt) return cloudflareExcerpt;
  } else if (provider === "cloudflare") {
    const cloudflareExcerpt = await generateExcerptWithCloudflareAI({
      title,
      content,
      maxLength,
    });
    if (cloudflareExcerpt) return cloudflareExcerpt;
    const googleExcerpt = await generateExcerptWithGoogleAI({
      title,
      content,
      maxLength,
    });
    if (googleExcerpt) return googleExcerpt;
    const deepseekExcerpt = await generateExcerptWithDeepSeekAI({
      title,
      content,
      maxLength,
    });
    if (deepseekExcerpt) return deepseekExcerpt;
    const openaiExcerpt = await generateExcerptWithOpenAI({
      title,
      content,
      maxLength,
    });
    if (openaiExcerpt) return openaiExcerpt;
  }

  return fallbackExcerpt(title, content, maxLength);
}
