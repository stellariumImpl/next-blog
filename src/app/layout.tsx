import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import RouteProgress from '@/components/route-progress';
import SiteFooter from '@/components/site-footer';
import AudioDockProvider from '@/components/audio/audio-dock-provider';
import RouteTransition from '@/components/route-transition';
import Spotlight from '@/components/spotlight';
import './globals.css';
import 'katex/dist/katex.min.css';

export const metadata: Metadata = {
  title: 'Digital Archive Blog',
  description: 'Blog and admin console',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = cookies().get('theme')?.value === 'light' ? 'light' : 'dark';
  return (
    <html lang="en" data-theme={theme}>
      <body>
        <RouteProgress />
        <Spotlight />
        <RouteTransition />
        <div className="min-h-screen pb-12">{children}</div>
        <SiteFooter />
        <AudioDockProvider />
      </body>
    </html>
  );
}
