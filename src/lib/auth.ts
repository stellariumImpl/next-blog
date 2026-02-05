import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { magicLink } from 'better-auth/plugins';
import { Resend } from 'resend';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { env } from '@/lib/env';

const githubEnabled = !!env.GITHUB_CLIENT_ID && !!env.GITHUB_CLIENT_SECRET;
const googleEnabled =
  env.NEXT_PUBLIC_GOOGLE_ENABLED === 'true' &&
  !!env.GOOGLE_CLIENT_ID &&
  !!env.GOOGLE_CLIENT_SECRET;

if (!githubEnabled) {
  console.warn(
    '[auth] GitHub OAuth is disabled because GITHUB_CLIENT_ID/SECRET is missing.'
  );
}

const resend = new Resend(env.RESEND_API_KEY);

const socialProviders: Record<
  string,
  { clientId: string; clientSecret: string }
> = {
  ...(githubEnabled
    ? {
        github: {
          clientId: env.GITHUB_CLIENT_ID as string,
          clientSecret: env.GITHUB_CLIENT_SECRET as string,
        },
      }
    : {}),
  ...(googleEnabled
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID as string,
          clientSecret: env.GOOGLE_CLIENT_SECRET as string,
        },
      }
    : {}),
};

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  socialProviders,
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        const { data, error } = await resend.emails.send({
          from: env.MAGIC_LINK_FROM,
          to: email,
          subject: 'Your sign-in link',
          text: `Use the link below to sign in:\n${url}\n\nIf you did not request this email, you can ignore it.`,
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6;">
              <h2 style="margin: 0 0 12px;">Sign in to Digital Archive</h2>
              <p>Click the secure link below to sign in:</p>
              <p><a href="${url}" target="_blank" rel="noreferrer">Sign in</a></p>
              <p style="color: #666; font-size: 12px;">If you did not request this email, you can ignore it.</p>
            </div>
          `,
        });
        if (error) {
          console.error('[magic-link] Resend error', error);
          throw new Error('Failed to send magic link.');
        }
        console.log('[magic-link] sent', data?.id);
      },
    }),
  ],
});
