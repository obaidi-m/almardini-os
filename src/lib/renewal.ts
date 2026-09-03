/** Shared renewal-window rule used by /renewals, the dashboard, and the
 *  Active Services card on client/company pages.
 *
 *  A service's reminder lead time is derived from how often it comes up:
 *    yearly-ish   (cadence >= ~10 months) → 90 days before expiry
 *    quarterly-ish (cadence >= ~2 months) → 30 days before expiry
 *    monthly-ish  (cadence < 2 months)   → 10 days before expiry
 *
 *  Cadence is taken from the recurring interval when set (the natural gap
 *  between filings for LKPM-style services), falling back to the service's
 *  validity duration for one-off issuances like visas and KITAS. Anything
 *  with neither is treated as monthly — a conservative default that keeps
 *  short-fuse cases from slipping through. */

export type ServiceCadence = {
  recurring_amount: number | null;
  recurring_unit: string | null;
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

export function cadenceDays(svc: ServiceCadence): number {
  if (!svc) return 0;
  return (
    toDays(svc.recurring_amount, svc.recurring_unit) ??
    toDays(svc.validity_amount, svc.validity_unit) ??
    0
  );
}

export function leadDaysForService(svc: ServiceCadence): number {
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

export function renewalTier(expiresAtIso: string | null, svc: ServiceCadence): RenewalTier {
  if (!expiresAtIso) return "unknown";
  const n = daysUntil(expiresAtIso);
  if (n < 0) return "overdue";
  if (n <= leadDaysForService(svc)) return "due_soon";
  return "later";
}
