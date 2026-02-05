import type { ReactNode } from 'react';

export default function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="border app-border panel-bg p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border app-border app-muted">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-semibold app-text">{title}</h3>
      {description && <p className="mt-2 text-sm app-muted-strong">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
