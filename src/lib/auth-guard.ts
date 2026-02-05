import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { ensureUserProfile } from '@/lib/user-profile';

export async function requireAdmin() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect('/sign-in');
  }

  const profile = await ensureUserProfile({
    id: session.user.id,
    email: session.user.email,
  });

  if (profile.role !== 'admin') {
    redirect('/');
  }

  return { session, profile };
}

export async function requireUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect('/sign-in');
  }

  const profile = await ensureUserProfile({
    id: session.user.id,
    email: session.user.email,
  });

  return { session, profile };
}
