import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { daysUntil, renewalTier, type ServiceSchedule } from "@/lib/renewal";
import { ExpiryPill } from "@/components/app/ExpiryPill";

type Filter = "all" | "renew_soon" | "overdue" | "later";
type SearchParams = { filter?: string };

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all",         label: "All" },
  { key: "renew_soon",  label: "Renew soon" },
  { key: "overdue",     label: "Overdue" },
  { key: "later",       label: "Later" },
];

type Row = {
  key: string;
  ownerKind: "person" | "company";
  code: string;
  title: string;
  owner: string;
  ownerHref: string | null;
  href: string;
  expires_at: string;
  daysLeft: number;
  bucket: "overdue" | "renew_soon" | "later";
  badge: string;
};

const KIND_PILL = {
  person:  { bg: "bg-[#FFEDD5]", text: "text-[#9A3412]", dot: "bg-[#F97316]" },
  company: { bg: "bg-[#E0F2FE]", text: "text-[#075985]", dot: "bg-[#0EA5E9]" },
} as const;

const COLS = "36px 100px 1.6fr 1.3fr 100px 100px";

function fmtDate(v: string): string {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

function toneClass(bucket: Row["bucket"]): string {
  if (bucket === "overdue")    return "text-red-700 font-semibold";
  if (bucket === "renew_soon") return "text-amber-700 font-semibold";
  return "text-[var(--muted)]";
}

function daysText(n: number): string {
  if (n < 0)   return `overdue ${-n}d`;
  if (n === 0) return "today";
  return `in ${n}d`;
}

export default async function RenewalsPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createClient();
  const { t } = await getT();
  const filter: Filter = (FILTERS.find((f) => f.key === searchParams.filter)?.key ?? "all") as Filter;

  // Single source of truth: entity_services rows with an expiry.
  // Active subscriptions only — expired / terminated / paused live elsewhere.
  const { data: subsRes } = await supabase
    .from("entity_services")
    .select(`
      id, expires_date, tier, term_months, status,
      client:clients(id, full_name),
      company:companies!entity_services_company_id_fkey(id, name),
      service:service_types(
        id, code, name, schedule_kind, annual_month, annual_day,
        quarterly_day, quarterly_months, validity_amount, validity_unit
      )
    `)
    .is("deleted_at", null)
    .eq("status", "active")
    .not("expires_date", "is", null)
    .order("expires_date", { ascending: true });

  const unwrap = <T,>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? v[0] ?? null : v ?? null;

  type SvcFull = NonNullable<ServiceSchedule> & { id: string; code: string | null; name: string | null };
  const rows: Row[] = ((subsRes ?? []) as Array<{
    id: string; expires_date: string; tier: string | null; term_months: number | null; status: string;
    client:  { id: string; full_name: string }[] | { id: string; full_name: string } | null;
    company: { id: string; name: string }[]      | { id: string; name: string }      | null;
    service: SvcFull[] | SvcFull | null;
  }>).map((r) => {
    const cli = unwrap(r.client);
    const cmp = unwrap(r.company);
    const svc = unwrap(r.service);
    const ownerKind: "person" | "company" = cli ? "person" : "company";
    const owner = cli?.full_name ?? cmp?.name ?? "?";
    const ownerHref = cli ? `/clients/${cli.id}` : cmp ? `/companies/${cmp.id}` : null;

    const tier = renewalTier(r.expires_date, svc);
    const bucket: Row["bucket"] =
      tier === "overdue" ? "overdue" : tier === "due_soon" ? "renew_soon" : "later";

    const badge =
      svc?.schedule_kind === "annual_fixed"      ? "annual"
      : svc?.schedule_kind === "quarterly_fixed" ? "quarterly"
      : r.tier && r.term_months                  ? `${r.tier} · ${r.term_months}mo`
      : (svc?.validity_amount && svc?.validity_unit)
        ? `valid ${svc.validity_amount}${svc.validity_unit[0]}`
        : "";

    return {
      key: r.id,
      ownerKind,
      code: svc?.code ?? "",
      title: svc?.name ?? "Subscription",
      owner, ownerHref,
      href: ownerHref ?? "/",
      expires_at: r.expires_date,
      daysLeft: daysUntil(r.expires_date),
      bucket,
      badge,
    };
  });

  const bucketOrder: Record<Row["bucket"], number> = { overdue: 0, renew_soon: 1, later: 2 };
  rows.sort((a, b) => bucketOrder[a.bucket] - bucketOrder[b.bucket] || a.daysLeft - b.daysLeft);

  const counts = {
    all:        rows.length,
    renew_soon: rows.filter((r) => r.bucket === "renew_soon").length,
    overdue:    rows.filter((r) => r.bucket === "overdue").length,
    later:      rows.filter((r) => r.bucket === "later").length,
  };

  const visible = rows.filter((r) => filter === "all" ? true : r.bucket === filter);

  function hrefWith(f: Filter): string {
    return f === "all" ? "/renewals" : `/renewals?filter=${f}`;
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-serif text-[28px] leading-tight text-ink tracking-tight">
          {t("page.renewals.title")}
        </h1>
        <p className="text-[13.5px] text-[var(--muted)] mt-1">
          Every active subscription with an end date — one row per person or company.
        </p>
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
          <div>Owner</div>
          <div>Service</div>
          <div>Owner name</div>
          <div>Days</div>
          <div>Expires</div>
        </div>

        {visible.length === 0 ? (
          <div className="py-16 text-center text-[13px] text-[var(--muted)]">
            {t("renewals.empty")}
          </div>
        ) : (
          visible.map((r) => {
            const pill = KIND_PILL[r.ownerKind];
            return (
              <div
                key={r.key}
                className="group grid gap-3 px-3 py-2 text-[13px] items-center border-b border-[var(--border)] last:border-b-0 hover:bg-white/50 transition-colors"
                style={{ gridTemplateColumns: COLS }}
              >
                <div className="flex items-center justify-center">
                  <span className="w-3.5 h-3.5 rounded border border-[var(--border-strong)] bg-white opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden />
                </div>
                <div>
                  <span className={`inline-flex items-center gap-1 text-[10.5px] font-medium px-1.5 py-0.5 rounded-full ${pill.bg} ${pill.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${pill.dot}`} />
                    {r.ownerKind}
                  </span>
                </div>
                <div className="min-w-0">
                  <Link href={r.href} className="text-ink font-medium hover:text-brand-dark truncate block">
                    {r.title}
                  </Link>
                  <div className="text-[11.5px] text-[var(--muted)] truncate">
                    {r.code && <span className="font-mono">{r.code}</span>}
                    {r.badge && <>{r.code && " · "}<span>{r.badge}</span></>}
                  </div>
                </div>
                <div className="min-w-0">
                  {r.ownerHref ? (
                    <Link href={r.ownerHref} className="text-[13px] text-ink hover:text-brand-dark truncate block">
                      {r.owner}
                    </Link>
                  ) : (
                    <span className="text-[var(--muted)]">{r.owner}</span>
                  )}
                </div>
                <div className="whitespace-nowrap">
                  <ExpiryPill expires={r.expires_at} />
                </div>
                <div className="text-[12px] font-mono text-[var(--muted)]">
                  {fmtDate(r.expires_at)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

