import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { userProfiles } from '@/db/schema';
import { env, parseAdminEmails } from '@/lib/env';

const adminEmails = parseAdminEmails(env.ADMIN_EMAILS);

export type UserProfile = {
  userId: string;
  role: 'admin' | 'user';
};

export async function ensureUserProfile(user: {
  id: string;
  email?: string | null;
}) {
  const existing = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, user.id))
    .limit(1);

  const email = (user.email || '').toLowerCase();
  const shouldBeAdmin = email && adminEmails.includes(email);

  if (existing.length > 0) {
    const profile = existing[0];
    if (shouldBeAdmin && profile.role !== 'admin') {
      await db
        .update(userProfiles)
        .set({ role: 'admin' })
        .where(eq(userProfiles.userId, user.id));
      return { ...profile, role: 'admin' } as UserProfile;
    }
    return profile as UserProfile;
  }

  const role: UserProfile['role'] = shouldBeAdmin ? 'admin' : 'user';
  await db.insert(userProfiles).values({ userId: user.id, role });
  return { userId: user.id, role } as UserProfile;
}
