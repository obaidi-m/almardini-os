import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { EntityServiceStatus } from "@/lib/types";
import { ResizableTable, type ColumnDef } from "@/components/app/ResizableTable";
import { ExpiryPill } from "@/components/app/ExpiryPill";
import {
  effectiveExpiryDate,
  renewalTier,
  type ServiceSchedule,
} from "@/lib/renewal";

// A "subscription" here = an entity_service whose catalog entry is either
// ongoing (LKPM, tax reporting) or on a fixed calendar recurrence
// (annual/quarterly). One-off services (KITAS, PT PMA setup) are not
// subscriptions — they live in /permits and /cases.

type Filter = "all" | "due_soon" | "overdue" | "later" | "paused" | "terminated";
type SearchParams = { filter?: string };

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all",         label: "All" },
  { key: "due_soon",    label: "Due soon" },
  { key: "overdue",     label: "Overdue" },
  { key: "later",       label: "Later" },
  { key: "paused",      label: "Paused" },
  { key: "terminated",  label: "Terminated" },
];

type ServiceRow = {
  id: string;
  code: string;
  name: string;
  schedule_kind: "one_off" | "annual_fixed" | "quarterly_fixed" | null;
  annual_month: number | null;
  annual_day: number | null;
  quarterly_day: number | null;
  quarterly_months: number[] | null;
  validity_amount: number | null;
  validity_unit: string | null;
  is_ongoing: boolean;
};

type Row = {
  id: string;
  company: { id: string; name: string; code: string };
  service: ServiceRow;
  cadence: string;
  nextDue: string | null;
  status: EntityServiceStatus;
  tier: "overdue" | "due_soon" | "later" | "unknown";
};

function cadenceLabel(svc: ServiceRow): string {
  if (svc.schedule_kind === "annual_fixed") return "Annual";
  if (svc.schedule_kind === "quarterly_fixed") return "Quarterly";
  if (svc.is_ongoing) return "Ongoing";
  return "—";
}

