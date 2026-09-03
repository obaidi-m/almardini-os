/** Shared renewal-window rule used by /renewals, the dashboard, the Active
 *  Services card, and the on-Done auto-fill of cases.expires_at.
 *
 *  Service scheduling model (see migration 025):
 *    - schedule_kind = 'one_off'          : no recurrence. Validity may
 *                                            still stamp a shelf-life expiry.
 *    - schedule_kind = 'annual_fixed'     : one fixed date per year
 *                                            (month/day). RUPS, SPT Tahunan.
 *    - schedule_kind = 'quarterly_fixed'  : same day-of-month across four
 *                                            anchor months (default
 *                                            Jan/Apr/Jul/Oct). LKPM.
 *
 *  The reminder window is derived from what the service actually is:
 *    annual_fixed or year-scale validity  → 90 days out
 *    quarterly_fixed or quarter-scale     → 30 days out
 *    anything shorter                     → 10 days out
 */

export type ServiceSchedule = {
  schedule_kind: "one_off" | "annual_fixed" | "quarterly_fixed" | null;
  annual_month: number | null;
  annual_day: number | null;
  quarterly_day: number | null;
  quarterly_months: number[] | null;
  validity_amount: number | null;
  validity_unit: string | null;
} | null;

function toDays(amount: number | null, unit: string | null): number | null {
  if (!amount || !unit) return null;
  if (unit === "days")   return amount;
  if (unit === "months") return amount * 30;
  if (unit === "years")  return amount * 365;
  return null;
}

/** Approximate cadence length in days — for bucketing the reminder window
 *  only, never for scheduling. Annual = 365, quarterly = 90; validity is
 *  used only when no calendar schedule is set (immigration services). */
export function cadenceDays(svc: ServiceSchedule): number {
  if (!svc) return 0;
  if (svc.schedule_kind === "annual_fixed") return 365;
  if (svc.schedule_kind === "quarterly_fixed") return 90;
  return toDays(svc.validity_amount, svc.validity_unit) ?? 0;
}

export function leadDaysForService(svc: ServiceSchedule): number {
  const c = cadenceDays(svc);
  if (c >= 300) return 90;
  if (c >=  60) return 30;
  return 10;
}

export function daysUntil(iso: string): number {
  const d = new Date(iso + "T00:00:00");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.floor((d.getTime() - today.getTime()) / 86_400_000);
}

export type RenewalTier = "overdue" | "due_soon" | "later" | "unknown";

export function renewalTier(expiresAtIso: string | null, svc: ServiceSchedule): RenewalTier {
  if (!expiresAtIso) return "unknown";
  const n = daysUntil(expiresAtIso);
  if (n < 0) return "overdue";
  if (n <= leadDaysForService(svc)) return "due_soon";
  return "later";
}

/* ------- Calendar-fixed next-occurrence helpers ------- */

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Clamp day-of-month to the target month's actual length so e.g. 31 on
 *  February resolves to Feb 28/29 rather than overflowing to March. */
function makeDate(year: number, month1: number, day: number): Date {
  const lastDay = new Date(year, month1, 0).getDate();
  return new Date(year, month1 - 1, Math.min(day, lastDay));
}

/** Next occurrence of (month, day) more than `minDaysAhead` after `from`.
 *  minDaysAhead lets callers skip a candidate that falls inside the
 *  service's own reminder window — that candidate is almost always the
 *  cycle the operator just completed. Returns an ISO YYYY-MM-DD date. */
export function nextAnnualOccurrence(
  month: number, day: number, from: Date = new Date(), minDaysAhead = 0,
): string {
  const anchor = new Date(from); anchor.setHours(0, 0, 0, 0);
  const floor = new Date(anchor); floor.setDate(floor.getDate() + minDaysAhead);
  let year = anchor.getFullYear();
  let candidate = makeDate(year, month, day);
  while (candidate <= floor) candidate = makeDate(++year, month, day);
  return toIsoDate(candidate);
}

/** Next occurrence of `day` in any of `months` (1-12), more than
 *  `minDaysAhead` after `from`. Walks year-by-year until a candidate
 *  clears the floor (bounded — we never need more than two years). */
export function nextQuarterlyOccurrence(
  day: number, months: number[], from: Date = new Date(), minDaysAhead = 0,
): string {
  const anchor = new Date(from); anchor.setHours(0, 0, 0, 0);
  const floor = new Date(anchor); floor.setDate(floor.getDate() + minDaysAhead);
  const sorted = [...months].sort((a, b) => a - b);
  const candidates: Date[] = [];
  for (const y of [anchor.getFullYear(), anchor.getFullYear() + 1, anchor.getFullYear() + 2]) {
    for (const m of sorted) candidates.push(makeDate(y, m, day));
  }
  const hit = candidates.find((d) => d > floor);
  return toIsoDate(hit!);
}

/** Compute expires_at for a service that just moved to Done. Skips the
 *  candidate that falls inside the service's reminder window, since the
 *  operator marking Done today is almost always closing the cycle whose
 *  deadline is coming up — pushing them onto that same date would mean
 *  the successor case reminds them again for work they just finished.
 *  Returns null when the service has no schedule. */
export function computeNextExpiry(svc: ServiceSchedule, from: Date = new Date()): string | null {
  if (!svc) return null;
  const skip = leadDaysForService(svc);
  if (svc.schedule_kind === "annual_fixed" && svc.annual_month && svc.annual_day) {
    return nextAnnualOccurrence(svc.annual_month, svc.annual_day, from, skip);
  }
  if (svc.schedule_kind === "quarterly_fixed" && svc.quarterly_day && svc.quarterly_months?.length) {
    return nextQuarterlyOccurrence(svc.quarterly_day, svc.quarterly_months, from, skip);
  }
  // one_off with validity → today + validity (shelf life of the output).
  const validity = toDays(svc.validity_amount, svc.validity_unit);
  if (validity && validity > 0) {
    const d = new Date(from); d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + validity);
    return toIsoDate(d);
  }
  return null;
}

/** True when the service will spawn a successor case on Delivered. Both
 *  calendar-fixed kinds spawn; one_off does not. */
export function serviceRepeats(svc: ServiceSchedule): boolean {
  if (!svc) return false;
  return svc.schedule_kind === "annual_fixed" || svc.schedule_kind === "quarterly_fixed";
}

export const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
