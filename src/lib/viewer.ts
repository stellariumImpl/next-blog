import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { ensureUserProfile } from "@/lib/user-profile";

export async function getViewer() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { session: null, viewer: null };
  }

  const profile = await ensureUserProfile({
    id: session.user.id,
    email: session.user.email,
  });

  return {
    session,
    viewer: {
      email: session.user.email,
      role: profile.role,
      name: session.user.name ?? undefined,
      image: session.user.image ?? undefined,
    },
  };
}
