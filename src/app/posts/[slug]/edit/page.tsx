import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { postTags, posts, tags } from '@/db/schema';
import { requireUser } from '@/lib/auth-guard';
import { getTheme } from '@/lib/theme';
import SiteHeader from '@/components/site-header';
import { ensureUserProfile } from '@/lib/user-profile';
import PostEditorForm, { type PostEditorState } from '@/components/editor/post-editor-form';
import { getCaller } from '@/server/caller';

async function editPostAction(
  postId: string,
  slug: string,
  prevState: PostEditorState,
  formData: FormData
): Promise<PostEditorState> {
  'use server';

  const title = (formData.get('title') as string | null)?.trim() || undefined;
  const excerptRaw = formData.get('excerpt') as string | null;
  const excerpt =
    excerptRaw === null
      ? undefined
      : excerptRaw.trim() === ''
        ? null
        : excerptRaw.trim();
  const content =
    (formData.get('content') as string | null)?.trim() || undefined;
  const idempotencyKey =
    (formData.get('idempotencyKey') as string | null)?.trim() ?? '';
  const tagNamesProvided = formData.get('tagNamesProvided') === '1';
  const tagNames = formData
    .getAll('tagNames')
    .map((value) => String(value))
    .filter(Boolean);

  if (
    title === undefined &&
    excerpt === undefined &&
    content === undefined &&
    !tagNamesProvided
  ) {
    return { ok: false, message: 'Provide at least one field to update.' };
  }
  if (!idempotencyKey) {
    return { ok: false, message: 'Missing submission key.' };
  }

  try {
    const caller = await getCaller();
    const updated = await caller.posts.requestEdit({
      postId,
      title,
      excerpt,
      content,
      tagNames: tagNamesProvided ? tagNames : undefined,
      idempotencyKey,
    });
    const message =
      updated && 'status' in updated && updated.status !== 'applied'
        ? 'Update submitted for review.'
        : 'Post updated.';
    revalidatePath(`/posts/${slug}`);
    revalidatePath('/account');
    revalidatePath('/');
    revalidatePath('/archive');
    return { ok: true, message, redirectTo: `/posts/${slug}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Update failed.';
    return { ok: false, message };
  }
}

export default async function EditPostPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams?: { autogenExcerpt?: string };
}) {
  const { session } = await requireUser();
  if (!session?.user) {
    redirect('/sign-in');
  }

  const theme = getTheme();
  const viewerProfile = await ensureUserProfile({
    id: session.user.id,
    email: session.user.email,
  });
  const viewer = {
    email: session.user.email,
    role: viewerProfile.role,
    name: session.user.name ?? undefined,
    image: session.user.image ?? undefined,
  };

  const [post] = await db
    .select({
      id: posts.id,
      authorId: posts.authorId,
      title: posts.title,
      excerpt: posts.excerpt,
      content: posts.content,
      updatedAt: posts.updatedAt,
      status: posts.status,
    })
    .from(posts)
    .where(eq(posts.slug, params.slug))
    .limit(1);

  if (!post) {
    notFound();
  }

  const isAdmin = viewer.role === 'admin';
  const isAuthor = post.authorId === session.user.id;

  if (!isAdmin && !isAuthor) {
    notFound();
  }

  const [tagOptions, selectedTags] = await Promise.all([
    db.select().from(tags).orderBy(desc(tags.createdAt)),
    db
      .select({ id: tags.id, name: tags.name })
      .from(postTags)
      .innerJoin(tags, eq(postTags.tagId, tags.id))
      .where(eq(postTags.postId, post.id)),
  ]);

  const selectedTagIds = selectedTags.map((tag) => tag.id);
  const selectedTagNames = selectedTags.map((tag) => tag.name);

  return (
    <div className="min-h-screen app-bg">
      <SiteHeader viewer={viewer} initialTheme={theme} />
      <div className="max-w-5xl mx-auto space-y-8 px-6 pt-24 pb-24">
        <div>
          <div className="text-xs uppercase tracking-[0.4em] app-muted">Edit</div>
          <h1 className="mt-4 text-4xl font-black">Edit Post</h1>
          <p className="mt-3 app-muted-strong">
            {isAdmin
              ? 'Your updates publish immediately.'
              : 'Updates will be reviewed before replacing the live post.'}
          </p>
        </div>
        <PostEditorForm
          action={editPostAction.bind(null, post.id, params.slug)}
          mode="edit"
          initialTitle={post.title}
          initialExcerpt={post.excerpt ?? ''}
          initialContent={post.content ?? ''}
          tags={tagOptions}
          initialTagIds={selectedTagIds}
          initialTagNames={selectedTagNames}
          isAdmin={isAdmin}
          autoGenerateExcerpt={searchParams?.autogenExcerpt === '1'}
          submitLabel={isAdmin ? 'Save Changes' : 'Submit Update'}
        />
      </div>
    </div>
  );
}
