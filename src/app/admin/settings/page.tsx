import { revalidatePath } from 'next/cache';
import { FileImage, Sparkles } from 'lucide-react';
import { getCaller } from '@/server/caller';
import { getSiteSettings } from '@/lib/site-settings';
import {
  FAVICON_ALLOWED_TYPES,
  uploadGithubAsset,
} from '@/lib/github-assets';

const MAX_FAVICON_MB = 2;
const MAX_FAVICON_BYTES = MAX_FAVICON_MB * 1024 * 1024;
const MAX_CODE_SIZE = 50000;
const faviconAccept = Array.from(FAVICON_ALLOWED_TYPES).join(',');

async function saveFaviconAction(formData: FormData) {
  'use server';
  const caller = await getCaller();
  const faviconFile = formData.get('favicon');
  const rawUrl = (formData.get('faviconUrl') ?? '').toString();

  let faviconUrl: string | null = null;

  if (faviconFile instanceof File && faviconFile.size > 0) {
    const { url } = await uploadGithubAsset({
      file: faviconFile,
      folder: `settings/${new Date().toISOString().slice(0, 10)}`,
      allowedTypes: FAVICON_ALLOWED_TYPES,
      maxBytes: MAX_FAVICON_BYTES,
      filenamePrefix: 'favicon',
    });
    faviconUrl = url;
  } else {
    faviconUrl = rawUrl.trim().length > 0 ? rawUrl.trim() : null;
  }

  await caller.admin.updateSiteSettings({ faviconUrl });
  revalidatePath('/', 'layout');
  revalidatePath('/admin/settings');
}

async function clearFaviconAction(_: FormData) {
  'use server';
  const caller = await getCaller();
  await caller.admin.updateSiteSettings({ faviconUrl: null });
  revalidatePath('/', 'layout');
  revalidatePath('/admin/settings');
}

async function saveCustomCodeAction(formData: FormData) {
  'use server';
  const caller = await getCaller();
  const customCss = (formData.get('customCss') ?? '').toString();
  const customJs = (formData.get('customJs') ?? '').toString();
  const customHtml = (formData.get('customHtml') ?? '').toString();

  await caller.admin.updateSiteSettings({ customCss, customJs, customHtml });
  revalidatePath('/', 'layout');
  revalidatePath('/admin/settings');
}

export default async function AdminSettings() {
  const settings = await getSiteSettings();

  return (
    <div className="space-y-10">
      <div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.4em] text-zinc-500">
          <Sparkles className="h-4 w-4" />
          Settings
        </div>
        <h1 className="mt-4 text-3xl font-semibold">Site Settings</h1>
        <p className="mt-2 text-zinc-400">
          Manage favicon branding and inject custom code across the site.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Favicon</h2>
        <div className="border border-zinc-800 bg-zinc-950/60 p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            {settings.faviconUrl ? (
              <img
                src={settings.faviconUrl}
                alt="Current favicon"
                className="h-12 w-12 rounded border border-zinc-800 bg-black/40 object-contain"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded border border-zinc-800 bg-black/40 text-zinc-500">
                <FileImage className="h-5 w-5" />
              </div>
            )}
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                Upload favicon
              </div>
              <form action={saveFaviconAction} className="space-y-3">
                <input
                  type="file"
                  name="favicon"
                  accept={faviconAccept}
                  className="text-xs text-zinc-300 file:mr-3 file:border file:border-[#00ff41]/40 file:bg-transparent file:px-3 file:py-1 file:text-xs file:uppercase file:tracking-[0.3em] file:text-[#00ff41] hover:file:bg-[#00ff41] hover:file:text-black transition"
                />
                <input
                  type="text"
                  name="faviconUrl"
                  placeholder="Or paste an absolute URL (/favicon.ico or https://...)"
                  defaultValue={settings.faviconUrl ?? ''}
                  className="w-full border border-zinc-800 bg-transparent px-3 py-2 text-sm outline-none focus:border-[#00ff41]/60"
                />
                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    className="border border-[#00ff41]/40 px-4 py-2 text-xs uppercase tracking-[0.3em] text-[#00ff41] hover:bg-[#00ff41] hover:text-black transition"
                  >
                    Save favicon
                  </button>
                  {settings.faviconUrl ? (
                    <button
                      formAction={clearFaviconAction}
                      className="border border-red-500/40 px-4 py-2 text-xs uppercase tracking-[0.3em] text-red-400 hover:bg-red-500 hover:text-black transition"
                    >
                      Remove favicon
                    </button>
                  ) : null}
                </div>
              </form>
              <p className="text-xs text-zinc-500">
                Accepted: PNG, JPG, WEBP, ICO. Max {MAX_FAVICON_MB}MB.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Custom Code Injection</h2>
        <div className="border border-zinc-800 bg-zinc-950/60 p-6 space-y-6">
          <p className="text-sm text-zinc-400">
            CSS is injected into the <span className="text-zinc-200">head</span>,
            HTML is appended before the end of <span className="text-zinc-200">body</span>,
            and JS is appended after HTML.
          </p>
          <form action={saveCustomCodeAction} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                Custom CSS
              </label>
              <textarea
                name="customCss"
                defaultValue={settings.customCss}
                maxLength={MAX_CODE_SIZE}
                rows={6}
                className="w-full border border-zinc-800 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#00ff41]/60"
                placeholder="/* Injected into <head> */"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                Custom HTML
              </label>
              <textarea
                name="customHtml"
                defaultValue={settings.customHtml}
                maxLength={MAX_CODE_SIZE}
                rows={6}
                className="w-full border border-zinc-800 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#00ff41]/60"
                placeholder="<!-- Injected at end of body -->"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                Custom JavaScript
              </label>
              <textarea
                name="customJs"
                defaultValue={settings.customJs}
                maxLength={MAX_CODE_SIZE}
                rows={6}
                className="w-full border border-zinc-800 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#00ff41]/60"
                placeholder="// Injected at end of body"
              />
            </div>
            <button
              type="submit"
              className="border border-[#00ff41]/40 px-4 py-2 text-xs uppercase tracking-[0.3em] text-[#00ff41] hover:bg-[#00ff41] hover:text-black transition"
            >
              Save custom code
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
