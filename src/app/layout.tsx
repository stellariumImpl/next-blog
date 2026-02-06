import type { Metadata } from "next";
import { cookies } from "next/headers";
import RouteProgress from "@/components/route-progress";
import SiteFooter from "@/components/site-footer";
import AudioDockProvider from "@/components/audio/audio-dock-provider";
import RouteTransition from "@/components/route-transition";
import Spotlight from "@/components/spotlight";
import GlobalLoading from "@/components/global-loading";
import { getSiteSettings } from "@/lib/site-settings";
import "./globals.css";
import "katex/dist/katex.min.css";

export const metadata: Metadata = {
  title: "CORE_DUMP",
  description: "Blog and admin console",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = cookies().get("theme")?.value === "light" ? "light" : "dark";
  const settings = await getSiteSettings();
  return (
    <html lang="en" data-theme={theme}>
      <head>
        {settings.faviconUrl ? (
          <>
            <link rel="icon" href={settings.faviconUrl} />
            <link rel="apple-touch-icon" href={settings.faviconUrl} />
          </>
        ) : null}
        {settings.customCss.trim().length > 0 ? (
          <style
            id="site-custom-css"
            dangerouslySetInnerHTML={{ __html: settings.customCss }}
          />
        ) : null}
      </head>
      <body>
        <GlobalLoading />
        <RouteProgress />
        <Spotlight />
        <RouteTransition />
        <div className="min-h-screen pb-12">{children}</div>
        <SiteFooter />
        <AudioDockProvider />
        {settings.customHtml.trim().length > 0 ? (
          <div
            id="site-custom-html"
            dangerouslySetInnerHTML={{ __html: settings.customHtml }}
          />
        ) : null}
        {settings.customJs.trim().length > 0 ? (
          <script
            id="site-custom-js"
            dangerouslySetInnerHTML={{ __html: settings.customJs }}
          />
        ) : null}
      </body>
    </html>
  );
}
