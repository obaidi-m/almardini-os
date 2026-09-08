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
  if (c >= 300) return 60;  // annual
  if (c >=  60) return 20;  // quarterly
  return 10;                // monthly / short
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

/** Set of service_ids whose reminder should be SUPPRESSED because a case
 *  for that service on this entity was already opened inside the current
 *  reminder window. Any case status counts (new / in_progress / done /
 *  delivered) — the case's existence is the receipt that "we're handling
 *  this cycle." When the next cycle rolls in, the old case falls outside
 *  the new window and the reminder re-arms automatically.
 *
 *  Feed it every case for the entity — the service_id + created_at + the
 *  service's schedule fields. Returns a plain string[] so it crosses the
 *  server/client boundary. */
export function handledServiceIdsFromCases(
  cases: Array<{ service_id: string | null; created_at: string; service: ServiceSchedule }>,
): string[] {
  const out = new Set<string>();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (const c of cases) {
    if (!c.service_id || !c.service) continue;
    const next = effectiveExpiryDate(null, c.service);
    if (!next) continue;
    const lead = leadDaysForService(c.service);
    const windowStart = new Date(next + "T00:00:00");
    windowStart.setDate(windowStart.getDate() - lead);
    const created = new Date(c.created_at);
    if (created >= windowStart) out.add(c.service_id);
  }
  return [...out];
}

/** True when today is inside the service's reminder window for its next
 *  scheduled occurrence — i.e. between (nextOccurrence - leadDays) and
 *  nextOccurrence itself. Used by the company/client Services card to show
 *  the simple "⏰ time for this service" line on ongoing subscriptions
 *  without tracking cycles or spawning cases. */
export function isInReminderWindow(svc: ServiceSchedule): boolean {
  if (!svc) return false;
  const next = effectiveExpiryDate(null, svc);
  if (!next) return false;
  const n = daysUntil(next);
  return n >= 0 && n <= leadDaysForService(svc);
}

/** Date to reason about for renewal urgency:
 *  - If `expires_date` is set (one-off, or a stamped subscription cycle), use it.
 *  - Else, for recurring services (annual_fixed / quarterly_fixed), compute
 *    the next scheduled occurrence. This is how ongoing subscriptions —
 *    which never stamp expires_date — still surface 90d/30d before their
 *    next cycle. Returns null when there is nothing to count toward. */
export function effectiveExpiryDate(
  expiresDate: string | null,
  svc: ServiceSchedule,
): string | null {
  if (expiresDate) return expiresDate;
  if (!svc) return null;
  if (svc.schedule_kind === "annual_fixed" && svc.annual_month && svc.annual_day) {
    return nextAnnualOccurrence(svc.annual_month, svc.annual_day);
  }
  if (svc.schedule_kind === "quarterly_fixed" && svc.quarterly_day && svc.quarterly_months?.length) {
    return nextQuarterlyOccurrence(svc.quarterly_day, svc.quarterly_months);
  }
  return null;
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
 *  deadline is coming up — landing on that same date would immediately
 *  re-remind them of work they just finished.
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

export const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
