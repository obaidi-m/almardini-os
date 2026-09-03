"use client";
import Link from "next/link";
import type { CaseStatus } from "@/lib/types";
import { daysUntil, leadDaysForService } from "@/lib/renewal";

export type ActiveServiceCase = {
  id: string;
  code: string;
  title: string | null;
  status: CaseStatus;
  expires_at: string | null;
  service: {
    id: string;
    name: string;
    recurring_amount: number | null;
    recurring_unit: string | null;
    validity_amount: number | null;
    validity_unit: string | null;
  } | null;
};

/** Project a client's or company's cases down to a "what services are you
 *  currently on the hook for" list. Excludes delivered cases (finished work).
 *  Keeps only cases that carry a renewal signal: an expires_at on the case
 *  itself, or a recurring service (LKPM quarterly etc). One row per case —
 *  we don't dedupe by service, because two live filings of the same service
 *  is itself information the operator wants to see. */
function pickRenewable(rows: ActiveServiceCase[]): ActiveServiceCase[] {
  return rows.filter((c) => {
    if (c.status === "delivered") return false;
    if (c.expires_at) return true;
    const svc = c.service;
    return !!(svc?.recurring_amount && svc?.recurring_unit);
  });
}

type Urgency = {
  label: string;
  className: string;
  tier: "overdue" | "due_soon" | "later" | "unknown";
};

function urgency(c: ActiveServiceCase): Urgency {
  if (!c.expires_at) return { label: "no expiry set", className: "text-[var(--muted)]", tier: "unknown" };
  const n = daysUntil(c.expires_at);
  const lead = leadDaysForService(c.service);
  if (n < 0)        return { label: `overdue ${-n}d`, className: "text-red-700 font-semibold", tier: "overdue" };
  if (n <= lead)    return { label: `in ${n}d`,        className: "text-[#8A6919] font-semibold", tier: "due_soon" };
  return { label: `in ${n}d`, className: "text-[var(--muted)]", tier: "later" };
}

function fmt(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export function ActiveServicesList({ cases }: { cases: ActiveServiceCase[] }) {
  const rows = pickRenewable(cases).sort((a, b) => {
    if (a.expires_at && b.expires_at) return a.expires_at.localeCompare(b.expires_at);
    if (a.expires_at) return -1;
    if (b.expires_at) return 1;
    return 0;
  });

  if (rows.length === 0) {
    return <p className="text-[12.5px] text-[var(--muted)]">No services currently tracked for renewal.</p>;
  }

  return (
    <ul className="divide-y divide-[var(--border)] -mx-1">
      {rows.map((c) => {
        const svc = c.service;
        const u = urgency(c);
        const isRecurring = !!(svc?.recurring_amount && svc?.recurring_unit);
        const showReminder = u.tier === "overdue" || u.tier === "due_soon";
        return (
          <li key={c.id}>
            <Link
              href={`/cases/${c.id}`}
              className={`grid grid-cols-[1fr_auto] gap-3 items-center px-1 py-2.5 text-[13.5px] hover:bg-[var(--surface-deep)] rounded ${
                u.tier === "overdue" ? "bg-red-50/50" : u.tier === "due_soon" ? "bg-amber-50/50" : ""
              }`}
            >
              <span className="min-w-0">
                <span className="text-ink font-medium block truncate">
                  {svc?.name || c.title || "Service"}
                  {isRecurring && (
                    <span className="text-[9.5px] font-medium text-[#5B21B6] bg-[#EDE9FE] px-1 py-0 rounded ml-1.5 align-middle"
                      title={`Recurring every ${svc?.recurring_amount} ${svc?.recurring_unit}`}>
                      recurring
                    </span>
                  )}
                  {showReminder && (
                    <span className={`text-[9.5px] font-semibold px-1 py-0 rounded ml-1.5 align-middle uppercase tracking-wide ${
                      u.tier === "overdue"
                        ? "text-red-800 bg-red-100"
                        : "text-[#8A6919] bg-[#FEF3C7]"
                    }`}>
                      {u.tier === "overdue" ? "overdue" : "renew soon"}
                    </span>
                  )}
                </span>
                <span className="text-[11.5px] text-[var(--muted)] block truncate">
                  <span className="font-mono">{c.code}</span>
                  {c.expires_at && <> · expires {fmt(c.expires_at)}</>}
                </span>
              </span>
              <span className={`text-[11.5px] tabular-nums ${u.className}`}>{u.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
