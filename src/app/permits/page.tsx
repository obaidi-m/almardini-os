// Rebuilt at most every 60s per path — actions call revalidatePath
// to bust it immediately on mutations.
export const revalidate = 60;

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { EntityServiceStatus } from "@/lib/types";
import { ExpiryPill } from "@/components/app/ExpiryPill";
import { ResizableTable, type ColumnDef } from "@/components/app/ResizableTable";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/messages";
import { NewPermitButton } from "./NewPermitButton";

type Filter = "all" | "renew_soon" | "active" | "expired" | "terminated";
type SearchParams = { filter?: string };

const FILTER_KEYS: { key: Filter; labelKey: MessageKey }[] = [
  { key: "all",         labelKey: "page.permits.filter.all" },
  { key: "renew_soon",  labelKey: "page.permits.filter.renew_soon" },
  { key: "active",      labelKey: "page.permits.filter.active" },
  { key: "expired",     labelKey: "page.permits.filter.expired" },
  { key: "terminated",  labelKey: "page.permits.filter.terminated" },
];

type DisplayStatus = "active" | "expired" | "terminated";

const STATUS_PILL: Record<DisplayStatus, { bg: string; text: string; dot: string }> = {
  active:     { bg: "bg-[#DCFCE7]",           text: "text-[#166534]",       dot: "bg-[#22C55E]" },
  expired:    { bg: "bg-[#FEE2E2]",           text: "text-[#991B1B]",       dot: "bg-[#EF4444]" },
  terminated: { bg: "bg-[var(--surface-2)]",  text: "text-[var(--muted)]",  dot: "bg-[var(--muted)]" },
};

type Row = {
  id: string;
  kind: string; // service name (KITAS, KITAP, IMTA…)
  expires_date: string;
  status: DisplayStatus;
  client:  { id: string; full_name: string; code: string } | null;
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


export default async function PermitsListPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createClient();
  const { t } = await getT();
  const filter: Filter = (FILTER_KEYS.find((f) => f.key === searchParams.filter)?.key ?? "all") as Filter;
  const COLUMNS: ColumnDef[] = [
    { header: <span className="w-3.5 h-3.5 rounded border border-[var(--border-strong)] bg-white inline-block" aria-hidden />, defaultWidth: 36, fixed: true },
    { header: t("page.permits.col.holder"),  defaultWidth: 300, minWidth: 160 },
    { header: t("page.permits.col.kind"),    defaultWidth: 100 },
    { header: t("page.permits.col.expires"), defaultWidth: 100 },
    { header: t("page.permits.col.days"),    defaultWidth: 120 },
    { header: t("page.permits.col.status"),  defaultWidth: 100 },
  ];

  // Read every person-owned subscription from the unified entity_services
  // store, then filter/status-derive in memory. Permits are a subset of
  // subscriptions — the ones whose catalog entry is applies_to = 'person'.
  const [{ data, error }, { data: clientOptions }, { data: serviceOptions }, { data: partnerOptions }, { data: companyOptions }] = await Promise.all([
    supabase
      .from("entity_services")
      .select(`
        id, expires_date, status,
        client:clients(id, full_name, code),
        service:service_types!inner(id, name, applies_to)
      `)
      .is("deleted_at", null)
      .eq("service.applies_to", "person")
      .not("client_id", "is", null)
      .order("expires_date", { ascending: true })
      .limit(1000),
    supabase
      .from("clients")
      .select("id, code, full_name")
      .is("deleted_at", null)
      .order("full_name")
      .limit(1000),
    supabase
      .from("service_types")
      .select("id, code, name")
      .eq("is_active", true)
      .eq("tracks_expiry", true)
      .in("applies_to", ["person", "either"])
      .order("name"),
    supabase
      .from("partners")
      .select("id, code, name")
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("companies")
      .select("id, code, name")
      .is("deleted_at", null)
      .order("name"),
  ]);

  if (error) {
    return (
      <div className="text-[13px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
        {error.message}
      </div>
    );
  }

  const unwrap = <T,>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? v[0] ?? null : v ?? null;

  const today = new Date().toISOString().slice(0, 10);
  // Fold stored status + expiry date into the three display buckets. Paused
  // permits still count as active on paper. "Expired" comes from the date
  // passing — not from a stored flag — so a live row whose date rolled by
  // yesterday shows as expired today with no manual step.
  const displayStatus = (s: EntityServiceStatus, expires: string | null): DisplayStatus => {
    if (s === "terminated") return "terminated";
    if (s === "expired") return "expired";
    if (expires && expires < today) return "expired";
    return "active";
  };

  const all: Row[] = ((data ?? []) as Array<{
    id: string;
    expires_date: string | null;
    status: EntityServiceStatus;
    client:  { id: string; full_name: string; code: string }[] | { id: string; full_name: string; code: string } | null;
    service: { id: string; name: string; applies_to: string }[] | { id: string; name: string; applies_to: string } | null;
  }>)
    .filter((r) => r.expires_date !== null) // permits list is expiry-tracked ones only
    .map((r) => ({
      id: r.id,
      kind: unwrap(r.service)?.name ?? "Permit",
      expires_date: r.expires_date as string,
      status: displayStatus(r.status, r.expires_date),
      client: unwrap(r.client),
    }));

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

  function hrefWith(f: Filter): string {
    return f === "all" ? "/permits" : `/permits?filter=${f}`;
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-6 mb-5">
        <div>
          <h1 className="font-serif text-[28px] leading-tight text-ink tracking-tight">{t("nav.permits")}</h1>
          <p className="text-[13.5px] text-[var(--muted)] mt-1">
            {t("page.permits.subtitle")}
          </p>
        </div>
        <NewPermitButton
          clients={(clientOptions as { id: string; code: string; full_name: string }[]) ?? []}
          services={(serviceOptions as { id: string; code: string | null; name: string }[]) ?? []}
          partners={(partnerOptions as { id: string; code: string; name: string }[]) ?? []}
          companies={(companyOptions as { id: string; code: string; name: string }[]) ?? []}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        {FILTER_KEYS.map((f) => {
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
              {t(f.labelKey)}
              <span className={`text-[11px] ${active ? "text-white/70" : "text-[var(--muted)]"}`}>
                {counts[f.key]}
              </span>
            </Link>
          );
        })}
      </div>

      <ResizableTable storageKey="permits-cols-v1" columns={COLUMNS}>
        {rows.length === 0 ? (
          <div className="py-16 text-center text-[13px] text-[var(--muted)]">{t("page.permits.empty_filter")}</div>
        ) : (
          rows.map((p) => {
            const pill = STATUS_PILL[p.status];
            return (
              <div
                key={p.id}
                className="group grid gap-3 px-3 py-2 text-[13px] items-center border-b border-[var(--border)] last:border-b-0 hover:bg-white/50 transition-colors"
                style={{ gridTemplateColumns: "var(--rt-cols)" }}
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
                <div>{fmtDate(p.expires_date)}</div>
                <div className="whitespace-nowrap">
                  {p.status === "terminated" ? (
                    <span className="text-[var(--muted)]">—</span>
                  ) : (
                    <ExpiryPill expires={p.expires_date} />
                  )}
                </div>
                <div>
                  <span className={`inline-flex items-center gap-1 text-[10.5px] font-medium px-1.5 py-0.5 rounded-full ${pill.bg} ${pill.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${pill.dot}`} />
                    {t(`services.status.${p.status}` as MessageKey)}
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
