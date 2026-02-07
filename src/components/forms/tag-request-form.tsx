'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState } from 'react-dom';
import { Send } from 'lucide-react';
import { useUIStore } from '@/store/ui';
import { createIdempotencyKey } from '@/lib/idempotency';

export type TagRequestState = {
  ok: boolean;
  message: string;
};

export default function TagRequestForm({
  action,
  disabled,
  isAdmin = false,
}: {
  action: (prevState: TagRequestState, formData: FormData) => Promise<TagRequestState>;
  disabled?: boolean;
  isAdmin?: boolean;
}) {
  const [state, formAction] = useFormState(action, { ok: false, message: '' });
  const formRef = useRef<HTMLFormElement | null>(null);
  const buttonLabel = isAdmin ? 'Create Tag' : 'Submit Tag Request';
  const flashSystemMsg = useUIStore((state) => state.flashSystemMsg);
  const [idempotencyKey, setIdempotencyKey] = useState(createIdempotencyKey());

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setIdempotencyKey(createIdempotencyKey());
    }
  }, [state.ok]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-4"
      noValidate
      onSubmit={(event) => {
        if (disabled) return;
        const form = event.currentTarget;
        const name = (form.elements.namedItem('name') as HTMLInputElement | null)
          ?.value ?? '';
        if (!name.trim()) {
          event.preventDefault();
          flashSystemMsg('TAG_NAME_REQUIRED');
        }
      }}
    >
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input
        name="name"
        disabled={disabled}
        className="w-full border app-border bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--app-text)] disabled:opacity-60"
        placeholder={disabled ? 'Sign in to request a tag.' : 'Tag name'}
      />
      <input
        name="slug"
        disabled={disabled}
        className="w-full border app-border bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--app-text)] disabled:opacity-60"
        placeholder="optional-slug"
      />
      <button
        type="submit"
        disabled={disabled}
        className="flex items-center gap-2 border border-[#00ff41]/40 px-4 py-2 text-xs uppercase tracking-[0.3em] text-[#00ff41] hover:bg-[#00ff41] hover:text-black transition disabled:opacity-60"
      >
        <Send className="h-4 w-4" />
        {buttonLabel}
      </button>
      {state.message && (
        <div className={`text-sm ${state.ok ? 'text-[#00ff41]' : 'text-red-400'}`}>
          {state.message}
        </div>
      )}
    </form>
  );
}
