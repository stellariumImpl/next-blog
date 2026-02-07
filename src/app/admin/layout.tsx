import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { requireAdmin } from '@/lib/auth-guard';
import Link from 'next/link';
import AdminNav from '@/components/admin/admin-nav';
import AdminThemeGuard from '@/components/admin/admin-theme-guard';
import AdminMobileNav from '@/components/admin/admin-mobile-nav';

export const metadata: Metadata = {
  title: 'Admin Console',
  description: 'Manage posts, pages, tags, and archives',
};

const navItems = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/posts', label: 'Posts' },
  { href: '/admin/comments', label: 'Comments' },
  { href: '/admin/pages', label: 'Pages' },
  { href: '/admin/tags', label: 'Tags' },
  { href: '/admin/settings', label: 'Settings' },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <AdminThemeGuard />
      <div className="flex">
        <aside className="hidden md:block w-64 border-r border-zinc-800 min-h-screen p-6">
          <div className="text-xs uppercase tracking-[0.3em] text-zinc-400">
            Admin Console
          </div>
          <AdminNav items={navItems} />
        </aside>
        <main className="flex-1 p-8 space-y-6">
          <AdminMobileNav items={navItems} />
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 border border-zinc-700 px-3 py-1 text-[10px] uppercase tracking-[0.3em] hover:bg-white hover:text-black transition"
            >
              Back to blog
            </Link>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
