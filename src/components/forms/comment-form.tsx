'use client';

import { useEffect, useState, type RefObject } from 'react';
import { useFormState } from 'react-dom';
import { Send } from 'lucide-react';
import { useUIStore } from '@/store/ui';

export type CommentState = {
  ok: boolean;
  message: string;
};

export default function CommentForm({
  action,
  disabled,
  draft,
  onDraftChange,
  onSubmitted,
  textareaRef,
  label = 'Leave a Comment',
  submitLabel = 'Submit Comment',
  compact = false,
  className,
  textareaClassName,
  parentId,
}: {
  action: (prevState: CommentState, formData: FormData) => Promise<CommentState>;
  disabled?: boolean;
  draft?: string;
  onDraftChange?: (value: string) => void;
  onSubmitted?: () => void;
  textareaRef?: RefObject<HTMLTextAreaElement>;
  label?: string;
  submitLabel?: string;
  compact?: boolean;
  className?: string;
  textareaClassName?: string;
  parentId?: string | null;
}) {
  const [state, formAction] = useFormState(action, { ok: false, message: '' });
  const [localBody, setLocalBody] = useState(draft ?? '');
  const isControlled = typeof draft === 'string' && typeof onDraftChange === 'function';
  const body = isControlled ? draft : localBody;
  const setBody = isControlled ? onDraftChange : setLocalBody;
  const flashSystemMsg = useUIStore((state) => state.flashSystemMsg);

  useEffect(() => {
    if (!isControlled && typeof draft === 'string') {
      setLocalBody(draft);
    }
  }, [draft, isControlled]);

  useEffect(() => {
    if (!state.ok) return;
    if (!isControlled) {
      setLocalBody('');
    }
    onSubmitted?.();
  }, [isControlled, onSubmitted, state.ok]);

  const formSpacing = compact ? 'space-y-3' : 'space-y-4';
  const textareaHeight = compact ? 'min-h-[96px]' : 'min-h-[140px]';
  const buttonSize = compact ? 'px-3 py-2 text-[10px]' : 'px-4 py-2 text-xs';

  return (
    <form
      action={formAction}
      className={`${formSpacing} ${className ?? ''}`}
      noValidate
      onSubmit={(event) => {
        if (disabled) return;
        if (!body.trim()) {
          event.preventDefault();
          flashSystemMsg('COMMENT_BODY_REQUIRED');
        }
      }}
    >
      {parentId && <input type="hidden" name="parentId" value={parentId} />}
      <label className="text-xs uppercase tracking-[0.3em] app-muted">
        {label}
      </label>
      <textarea
        name="body"
        disabled={disabled}
        ref={textareaRef}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        className={`w-full border app-border bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--app-text)] ${textareaHeight} disabled:opacity-60 ${textareaClassName ?? ''}`}
        placeholder={disabled ? 'Sign in to comment.' : 'Add your thoughts...'}
      />
      <button
        type="submit"
        disabled={disabled}
        className={`flex items-center gap-2 border border-[#00ff41]/40 ${buttonSize} uppercase tracking-[0.3em] text-[#00ff41] hover:bg-[#00ff41] hover:text-black transition disabled:opacity-60`}
      >
        <Send className="h-4 w-4" />
        {submitLabel}
      </button>
      {state.message && (
        <div className={`text-sm ${state.ok ? 'text-[#00ff41]' : 'text-red-400'}`}>
          {state.message}
        </div>
      )}
    </form>
  );
}
