'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export default function BackButton({
  fallback = '/',
  label = 'Back',
  className = '',
}: {
  fallback?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallback);
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className={`flex items-center gap-2 border border-zinc-700 px-3 py-1 text-[10px] uppercase tracking-[0.3em] hover:bg-white hover:text-black transition ${className}`}
    >
      <ArrowLeft className="h-3 w-3" />
      {label}
    </button>
  );
}
