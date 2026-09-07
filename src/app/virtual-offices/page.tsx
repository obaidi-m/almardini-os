import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { EntityServiceStatus } from "@/lib/types";
import { ExpiryPill } from "@/components/app/ExpiryPill";
import { ResizableTable, type ColumnDef } from "@/components/app/ResizableTable";

type Filter = "all" | "renew_soon" | "active" | "expired" | "terminated";
type SearchParams = { filter?: string };

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all",         label: "All" },
  { key: "renew_soon",  label: "Renew soon (≤90d)" },
  { key: "active",      label: "Active" },
  { key: "expired",     label: "Expired" },
  { key: "terminated",  label: "Terminated" },
];

type DisplayStatus = "active" | "expired" | "terminated";

const STATUS_PILL: Record<DisplayStatus, { bg: string; text: string; dot: string }> = {
  active:     { bg: "bg-[#DCFCE7]",           text: "text-[#166534]",       dot: "bg-[#22C55E]" },
  expired:    { bg: "bg-[#FEE2E2]",           text: "text-[#991B1B]",       dot: "bg-[#EF4444]" },
  terminated: { bg: "bg-[var(--surface-2)]",  text: "text-[var(--muted)]",  dot: "bg-[var(--muted)]" },
};

type Row = {
  id: string;
  tier: string;
  term_months: number | null;
  start_date: string | null;
  end_date: string;
  status: DisplayStatus;
  company: { id: string; code: string; name: string } | null;
  responsible: { id: string; name: string; code: string } | null;
};

function daysUntil(iso: string): number {
  const d = new Date(iso + "T00:00:00");
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.floor((d.getTime() - t.getTime()) / 86_400_000);
}
function fmtDate(v: string | null | undefined): string {
  if (!v) return "—";
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}
function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

const COLUMNS: ColumnDef[] = [
  { header: <span className="w-3.5 h-3.5 rounded border border-[var(--border-strong)] bg-white inline-block" aria-hidden />, defaultWidth: 36, fixed: true },
  { header: "Company", defaultWidth: 240, minWidth: 140 },
  { header: "Tier",    defaultWidth: 80 },
  { header: "Term",    defaultWidth: 70 },
  { header: "Start",   defaultWidth: 100 },
  { header: "End",     defaultWidth: 100 },
  { header: "Days",    defaultWidth: 120 },
  { header: "PJ",      defaultWidth: 140, minWidth: 100 },
  { header: "Status",  defaultWidth: 100 },
];

