import { z } from 'zod';

const baseSchema = z.object({
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.string().url(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  NEXT_PUBLIC_GOOGLE_ENABLED: z.string().optional(),
  ADMIN_EMAILS: z.string().optional(),
  MAGIC_LINK_FROM: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_PUBLIC_BASE_URL: z.string().optional(),
  R2_BASE_URL: z.string().optional(),
  GITHUB_ASSETS_OWNER: z.string().optional(),
  GITHUB_ASSETS_REPO: z.string().optional(),
  GITHUB_ASSETS_TOKEN: z.string().optional(),
  GITHUB_ASSETS_BRANCH: z.string().optional(),
  CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
  CLOUDFLARE_API_TOKEN: z.string().optional(),
  CLOUDFLARE_AI_MODEL: z.string().optional(),
});

export const env = baseSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  NEXT_PUBLIC_GOOGLE_ENABLED: process.env.NEXT_PUBLIC_GOOGLE_ENABLED,
  ADMIN_EMAILS: process.env.ADMIN_EMAILS,
  MAGIC_LINK_FROM: process.env.MAGIC_LINK_FROM,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
  R2_BUCKET: process.env.R2_BUCKET,
  R2_PUBLIC_BASE_URL: process.env.R2_PUBLIC_BASE_URL,
  R2_BASE_URL: process.env.R2_BASE_URL,
  GITHUB_ASSETS_OWNER: process.env.GITHUB_ASSETS_OWNER,
  GITHUB_ASSETS_REPO: process.env.GITHUB_ASSETS_REPO,
  GITHUB_ASSETS_TOKEN: process.env.GITHUB_ASSETS_TOKEN,
  GITHUB_ASSETS_BRANCH: process.env.GITHUB_ASSETS_BRANCH,
  CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
  CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
  CLOUDFLARE_AI_MODEL: process.env.CLOUDFLARE_AI_MODEL,
});

export function parseAdminEmails(value?: string) {
  if (!value) return [];
  return value
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}
