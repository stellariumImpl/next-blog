'use client';

import { useEffect, useState } from 'react';
import { useFormState } from 'react-dom';
import { Save } from 'lucide-react';

export type TagEditState = {
  ok: boolean;
  message: string;
};

export default function TagEditForm({
  action,
  initialName,
  initialSlug,
  isAdmin = false,
}: {
  action: (prevState: TagEditState, formData: FormData) => Promise<TagEditState>;
  initialName: string;
  initialSlug: string;
  isAdmin?: boolean;
}) {
  const [state, formAction] = useFormState(action, { ok: false, message: '' });
  const [name, setName] = useState(initialName);
  const [slug, setSlug] = useState(initialSlug);

  useEffect(() => {
    setName(initialName);
    setSlug(initialSlug);
  }, [initialName, initialSlug]);

  const helper = isAdmin
    ? 'Changes apply immediately.'
    : 'Edits are reviewed before updating the tag.';

  return (
    <form action={formAction} className="space-y-4">
      <div className="text-xs uppercase tracking-[0.3em] app-muted">Edit tag</div>
      <p className="text-sm app-muted-strong">{helper}</p>
      <div className="space-y-2">
        <label className="text-xs uppercase tracking-[0.3em] app-muted">Name</label>
        <input
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-full border app-border bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--app-text)]"
          placeholder="Tag name"
        />
      </div>
      <div className="space-y-2">
        <label className="text-xs uppercase tracking-[0.3em] app-muted">Slug</label>
        <input
          name="slug"
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          className="w-full border app-border bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--app-text)]"
          placeholder="optional-slug"
        />
      </div>
      <button
        type="submit"
        className="flex items-center gap-2 border border-[#00ff41]/40 px-4 py-2 text-xs uppercase tracking-[0.3em] text-[#00ff41] hover:bg-[#00ff41] hover:text-black transition"
      >
        <Save className="h-4 w-4" />
        {isAdmin ? 'Save Tag' : 'Request Update'}
      </button>
      {state.message && (
        <div className={`text-sm ${state.ok ? 'text-[#00ff41]' : 'text-red-400'}`}>
          {state.message}
        </div>
      )}
    </form>
  );
}
