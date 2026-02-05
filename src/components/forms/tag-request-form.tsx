'use client';

import { useEffect, useRef } from 'react';
import { useFormState } from 'react-dom';
import { Send } from 'lucide-react';

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

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
    }
  }, [state.ok]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <input
        name="name"
        disabled={disabled}
        required
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
