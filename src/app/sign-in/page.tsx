import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import SignInView from '@/components/sign-in-view';
import { getTheme } from '@/lib/theme';
import { auth } from '@/lib/auth';

export default async function SignInPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) {
    redirect('/');
  }
  const theme = getTheme();
  return <SignInView initialTheme={theme} />;
}
