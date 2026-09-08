import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { EntityServiceStatus } from "@/lib/types";

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

export default async function SubscriptionsPage() {
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

  // Group by company. Dedupe services within a company — a company only
  // needs to see "RUPS" once even if they have two entity_service rows for
  // some historical reason.
  const grouped = new Map<string, Row>();
  for (const raw of (data ?? []) as Array<{
    company: CompanyRef | CompanyRef[] | null;
    service: ServiceRef | ServiceRef[] | null;
  }>) {
    const company = unwrap(raw.company);
    const service = unwrap(raw.service);
    if (!company || !service) continue;
    const existing = grouped.get(company.id);
    if (existing) {
      if (!existing.services.some((s) => s.id === service.id)) {
        existing.services.push(service);
      }
    } else {
      grouped.set(company.id, { company, services: [service] });
    }
  }

  const rows = Array.from(grouped.values())
    .map((r) => ({
      ...r,
      services: [...r.services].sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.company.name.localeCompare(b.company.name));

  const totalServiceInstances = rows.reduce((n, r) => n + r.services.length, 0);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <h1 className="text-2xl font-semibold text-ink">Subscriptions</h1>
        <div className="text-xs text-[var(--muted)]">
          {rows.length} {rows.length === 1 ? "company" : "companies"} · {totalServiceInstances} active {totalServiceInstances === 1 ? "subscription" : "subscriptions"}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted)]">
          No companies with active subscriptions yet. Add an ongoing, calendar-recurring, or rolling service to a company to see it here.
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] bg-white overflow-hidden">
          <div className="grid grid-cols-[260px_1fr] gap-3 px-4 py-2 text-[11px] uppercase tracking-[0.06em] text-[var(--muted)] font-semibold border-b border-[var(--border-strong)] bg-[var(--surface-muted)]">
            <div>Company</div>
            <div>Subscribed to</div>
          </div>
          {rows.map((r) => (
            <div
              key={r.company.id}
              className="grid grid-cols-[260px_1fr] gap-3 px-4 py-3 items-center border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface-muted)] transition-colors"
            >
              <Link href={`/companies/${r.company.id}`} className="min-w-0 group flex items-center gap-2">
                <span className="text-ink font-medium truncate group-hover:text-brand-dark">
                  {r.company.name}
                </span>
                <span className="font-mono text-[10.5px] text-brand-dark bg-brand-softer px-1.5 py-0.5 rounded shrink-0">
                  {r.company.code}
                </span>
              </Link>
              <div className="flex flex-wrap gap-1.5">
                {r.services.map((s) => (
                  <span
                    key={s.id}
                    className="inline-flex items-center gap-1 rounded-full bg-brand-softer text-brand-dark text-[11.5px] font-medium px-2 py-0.5"
                    title={s.code ?? undefined}
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
