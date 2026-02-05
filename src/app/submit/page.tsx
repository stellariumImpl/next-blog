import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth-guard';
import PostEditorForm, { type PostEditorState } from '@/components/editor/post-editor-form';
import { getCaller } from '@/server/caller';
import { db } from '@/db';
import { tags } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { getTheme } from '@/lib/theme';
import SiteHeader from '@/components/site-header';
import { ensureUserProfile } from '@/lib/user-profile';

async function createPostAction(
  prevState: PostEditorState,
  formData: FormData
): Promise<PostEditorState> {
  'use server';

  const caller = await getCaller();
  const title = (formData.get('title') as string | null)?.trim() ?? '';
  const excerpt = (formData.get('excerpt') as string | null)?.trim() || undefined;
  const content = (formData.get('content') as string | null)?.trim() || undefined;
  const tagNames = formData
    .getAll('tagNames')
    .map((value) => String(value))
    .filter(Boolean);

  if (!title) {
    return { ok: false, message: 'Title is required.' };
  }

  try {
    const created = await caller.posts.submit({
      title,
      slug: undefined,
      excerpt,
      content,
      tagNames,
    });
    if (!created) {
      return { ok: false, message: 'Submission failed.' };
    }
    const message =
      created?.status === 'published'
        ? 'Post published.'
        : 'Submission received. Awaiting review.';
    revalidatePath('/');
    revalidatePath('/account');
    if (created?.status === 'published') {
      revalidatePath('/archive');
    }
    return { ok: true, message, redirectTo: `/posts/${created.slug}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Submission failed.';
    return { ok: false, message };
  }
}

export default async function SubmitPage() {
  const { session } = await requireUser();

  if (!session?.user) {
    redirect('/sign-in');
  }

  const tagOptions = await db.select().from(tags).orderBy(desc(tags.createdAt));
  const theme = getTheme();
  const viewerProfile = session?.user
    ? await ensureUserProfile({ id: session.user.id, email: session.user.email })
    : null;
  const viewer = session?.user
    ? {
        email: session.user.email,
        role: viewerProfile?.role ?? 'user',
        name: session.user.name ?? undefined,
        image: session.user.image ?? undefined,
      }
    : null;
  const isAdmin = viewer?.role === 'admin';

  return (
    <div className="min-h-screen app-bg">
      <SiteHeader viewer={viewer} initialTheme={theme} />
      <div className="max-w-5xl mx-auto space-y-8 px-6 pt-24 pb-24">
        <div>
          <div className="text-xs uppercase tracking-[0.4em] app-muted">Submit</div>
          <h1 className="mt-4 text-4xl font-black">Submit a New Post</h1>
          <p className="mt-3 app-muted-strong">
            {isAdmin
              ? 'Publish directly to the archive.'
              : 'Share your draft with the editorial team. All submissions require admin review before publishing.'}
          </p>
        </div>
        <PostEditorForm
          action={createPostAction}
          tags={tagOptions}
          mode="create"
          isAdmin={isAdmin}
        />
      </div>
    </div>
  );
}
