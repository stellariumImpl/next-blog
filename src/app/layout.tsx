import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import RouteProgress from '@/components/route-progress';
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
        {children}
      </body>
    </html>
  );
}
