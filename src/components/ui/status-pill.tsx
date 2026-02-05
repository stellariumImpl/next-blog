"use client";

type Status =
  | "pending"
  | "rejected"
  | "approved"
  | "published";

const statusStyles: Record<Status, { label: string; className: string }> = {
  pending: {
    label: "Pending",
    className:
      "border-amber-400/50 text-amber-400 bg-amber-400/10",
  },
  rejected: {
    label: "Rejected",
    className:
      "border-red-400/50 text-red-400 bg-red-400/10",
  },
  approved: {
    label: "Approved",
    className:
      "border-emerald-400/50 text-emerald-400 bg-emerald-400/10",
  },
  published: {
    label: "Published",
    className:
      "border-emerald-400/50 text-emerald-400 bg-emerald-400/10",
  },
};

export default function StatusPill({
  status,
  label,
}: {
  status: Status;
  label?: string;
}) {
  const config = statusStyles[status];
  return (
    <span
      className={`inline-flex items-center border px-2 py-0.5 text-[9px] uppercase tracking-[0.3em] ${config.className}`}
    >
      {label ?? config.label}
    </span>
  );
}
