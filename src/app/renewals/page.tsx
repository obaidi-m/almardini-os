import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { daysUntil, leadDaysForService, renewalTier, type ServiceSchedule } from "@/lib/renewal";
import { serviceLabel } from "@/lib/service";
import type { VirtualOfficeTier } from "@/lib/types";
import { expireOverdueVirtualOffices } from "@/lib/virtual-offices";

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
  kind: "case" | "office";
  code: string;
  title: string;
  owner: string;
  ownerHref: string | null;
  href: string;
  expires_at: string;
  daysLeft: number;
  bucket: "overdue" | "renew_soon" | "later";
  badge: string; // e.g. "annual", "quarterly", "silver 12mo"
};

const KIND_PILL = {
  case:   { bg: "bg-[#FFEDD5]", text: "text-[#9A3412]", dot: "bg-[#F97316]" },
  office: { bg: "bg-[#E0F2FE]", text: "text-[#075985]", dot: "bg-[#0EA5E9]" },
} as const;

const TIER_LABEL: Record<VirtualOfficeTier, string> = {
  bronze: "Bronze", silver: "Silver", gold: "Gold", platinum: "Platinum",
};

const COLS = "36px 90px 1.6fr 1.3fr 100px 100px";

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

  await expireOverdueVirtualOffices(supabase);

  const [casesRes, vosRes] = await Promise.all([
    supabase
      .from("cases")
      .select("id, code, title, expires_at, client:clients(id, full_name), company:companies(id, name), service:service_types(id, code, name, schedule_kind, annual_month, annual_day, quarterly_day, quarterly_months, validity_amount, validity_unit)")
      .is("deleted_at", null)
      .not("expires_at", "is", null)
      .order("expires_at", { ascending: true }),
    supabase
      .from("virtual_offices")
      .select("id, tier, term_months, end_date, company:companies(id, name)")
      .is("deleted_at", null)
      .eq("status", "active")
      .order("end_date", { ascending: true }),
  ]);

  const unwrap = <T,>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? v[0] ?? null : v ?? null;

  const rows: Row[] = [];

  type SvcFull = NonNullable<ServiceSchedule> & { id: string; code: string | null; name: string | null };
  for (const c of (casesRes.data ?? []) as Array<{
    id: string; code: string; title: string | null; expires_at: string;
    client: { id: string; full_name: string }[] | { id: string; full_name: string } | null;
    company: { id: string; name: string }[] | { id: string; name: string } | null;
    service: SvcFull[] | SvcFull | null;
  }>) {
    const cli = unwrap(c.client);
    const cmp = unwrap(c.company);
    const svc = unwrap(c.service);
    const owner = cli?.full_name ?? cmp?.name ?? "?";
    const ownerHref = cli ? `/clients/${cli.id}` : cmp ? `/companies/${cmp.id}` : null;
    const tier = renewalTier(c.expires_at, svc);
    const bucket: Row["bucket"] = tier === "overdue" ? "overdue" : tier === "due_soon" ? "renew_soon" : "later";
    const badge =
      svc?.schedule_kind === "annual_fixed"    ? "annual"
      : svc?.schedule_kind === "quarterly_fixed" ? "quarterly"
      : (svc?.validity_amount && svc?.validity_unit)
        ? `valid ${svc.validity_amount}${svc.validity_unit[0]}`
        : "";
    rows.push({
      key: `case:${c.id}`,
      kind: "case",
      code: c.code,
      title: c.title || (svc ? serviceLabel(svc) : null) || "Case",
      owner, ownerHref,
      href: `/cases/${c.id}`,
      expires_at: c.expires_at,
      daysLeft: daysUntil(c.expires_at),
      bucket,
      badge,
    });
  }

  for (const vo of (vosRes.data ?? []) as Array<{
    id: string; tier: VirtualOfficeTier; term_months: number; end_date: string;
    company: { id: string; name: string }[] | { id: string; name: string } | null;
  }>) {
    const cmp = unwrap(vo.company);
    const n = daysUntil(vo.end_date);
    const bucket: Row["bucket"] = n < 0 ? "overdue" : n <= 90 ? "renew_soon" : "later";
    rows.push({
      key: `vo:${vo.id}`,
      kind: "office",
      code: "VO",
      title: `Virtual office — ${TIER_LABEL[vo.tier]}`,
      owner: cmp?.name ?? "?",
      ownerHref: cmp ? `/companies/${cmp.id}` : null,
      href: cmp ? `/companies/${cmp.id}` : "/virtual-offices",
      expires_at: vo.end_date,
      daysLeft: n,
      bucket,
      badge: `${TIER_LABEL[vo.tier].toLowerCase()} · ${vo.term_months}mo`,
    });
  }

  // Sort: overdue first, then renew_soon, then later — inside each by daysLeft ascending.
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
          Cases with a computed expiry and every active virtual office in one place.
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
          <div>Type</div>
          <div>Item</div>
          <div>Owner</div>
          <div>Days</div>
          <div>Expires</div>
        </div>

        {visible.length === 0 ? (
          <div className="py-16 text-center text-[13px] text-[var(--muted)]">
            {t("renewals.empty")}
          </div>
        ) : (
          visible.map((r) => {
            const pill = KIND_PILL[r.kind];
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
                    {r.kind}
                  </span>
                </div>
                <div className="min-w-0">
                  <Link href={r.href} className="text-ink font-medium hover:text-brand-dark truncate block">
                    {r.title}
                  </Link>
                  <div className="text-[11.5px] text-[var(--muted)] truncate">
                    {r.code !== "VO" && <span className="font-mono">{r.code}</span>}
                    {r.badge && <>{r.code !== "VO" && " · "}<span>{r.badge}</span></>}
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
                <div className={`text-[12px] tabular-nums ${toneClass(r.bucket)}`}>
                  {daysText(r.daysLeft)}
                </div>
                <div className={`text-[12px] font-mono ${toneClass(r.bucket)}`}>
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
