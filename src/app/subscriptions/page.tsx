import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { EntityServiceStatus } from "@/lib/types";
import { ResizableTable, type ColumnDef } from "@/components/app/ResizableTable";

// Subscriptions is a customer roster: one row per company, chips for the
// services they're currently paying us for. Not a cycle grid — that's
// Renewals' job. Not a per-service detail view — that's the company page.
// A "subscription" = an active entity_service whose catalog entry is
// ongoing, calendar-recurring, or rolling. Terminated/paused rows are
// hidden by design — this page answers "who pays us right now."

type CompanyRef = { id: string; name: string; code: string };
type ServiceRef = { id: string; code: string | null; name: string };

type Row = {
  company: CompanyRef;
  services: ServiceRef[];
};

type SearchParams = { service?: string };

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("entity_services")
    .select(
      `
      status,
      company:companies!entity_services_company_id_fkey(id, name, code),
      service:service_types!inner(id, code, name, is_ongoing, schedule_kind)
    `,
    )
    .is("deleted_at", null)
    .not("company_id", "is", null)
    .eq("status", "active" satisfies EntityServiceStatus)
    .or(
      "is_ongoing.eq.true,schedule_kind.in.(annual_fixed,quarterly_fixed,rolling)",
      { referencedTable: "service_types" },
    )
    .limit(4000);

  if (error) {
    return (
      <div className="text-[13px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
        {error.message}
      </div>
    );
  }

  const unwrap = <T,>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? v[0] ?? null : v ?? null;

  // Group by company. Dedupe services within a company.
  const grouped = new Map<string, Row>();
  const catalog = new Map<string, ServiceRef>();
  for (const raw of (data ?? []) as Array<{
    company: CompanyRef | CompanyRef[] | null;
    service: ServiceRef | ServiceRef[] | null;
  }>) {
    const company = unwrap(raw.company);
    const service = unwrap(raw.service);
    if (!company || !service) continue;
    catalog.set(service.id, service);
    const existing = grouped.get(company.id);
    if (existing) {
      if (!existing.services.some((s) => s.id === service.id)) {
        existing.services.push(service);
      }
    } else {
      grouped.set(company.id, { company, services: [service] });
    }
  }

  // Filter: ?service=id1,id2 keeps companies subscribed to ANY of the
  // selected services. Any = OR is the natural read ("show me everyone on
  // VO") — AND would answer a different, rarer question.
  const selectedIds = new Set(
    (searchParams.service ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  );

  const allRows = Array.from(grouped.values())
    .map((r) => ({
      ...r,
      services: [...r.services].sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.company.name.localeCompare(b.company.name));

  const rows =
    selectedIds.size === 0
      ? allRows
      : allRows.filter((r) => r.services.some((s) => selectedIds.has(s.id)));

  const totalServiceInstances = rows.reduce((n, r) => n + r.services.length, 0);

  // Chip filter options: every unique service that appears in the (pre-filter)
  // result set, sorted by name. Counts reflect the unfiltered dataset so
  // toggling a filter never hides the chip that turned it on.
  const chipOptions = Array.from(catalog.values())
    .map((s) => ({
      ...s,
      count: allRows.filter((r) => r.services.some((x) => x.id === s.id)).length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  function hrefWithService(nextIds: string[]): string {
    if (nextIds.length === 0) return "/subscriptions";
    return `/subscriptions?service=${nextIds.join(",")}`;
  }

  const COLUMNS: ColumnDef[] = [
    { header: "Company",       defaultWidth: 300, minWidth: 180 },
    { header: "Subscribed to", defaultWidth: 700, minWidth: 240 },
  ];

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <h1 className="text-2xl font-semibold text-ink">Subscriptions</h1>
        <div className="text-xs text-[var(--muted)]">
          {rows.length} {rows.length === 1 ? "company" : "companies"} · {totalServiceInstances} active
        </div>
      </div>

      {chipOptions.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] uppercase tracking-wide text-[var(--muted)] font-semibold mr-1">Filter:</span>
          <Link
            href={hrefWithService([])}
            className={`px-2.5 py-1 rounded-full text-[11.5px] font-medium border ${
              selectedIds.size === 0
                ? "bg-ink text-white border-ink"
                : "bg-white text-ink border-[var(--border)] hover:bg-[var(--surface-muted)]"
            }`}
          >
            All
          </Link>
          {chipOptions.map((s) => {
            const active = selectedIds.has(s.id);
            const next = active
              ? Array.from(selectedIds).filter((id) => id !== s.id)
              : [...Array.from(selectedIds), s.id];
            return (
              <Link
                key={s.id}
                href={hrefWithService(next)}
                className={`px-2.5 py-1 rounded-full text-[11.5px] font-medium border ${
                  active
                    ? "bg-brand text-white border-brand"
                    : "bg-white text-ink border-[var(--border)] hover:bg-[var(--surface-muted)]"
                }`}
              >
                {s.name} <span className={active ? "opacity-80" : "text-[var(--muted)]"}>({s.count})</span>
              </Link>
            );
          })}
          {selectedIds.size > 0 && (
            <Link
              href={hrefWithService([])}
              className="ml-1 text-[11px] text-[var(--muted)] hover:text-ink px-1"
            >
              clear
            </Link>
          )}
        </div>
      )}

      <ResizableTable storageKey="subscriptions-cols-v2" columns={COLUMNS}>
        {rows.length === 0 ? (
          <div className="py-16 text-center text-[13px] text-[var(--muted)]">
            {selectedIds.size > 0
              ? "No companies match this filter."
              : "No companies with active subscriptions yet. Add an ongoing, calendar-recurring, or rolling service to a company to see it here."}
          </div>
        ) : (
          rows.map((r) => (
            <div
              key={r.company.id}
              className="grid gap-3 px-3 py-2.5 text-[13px] items-center border-b border-[var(--border)] last:border-b-0 hover:bg-white/50 transition-colors"
              style={{ gridTemplateColumns: "var(--rt-cols)" }}
            >
              <Link href={`/companies/${r.company.id}`} className="min-w-0 group flex items-center gap-2">
                <span className="text-ink font-medium truncate group-hover:text-brand-dark">
                  {r.company.name}
                </span>
                <span className="font-mono text-[10.5px] text-brand-dark bg-brand-softer px-1.5 py-0.5 rounded shrink-0">
                  {r.company.code}
                </span>
              </Link>
              <div className="flex flex-wrap gap-1.5 min-w-0">
                {r.services.map((s) => {
                  const highlighted = selectedIds.has(s.id);
                  return (
                    <span
                      key={s.id}
                      className={`inline-flex items-center rounded-full text-[11.5px] font-medium px-2 py-0.5 ${
                        highlighted
                          ? "bg-brand text-white"
                          : "bg-brand-softer text-brand-dark"
                      }`}
                      title={s.code ?? undefined}
                    >
                      {s.name}
                    </span>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </ResizableTable>
    </div>
  );
}
