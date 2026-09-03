"use client";
import Link from "next/link";
import type { CaseStatus } from "@/lib/types";

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

function daysUntil(iso: string): number {
  const d = new Date(iso + "T00:00:00");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.floor((d.getTime() - today.getTime()) / 86_400_000);
}

function urgency(iso: string | null): { label: string; className: string } {
  if (!iso) return { label: "no expiry set", className: "text-[var(--muted)]" };
  const n = daysUntil(iso);
  if (n < 0) return { label: `overdue ${-n}d`, className: "text-red-700 font-semibold" };
  if (n <= 30) return { label: `in ${n}d`, className: "text-[#8A6919] font-medium" };
  if (n <= 90) return { label: `in ${n}d`, className: "text-ink" };
  return { label: `in ${n}d`, className: "text-[var(--muted)]" };
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
        const u = urgency(c.expires_at);
        const isRecurring = !!(svc?.recurring_amount && svc?.recurring_unit);
        return (
          <li key={c.id}>
            <Link
              href={`/cases/${c.id}`}
              className="grid grid-cols-[1fr_auto] gap-3 items-center px-1 py-2.5 text-[13.5px] hover:bg-[var(--surface-deep)] rounded"
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
