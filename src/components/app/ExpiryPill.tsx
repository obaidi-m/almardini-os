/** Single source of truth for expiry urgency in the app. Colors and
 *  thresholds live here so a subscription expiring next week reads the
 *  same in the Services card, the /permits table, /virtual-offices,
 *  /renewals, and the dashboard tile.
 *
 *  Bucket → color:
 *    expired    → dark red
 *    <30 days   → red
 *    30–60 days → amber
 *    >60 days   → grey (calm)
 */

type Bucket = "expired" | "urgent" | "soon" | "later";

export function expiryDaysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const target = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.floor((target.getTime() - t.getTime()) / 86_400_000);
}

export function expiryBucket(days: number | null): Bucket | null {
  if (days === null) return null;
  if (days < 0) return "expired";
  if (days <= 30) return "urgent";
  if (days <= 60) return "soon";
  return "later";
}

const STYLES: Record<Bucket, string> = {
  expired: "bg-[#7F1D1D] text-white",
  urgent:  "bg-[#FEE2E2] text-[#991B1B]",
  soon:    "bg-[#FEF3C7] text-[#92400E]",
  later:   "bg-[var(--surface-2)] text-[var(--muted)]",
};

const LABELS: Record<Bucket, (n: number) => string> = {
  expired: (n) => `expired ${-n}d`,
  urgent:  (n) => (n === 0 ? "today" : `in ${n}d`),
  soon:    (n) => `in ${n}d`,
  later:   (n) => `in ${n}d`,
};

export function ExpiryPill({
  expires, className = "",
}: {
  expires: string | null | undefined;
  className?: string;
}) {
  const days = expiryDaysUntil(expires);
  const bucket = expiryBucket(days);
  if (days === null || bucket === null) return null;
  return (
    <span
      className={`inline-flex items-center text-[10.5px] font-medium px-1.5 py-0 rounded-full whitespace-nowrap ${STYLES[bucket]} ${className}`}
      title={expires ?? undefined}
    >
      {LABELS[bucket](days)}
    </span>
  );
}