function fmtDate(v: string | null): string {
  if (!v) return "—";
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createClient();
  const filter: Filter =
    (FILTERS.find((f) => f.key === searchParams.filter)?.key ?? "all") as Filter;

  // Pull every company-attached entity_service whose service catalog entry
  // is ongoing OR calendar-recurring. Exclude soft-deleted and one-off
  // services outright (they belong in /permits or /cases, not here).
  const { data, error } = await supabase
    .from("entity_services")
    .select(
      `
      id, expires_date, status,
      company:companies!entity_services_company_id_fkey(id, name, code),
      service:service_types!inner(
        id, code, name, is_ongoing, schedule_kind,
        annual_month, annual_day, quarterly_day, quarterly_months,
        validity_amount, validity_unit
      )
    `,
    )
    .is("deleted_at", null)
    .not("company_id", "is", null)
    .or("is_ongoing.eq.true,schedule_kind.in.(annual_fixed,quarterly_fixed)", {
      referencedTable: "service_types",
    })
    .order("expires_date", { ascending: true, nullsFirst: false })
    .limit(2000);

  if (error) {
    return (
      <div className="text-[13px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
        {error.message}
      </div>
    );
  }

  const unwrap = <T,>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? v[0] ?? null : v ?? null;

  const rowsAll: Row[] = ((data ?? []) as Array<{
    id: string;
    expires_date: string | null;
    status: EntityServiceStatus;
    company: { id: string; name: string; code: string }[] | { id: string; name: string; code: string } | null;
    service: ServiceRow[] | ServiceRow | null;
  }>)
    .map((r) => {
      const company = unwrap(r.company);
      const service = unwrap(r.service);
      if (!company || !service) return null;
      const svcSched: ServiceSchedule = {
        schedule_kind: service.schedule_kind,
        annual_month: service.annual_month,
        annual_day: service.annual_day,
        quarterly_day: service.quarterly_day,
        quarterly_months: service.quarterly_months,
        validity_amount: service.validity_amount,
        validity_unit: service.validity_unit,
      };
      const nextDue = effectiveExpiryDate(r.expires_date, svcSched);
      const tier =
        r.status === "active" || r.status === "paused"
          ? renewalTier(nextDue, svcSched)
          : "unknown";
      return {
        id: r.id,
        company,
        service,
        cadence: cadenceLabel(service),
        nextDue,
        status: r.status,
        tier,
      } satisfies Row;
    })
    .filter((r): r is Row => r !== null);

  const counts = {
    all: rowsAll.length,
    due_soon: rowsAll.filter((r) => r.status === "active" && r.tier === "due_soon").length,
    overdue: rowsAll.filter((r) => r.status === "active" && r.tier === "overdue").length,
    later: rowsAll.filter((r) => r.status === "active" && r.tier === "later").length,
    paused: rowsAll.filter((r) => r.status === "paused").length,
    terminated: rowsAll.filter((r) => r.status === "terminated").length,
  };

  const rows = rowsAll.filter((r) => {
    switch (filter) {
      case "due_soon":   return r.status === "active" && r.tier === "due_soon";
      case "overdue":    return r.status === "active" && r.tier === "overdue";
      case "later":      return r.status === "active" && r.tier === "later";
      case "paused":     return r.status === "paused";
      case "terminated": return r.status === "terminated";
      default:           return true;
    }
  });

  const COLUMNS: ColumnDef[] = [
    { header: "Company",  defaultWidth: 260, minWidth: 160 },
    { header: "Service",  defaultWidth: 260, minWidth: 160 },
    { header: "Cadence",  defaultWidth: 100 },
    { header: "Next due", defaultWidth: 120 },
    { header: "Status",   defaultWidth: 120 },
  ];

  function hrefWith(f: Filter): string {
    return f === "all" ? "/subscriptions" : `/subscriptions?filter=${f}`;
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <h1 className="text-2xl font-semibold text-ink">Subscriptions</h1>
        <div className="text-xs text-[var(--muted)]">
          {rows.length} shown · {counts.all} total
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map((f) => {
          const n = counts[f.key];
          const active = filter === f.key;
          return (
            <Link
              key={f.key}
              href={hrefWith(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                active
                  ? "bg-brand text-white border-brand"
                  : "bg-white text-ink border-[var(--border)] hover:bg-[var(--surface-muted)]"
              }`}
            >
              {f.label} <span className="opacity-70">({n})</span>
            </Link>
          );
        })}
      </div>

      <ResizableTable storageKey="subscriptions-cols-v1" columns={COLUMNS}>
        {rows.length === 0 ? (
          <div className="py-16 text-center text-[13px] text-[var(--muted)]">
            Nothing in this bucket.
          </div>
        ) : (
          rows.map((r) => (
            <div
              key={r.id}
              className="group grid gap-3 px-3 py-2 text-[13px] items-center border-b border-[var(--border)] last:border-b-0 hover:bg-white/50 transition-colors"
              style={{ gridTemplateColumns: "var(--rt-cols)" }}
            >
              <div className="min-w-0">
                <Link href={`/companies/${r.company.id}`} className="flex items-center gap-2 min-w-0 group/name">
                  <span className="text-ink font-medium truncate group-hover/name:text-brand-dark">
                    {r.company.name}
                  </span>
                  <span className="font-mono text-[10.5px] text-brand-dark bg-brand-softer px-1.5 py-0.5 rounded shrink-0">
                    {r.company.code}
                  </span>
                </Link>
              </div>
              <div className="min-w-0">
                <div className="text-ink truncate">{r.service.name}</div>
                <div className="font-mono text-[10.5px] text-[var(--muted)]">{r.service.code}</div>
              </div>
              <div className="text-[12px] text-[var(--muted)]">{r.cadence}</div>
              <div className="whitespace-nowrap">
                {r.status === "active" && r.nextDue ? (
                  <ExpiryPill expires={r.nextDue} />
                ) : (
                  <span className="text-[var(--muted)]">{fmtDate(r.nextDue)}</span>
                )}
              </div>
              <div className="text-[12px] text-[var(--muted)] capitalize">{r.status}</div>
            </div>
          ))
        )}
      </ResizableTable>
    </div>
  );
}
