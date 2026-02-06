import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { siteSettings } from '@/db/schema';

export type SiteSettings = {
  faviconUrl: string | null;
  customCss: string;
  customJs: string;
  customHtml: string;
};

const defaultSettings: SiteSettings = {
  faviconUrl: null,
  customCss: '',
  customJs: '',
  customHtml: '',
};

export async function getSiteSettings(): Promise<SiteSettings> {
  const [row] = await db
    .select({
      faviconUrl: siteSettings.faviconUrl,
      customCss: siteSettings.customCss,
      customJs: siteSettings.customJs,
      customHtml: siteSettings.customHtml,
    })
    .from(siteSettings)
    .where(eq(siteSettings.id, 1))
    .limit(1);

  if (!row) return defaultSettings;

  return {
    faviconUrl: row.faviconUrl ?? null,
    customCss: row.customCss ?? '',
    customJs: row.customJs ?? '',
    customHtml: row.customHtml ?? '',
  };
}
