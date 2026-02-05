import { format } from "date-fns";

type TimeStampProps = {
  value: Date | string | null | undefined;
  className?: string;
  tooltipClassName?: string;
};

export default function TimeStamp({
  value,
  className,
  tooltipClassName,
}: TimeStampProps) {
  if (!value) {
    return <span className={className}>--</span>;
  }
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return <span className={className}>--</span>;
  }
  const display = format(date, "MMM dd, yyyy");
  const full = format(date, "MMM dd, yyyy 'at' h:mm:ss a");

  return (
    <span className={`group/time relative inline-flex ${className ?? ""}`}>
      <span className="group-hover/time:underline">{display}</span>
      <span
        className={`pointer-events-none absolute left-1/2 top-0 z-50 hidden -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full bg-[color:var(--accent)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-black shadow-lg shadow-black/20 group-hover/time:block ${tooltipClassName ?? ""}`}
      >
        {full}
      </span>
    </span>
  );
}
