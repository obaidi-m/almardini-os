import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Permit, PermitStatus } from "@/lib/types";
import { NewPermitButton } from "./NewButton";
import { expireOverduePermits } from "@/lib/permits";

type Filter = "all" | "renew_soon" | "active" | "expired" | "terminated";
type SearchParams = { filter?: string };

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all",         label: "All" },
  { key: "renew_soon",  label: "Renew soon (≤90d)" },
  { key: "active",      label: "Active" },
  { key: "expired",     label: "Expired" },
  { key: "terminated",  label: "Terminated" },
];

const STATUS_PILL: Record<PermitStatus, { bg: string; text: string; dot: string }> = {
  active:     { bg: "bg-[#DCFCE7]",           text: "text-[#166534]",       dot: "bg-[#22C55E]" },
  expired:    { bg: "bg-[#FEE2E2]",           text: "text-[#991B1B]",       dot: "bg-[#EF4444]" },
  terminated: { bg: "bg-[var(--surface-2)]",  text: "text-[var(--muted)]",  dot: "bg-[var(--muted)]" },
};

type Row = Permit & {
  client: { id: string; full_name: string; code: string } | null;
  sponsor: { id: string; name: string; code: string } | null;
  responsible: { id: string; name: string; code: string } | null;
};

function daysUntil(iso: string): number {
  const d = new Date(iso + "T00:00:00");
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.floor((d.getTime() - t.getTime()) / 86_400_000);
}
function daysLabel(iso: string): { text: string; tone: string } {
  const n = daysUntil(iso);
  if (n < 0)   return { text: `${-n}d overdue`, tone: "text-red-700 font-semibold" };
  if (n === 0) return { text: "today",          tone: "text-red-700 font-semibold" };
  if (n <= 30) return { text: `in ${n}d`,       tone: "text-red-700 font-semibold" };
  if (n <= 90) return { text: `in ${n}d`,       tone: "text-amber-700 font-semibold" };
  return           { text: `in ${n}d`,          tone: "text-[var(--muted)]" };
}
function fmtDate(v: string | null | undefined): string {
  if (!v) return "—";
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

const COLS = "36px minmax(200px, 1.4fr) 90px minmax(140px, 1fr) 100px 120px 100px";

export default async function PermitsListPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createClient();
  const filter: Filter = (FILTERS.find((f) => f.key === searchParams.filter)?.key ?? "all") as Filter;

  await expireOverduePermits(supabase);

  const [{ data, error }, { data: clientsRaw }, { data: companiesRaw }, { data: partnersRaw }] = await Promise.all([
    supabase
      .from("permits")
      .select("id, client_id, kind, reference_no, issued_date, expires_date, status, sponsor_company_id, responsible_partner_id, notes, drive_folder_url, created_at, updated_at, deleted_at, client:clients(id, full_name, code), sponsor:companies(id, name, code), responsible:partners!permits_responsible_partner_id_fkey(id, name, code)")
      .is("deleted_at", null)
      .order("expires_date", { ascending: true })
      .limit(1000),
    supabase.from("clients").select("id, code, full_name").is("deleted_at", null).order("full_name").limit(1000),
    supabase.from("companies").select("id, code, name").is("deleted_at", null).order("name").limit(1000),
    supabase.from("partners").select("id, code, name").is("deleted_at", null).order("name").limit(1000),
  ]);

  if (error) {
    return (
      <div className="text-[13px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
        {error.message}
      </div>
    );
  }

  const unwrap = <T,>(v: T | T[] | null | undefined): T | null => Array.isArray(v) ? v[0] ?? null : v ?? null;

  const all: Row[] = (data as unknown as Array<Permit & {
    client: { id: string; full_name: string; code: string } | { id: string; full_name: string; code: string }[] | null;
    sponsor: { id: string; name: string; code: string } | { id: string; name: string; code: string }[] | null;
    responsible: { id: string; name: string; code: string } | { id: string; name: string; code: string }[] | null;
  }>).map((r) => ({
    ...r,
    client: unwrap(r.client),
    sponsor: unwrap(r.sponsor),
    responsible: unwrap(r.responsible),
  }));

  const today = new Date().toISOString().slice(0, 10);
  const counts = {
    all:         all.length,
    renew_soon:  all.filter((r) => r.status === "active" && r.expires_date >= today && daysUntil(r.expires_date) <= 90).length,
    active:      all.filter((r) => r.status === "active").length,
    expired:     all.filter((r) => r.status === "expired").length,
    terminated:  all.filter((r) => r.status === "terminated").length,
  };

  const rows = all.filter((r) => {
    switch (filter) {
      case "renew_soon": return r.status === "active" && r.expires_date >= today && daysUntil(r.expires_date) <= 90;
      case "active":     return r.status === "active";
      case "expired":    return r.status === "expired";
      case "terminated": return r.status === "terminated";
      default:           return true;
    }
  });

  const clients = (clientsRaw as Array<{ id: string; code: string; full_name: string }>) ?? [];
  const companies = (companiesRaw as Array<{ id: string; code: string; name: string }>) ?? [];
  const partners = (partnersRaw as Array<{ id: string; code: string; name: string }>) ?? [];

  function hrefWith(f: Filter): string {
    return f === "all" ? "/permits" : `/permits?filter=${f}`;
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-6 mb-5">
        <div>
          <h1 className="font-serif text-[28px] leading-tight text-ink tracking-tight">Permits</h1>
          <p className="text-[13.5px] text-[var(--muted)] mt-1">
            KITAS, IMTA, work permits and other issued documents.
          </p>
        </div>
        <NewPermitButton clients={clients} companies={companies} partners={partners} />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        {FILTERS.map((f) => {
          const active = f.key === filter;
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
                {counts[f.key]}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="border-y border-[var(--border-strong)]">
        <div
          className="grid gap-3 px-3 py-2 text-[11px] uppercase tracking-[0.06em] text-[var(--muted)] font-semibold border-b border-[var(--border-strong)] bg-white/30"
          style={{ gridTemplateColumns: COLS }}
        >
          <div className="flex items-center justify-center">
            <span className="w-3.5 h-3.5 rounded border border-[var(--border-strong)] bg-white" aria-hidden />
          </div>
          <div>Holder</div>
          <div>Kind</div>
          <div>Sponsor</div>
          <div>Expires</div>
          <div>Days</div>
          <div>Status</div>
        </div>

        {rows.length === 0 ? (
          <div className="py-16 text-center text-[13px] text-[var(--muted)]">No permits match this filter.</div>
        ) : (
          rows.map((p) => {
            const pill = STATUS_PILL[p.status];
            const days = p.status === "active" ? daysLabel(p.expires_date) : null;
            return (
              <div
                key={p.id}
                className="group grid gap-3 px-3 py-2 text-[13px] items-center border-b border-[var(--border)] last:border-b-0 hover:bg-white/50 transition-colors"
                style={{ gridTemplateColumns: COLS }}
              >
                <div className="flex items-center justify-center">
                  <span className="w-3.5 h-3.5 rounded border border-[var(--border-strong)] bg-white opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden />
                </div>
                <div className="min-w-0">
                  {p.client ? (
                    <Link href={`/clients/${p.client.id}`} className="flex items-center gap-2 min-w-0 group/name">
                      <span className="text-ink font-medium truncate group-hover/name:text-brand-dark">
                        {p.client.full_name}
                      </span>
                      <span className="font-mono text-[10.5px] text-brand-dark bg-brand-softer px-1.5 py-0.5 rounded shrink-0">
                        {p.client.code}
                      </span>
                    </Link>
                  ) : (
                    <span className="text-[var(--muted)]">—</span>
                  )}
                </div>
                <div>{p.kind}</div>
                <div className="min-w-0">
                  {p.sponsor ? (
                    <Link href={`/companies/${p.sponsor.id}`} className="text-[13px] text-ink hover:text-brand-dark truncate block">
                      {p.sponsor.name}
                    </Link>
                  ) : (
                    <span className="text-[var(--muted)]">—</span>
                  )}
                </div>
                <div>{fmtDate(p.expires_date)}</div>
                <div className="whitespace-nowrap">
                  {p.status === "active" && days ? (
                    <span className={days.tone}>{days.text}</span>
                  ) : p.status === "expired" ? (
                    <span className="text-[var(--muted)]">
                      {(() => { const n = daysUntil(p.expires_date); return n < 0 ? `expired ${-n}d ago` : "expired"; })()}
                    </span>
                  ) : (
                    <span className="text-[var(--muted)]">—</span>
                  )}
                </div>
                <div>
                  <span className={`inline-flex items-center gap-1 text-[10.5px] font-medium px-1.5 py-0.5 rounded-full ${pill.bg} ${pill.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${pill.dot}`} />
                    {p.status}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