export default async function VirtualOfficesListPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createClient();
  const filter: Filter = (FILTERS.find((f) => f.key === searchParams.filter)?.key ?? "all") as Filter;

  // Read every "virtual office"–shaped subscription from entity_services.
  // The catalog entry drives what we match — anything named like a virtual
  // office is in.
  const { data, error } = await supabase
    .from("entity_services")
    .select(`
      id, expires_date, started_date, tier, term_months, status,
      company:companies!entity_services_company_id_fkey(id, code, name),
      responsible:partners!entity_services_responsible_partner_id_fkey(id, name, code),
      service:service_types!inner(id, name, applies_to)
    `)
    .is("deleted_at", null)
    .not("company_id", "is", null)
    .ilike("service.name", "%virtual office%")
    .order("expires_date", { ascending: true })
    .limit(1000);

  if (error) {
    return (
      <div className="text-[13px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
        {error.message}
      </div>
    );
  }

  const unwrap = <T,>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? v[0] ?? null : v ?? null;

  const displayStatus = (s: EntityServiceStatus): DisplayStatus =>
    s === "expired" ? "expired" : s === "terminated" ? "terminated" : "active";

  const all: Row[] = ((data ?? []) as Array<{
    id: string;
    expires_date: string | null;
    started_date: string | null;
    tier: string | null;
    term_months: number | null;
    status: EntityServiceStatus;
    company:     { id: string; code: string; name: string }[] | { id: string; code: string; name: string } | null;
    responsible: { id: string; name: string; code: string }[] | { id: string; name: string; code: string } | null;
  }>)
    .filter((r) => r.expires_date !== null)
    .map((r) => ({
      id: r.id,
      tier: titleCase(r.tier ?? "silver"),
      term_months: r.term_months,
      start_date: r.started_date,
      end_date: r.expires_date as string,
      status: displayStatus(r.status),
      company: unwrap(r.company),
      responsible: unwrap(r.responsible),
    }));

  const today = new Date().toISOString().slice(0, 10);
  const counts = {
    all:         all.length,
    renew_soon:  all.filter((r) => r.status === "active" && r.end_date >= today && daysUntil(r.end_date) <= 90).length,
    active:      all.filter((r) => r.status === "active").length,
    expired:     all.filter((r) => r.status === "expired").length,
    terminated:  all.filter((r) => r.status === "terminated").length,
  };

  const rows = all.filter((r) => {
    switch (filter) {
      case "renew_soon": return r.status === "active" && r.end_date >= today && daysUntil(r.end_date) <= 90;
      case "active":     return r.status === "active";
      case "expired":    return r.status === "expired";
      case "terminated": return r.status === "terminated";
      default:           return true;
    }
  });

  function hrefWith(f: Filter): string {
    return f === "all" ? "/virtual-offices" : `/virtual-offices?filter=${f}`;
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-6 mb-5">
        <div>
          <h1 className="font-serif text-[28px] leading-tight text-ink tracking-tight">
            Virtual offices
          </h1>
          <p className="text-[13.5px] text-[var(--muted)] mt-1">
            Rental tenancies across every company. Add or renew from the
            company&apos;s page.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        {FILTERS.map((f) => {
          const active = f.key === filter;
          const n = counts[f.key];
          return (
            <Link
              key={f.key}
              href={hrefWith(f.key)}
              className={`inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
                active
                  ? "bg-ink text-white border-ink"
                  : "bg-white text-[var(--text)] border-[var(--border)] hover:border-ink/30"
              }`}
            >
              {f.label}
              <span className={`text-[11px] ${active ? "text-white/70" : "text-[var(--muted)]"}`}>
                {n}
              </span>
            </Link>
          );
        })}
      </div>

      <ResizableTable storageKey="vo-cols-v1" columns={COLUMNS}>
        {rows.length === 0 ? (
          <div className="py-16 text-center text-[13px] text-[var(--muted)]">
            No virtual offices match this filter.
          </div>
        ) : (
          rows.map((vo) => {
            const p = STATUS_PILL[vo.status];
            return (
              <div
                key={vo.id}
                className="group grid gap-3 px-3 py-2 text-[13px] items-center border-b border-[var(--border)] last:border-b-0 hover:bg-white/50 transition-colors"
                style={{ gridTemplateColumns: "var(--rt-cols)" }}
              >
                <div className="flex items-center justify-center">
                  <span className="w-3.5 h-3.5 rounded border border-[var(--border-strong)] bg-white opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden />
                </div>
                <div className="min-w-0">
                  {vo.company ? (
                    <Link href={`/companies/${vo.company.id}`} className="flex items-center gap-2 group/name min-w-0">
                      <span className="text-ink font-medium truncate group-hover/name:text-brand-dark">
                        {vo.company.name}
                      </span>
                      <span className="font-mono text-[10.5px] text-brand-dark bg-brand-softer px-1.5 py-0.5 rounded shrink-0">
                        {vo.company.code}
                      </span>
                    </Link>
                  ) : (
                    <span className="text-[var(--muted)]">—</span>
                  )}
                </div>
                <div>{vo.tier}</div>
                <div className="text-[var(--muted)]">{vo.term_months ? `${vo.term_months}mo` : "—"}</div>
                <div className="text-[var(--muted)]">{fmtDate(vo.start_date)}</div>
                <div>{fmtDate(vo.end_date)}</div>
                <div className="whitespace-nowrap">
                  {vo.status === "terminated" ? (
                    <span className="text-[var(--muted)]">—</span>
                  ) : (
                    <ExpiryPill expires={vo.end_date} />
                  )}
                </div>
                <div className="min-w-0">
                  {vo.responsible ? (
                    <Link href={`/partners/${vo.responsible.id}`} className="text-[13px] text-ink hover:text-brand-dark truncate block">
                      {vo.responsible.name}
                    </Link>
                  ) : (
                    <span className="text-[var(--muted)]">—</span>
                  )}
                </div>
                <div>
                  <span className={`inline-flex items-center gap-1 text-[10.5px] font-medium px-1.5 py-0.5 rounded-full ${p.bg} ${p.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
                    {vo.status}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </ResizableTable>
    </div>
  );
}
