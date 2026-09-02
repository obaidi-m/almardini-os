import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Company } from "@/lib/types";
import { getT } from "@/lib/i18n/server";

type SortKey = "newest" | "oldest" | "name_asc" | "name_desc" | "expiry_asc";
type LicenseFilter = "" | "active" | "soon" | "expired" | "none";
type SearchParams = { show?: string; sort?: string; license?: string };

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "Newest first" },
  { key: "oldest", label: "Oldest first" },
  { key: "name_asc", label: "Name A → Z" },
  { key: "name_desc", label: "Name Z → A" },
  { key: "expiry_asc", label: "License expiring first" },
];

const LICENSE_FILTERS: { key: LicenseFilter; label: string }[] = [
  { key: "expired", label: "Expired" },
  { key: "soon",    label: "Due in ≤ 30 days" },
  { key: "active",  label: "Active (> 30 days)" },
  { key: "none",    label: "No license on file" },
];

export default async function CompaniesListPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createClient();
  const { t } = await getT();
  const includeDeleted = searchParams.show === "archived";
  const sort: SortKey = (SORT_OPTIONS.find((o) => o.key === searchParams.sort)?.key ?? "newest") as SortKey;
  const licenseFilter = (LICENSE_FILTERS.find((o) => o.key === searchParams.license)?.key ?? "") as LicenseFilter;

  const today = new Date().toISOString().slice(0, 10);
  const in30 = (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10); })();

  let query = supabase
    .from("companies")
    .select("id, code, name, nib, incorporation_date, license_expires_at, deleted_at, created_at")
    .limit(200);

  if (!includeDeleted) query = query.is("deleted_at", null);
  if (licenseFilter === "expired") query = query.lt("license_expires_at", today);
  if (licenseFilter === "soon")    query = query.gte("license_expires_at", today).lte("license_expires_at", in30);
  if (licenseFilter === "active")  query = query.gt("license_expires_at", in30);
  if (licenseFilter === "none")    query = query.is("license_expires_at", null);

  switch (sort) {
    case "oldest":     query = query.order("created_at", { ascending: true }); break;
    case "name_asc":   query = query.order("name", { ascending: true }); break;
    case "name_desc":  query = query.order("name", { ascending: false }); break;
    case "expiry_asc": query = query.order("license_expires_at", { ascending: true, nullsFirst: false }); break;
    default:           query = query.order("created_at", { ascending: false });
  }

  const { data, error } = await query;
  const rows: Company[] = (data as Company[]) ?? [];

  const activeCount = rows.filter((r) => !r.deleted_at).length;
  const archivedCount = rows.filter((r) => !!r.deleted_at).length;

  function hrefWith(patch: Partial<SearchParams>): string {
    const params = new URLSearchParams();
    const merged = { show: includeDeleted ? "archived" : undefined, sort, license: licenseFilter || undefined, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, String(v));
    const s = params.toString();
    return s ? `/companies?${s}` : "/companies";
  }

  const sortLabel = SORT_OPTIONS.find((o) => o.key === sort)?.label ?? "Newest first";
  const activeFilterCount = licenseFilter ? 1 : 0;
  const licenseLabel = LICENSE_FILTERS.find((o) => o.key === licenseFilter)?.label;

  return (
    <div className="max-w-[1400px]">
      <div className="flex items-start justify-between gap-6 mb-5">
        <div>
          <h1 className="font-serif text-[28px] leading-tight text-ink tracking-tight">
            {t("page.companies.title")}
          </h1>
          <p className="text-[13.5px] text-[var(--muted)] mt-1">
            {t("page.companies.subtitle")}
          </p>
        </div>
        <Link
          href="/companies/new"
          className="inline-flex items-center gap-1.5 bg-brand hover:bg-brand-dark text-white text-[13px] font-medium px-3.5 py-2 rounded-lg shadow-[0_4px_12px_-4px_rgba(20,138,124,0.5)] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M12 5v14M5 12h14" />
          </svg>
          {t("action.new")}
        </Link>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3 text-[12px]">
        <div className="inline-flex items-center gap-1.5 text-[var(--muted)]">
          <IconBuilding />
          <span className="font-medium text-ink">All companies</span>
          <span className="text-[var(--muted)]">·</span>
          <span>{rows.length}</span>
        </div>
        <div className="w-px h-4 bg-[var(--border-strong)] mx-1" />

        <details className="relative">
          <summary className="inline-flex items-center gap-1 text-[var(--muted)] hover:text-ink px-2 py-1 rounded hover:bg-white/50 cursor-pointer list-none">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M6 12h12M10 18h4"/></svg>
            <span>Sorted by <span className="text-ink font-medium">{sortLabel}</span></span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-60"><path d="M6 9l6 6 6-6"/></svg>
          </summary>
          <div className="absolute z-20 mt-1 left-0 min-w-[220px] bg-white rounded-lg shadow-lg border border-[var(--border)] py-1">
            {SORT_OPTIONS.map((opt) => (
              <Link key={opt.key} href={hrefWith({ sort: opt.key })} className={`flex items-center justify-between gap-2 px-3 py-1.5 text-[12.5px] hover:bg-[var(--surface-2)] ${sort === opt.key ? "text-brand-dark font-medium" : "text-ink"}`}>
                {opt.label}
                {sort === opt.key && <span className="text-brand">✓</span>}
              </Link>
            ))}
          </div>
        </details>

        <details className="relative">
          <summary className="inline-flex items-center gap-1 text-[var(--muted)] hover:text-ink px-2 py-1 rounded hover:bg-white/50 cursor-pointer list-none">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 3H2l8 9v7l4 2v-9l8-9z"/></svg>
            <span>Filter</span>
            {activeFilterCount > 0 && (
              <span className="ml-1 bg-brand text-white text-[10px] font-semibold rounded-full px-1.5 py-0.5 leading-none min-w-[16px] text-center">{activeFilterCount}</span>
            )}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-60"><path d="M6 9l6 6 6-6"/></svg>
          </summary>
          <div className="absolute z-20 mt-1 left-0 min-w-[240px] bg-white rounded-lg shadow-lg border border-[var(--border)] p-3">
            <div className="text-[10.5px] uppercase tracking-wider font-semibold text-[var(--muted)] mb-1.5">License status</div>
            <div className="-mx-1">
              <Link href={hrefWith({ license: undefined })} className={`block px-2 py-1 rounded text-[12.5px] hover:bg-[var(--surface-2)] ${!licenseFilter ? "text-brand-dark font-medium" : "text-ink"}`}>
                Any status
              </Link>
              {LICENSE_FILTERS.map((f) => (
                <Link key={f.key} href={hrefWith({ license: f.key })} className={`block px-2 py-1 rounded text-[12.5px] hover:bg-[var(--surface-2)] ${licenseFilter === f.key ? "text-brand-dark font-medium" : "text-ink"}`}>
                  {f.label}
                </Link>
              ))}
            </div>
            {activeFilterCount > 0 && (
              <Link href={hrefWith({ license: undefined })} className="block text-center text-[11.5px] text-[var(--muted)] hover:text-ink pt-2 mt-2 border-t border-[var(--border)]">
                Clear filters
              </Link>
            )}
          </div>
        </details>

        {licenseFilter && licenseLabel && (
          <div className="flex items-center gap-1.5 pl-1">
            <span className="inline-flex items-center gap-1 bg-brand-soft text-brand-dark px-2 py-0.5 rounded-full text-[11.5px]">
              License: {licenseLabel}
              <Link href={hrefWith({ license: undefined })} className="opacity-70 hover:opacity-100">×</Link>
            </span>
          </div>
        )}

        <div className="ml-auto flex items-center gap-3">
          <span className="text-[var(--muted)]">
            <span className="text-ink font-medium num">{activeCount}</span> active
            {includeDeleted && (
              <>
                <span className="mx-1.5 opacity-40">·</span>
                <span className="text-[var(--muted)] num">{archivedCount}</span> archived
              </>
            )}
          </span>
          <Link href={hrefWith({ show: includeDeleted ? undefined : "archived" })} className={`px-2.5 py-1 rounded-md text-[11.5px] font-medium transition-colors ${includeDeleted ? "bg-brand-soft text-brand-dark" : "text-[var(--muted)] hover:text-ink hover:bg-white/40"}`}>
            {includeDeleted ? t("action.hide_archived") : t("action.show_archived")}
          </Link>
        </div>
      </div>

      {error && (
        <div className="text-[12.5px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{error.message}</div>
      )}

      <div className="border-y border-[var(--border-strong)]">
        <div className="grid grid-cols-[36px_100px_1.6fr_1.1fr_1fr_1fr] gap-3 px-3 py-2 text-[11px] uppercase tracking-[0.06em] text-[var(--muted)] font-semibold border-b border-[var(--border-strong)] bg-white/30">
          <div className="flex items-center justify-center">
            <span className="w-3.5 h-3.5 rounded border border-[var(--border-strong)] bg-white" aria-hidden />
          </div>
          <HeadCell icon={<IconHash />} label="Code" href={hrefWith({ sort: sort === "newest" ? "oldest" : "newest" })} sortHint={sort === "newest" ? "↓" : sort === "oldest" ? "↑" : undefined} />
          <HeadCell icon={<IconBuilding />} label="Name" href={hrefWith({ sort: sort === "name_asc" ? "name_desc" : "name_asc" })} sortHint={sort === "name_asc" ? "↑" : sort === "name_desc" ? "↓" : undefined} />
          <HeadCell icon={<IconDoc />} label="NIB" />
          <HeadCell icon={<IconCal />} label="Incorporated" />
          <HeadCell icon={<IconClock />} label="License expiry" href={hrefWith({ sort: "expiry_asc" })} sortHint={sort === "expiry_asc" ? "↑" : undefined} />
        </div>

        {rows.length === 0 ? (
          <div className="py-20 text-center text-[13px] text-[var(--muted)]">
            {activeFilterCount > 0 ? (
              <>No companies match those filters. <Link href={hrefWith({ license: undefined })} className="text-brand hover:text-brand-dark font-medium">Clear filters</Link></>
            ) : (
              <>No companies yet. <Link href="/companies/new" className="text-brand hover:text-brand-dark font-medium">Add your first one →</Link></>
            )}
          </div>
        ) : (
          rows.map((c) => (
            <div key={c.id} className={`group grid grid-cols-[36px_100px_1.6fr_1.1fr_1fr_1fr] gap-3 px-3 py-2 text-[13px] items-center border-b border-[var(--border)] last:border-b-0 hover:bg-white/50 transition-colors ${c.deleted_at ? "opacity-55" : ""}`}>
              <div className="flex items-center justify-center">
                <span className="w-3.5 h-3.5 rounded border border-[var(--border-strong)] bg-white opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden />
              </div>
              <Link href={`/companies/${c.id}`}>
                <span className="font-mono text-[11px] text-brand-dark bg-brand-softer px-1.5 py-0.5 rounded">{c.code}</span>
              </Link>
              <Link href={`/companies/${c.id}`} className="min-w-0 flex items-center gap-2 group/name">
                <span className="w-6 h-6 rounded-md bg-brand-softer text-brand-dark grid place-items-center text-[10.5px] font-semibold shrink-0">
                  {companyInitials(c.name)}
                </span>
                <span className="text-ink font-medium truncate group-hover/name:text-brand-dark">{c.name}</span>
                {c.deleted_at && (
                  <span className="text-[9.5px] uppercase tracking-wider font-semibold text-[var(--muted)] bg-[var(--surface-2)] px-1.5 py-0.5 rounded shrink-0">archived</span>
                )}
              </Link>
              <div className="font-mono text-[11.5px] text-[var(--muted)] truncate">{c.nib ?? "—"}</div>
              <div className="text-[12.5px] text-[var(--muted)] font-mono">{fmtDate(c.incorporation_date)}</div>
              <div><LicenseCell v={c.license_expires_at} today={today} in30={in30} /></div>
            </div>
          ))
        )}
      </div>

      <div className="mt-3 text-[11.5px] text-[var(--muted)] px-1">
        {rows.length} {rows.length === 1 ? "company" : "companies"}
        {rows.length === 200 && " · showing first 200"}
      </div>
    </div>
  );
}

/* ============ Cells ============ */

function HeadCell({ icon, label, href, sortHint }: { icon: React.ReactNode; label: string; href?: string; sortHint?: string }) {
  const inner = (
    <>
      <span className="text-[var(--muted)] shrink-0 opacity-60">{icon}</span>
      <span className="truncate">{label}</span>
      {sortHint && <span className="text-brand-dark opacity-80 ml-0.5">{sortHint}</span>}
    </>
  );
  return href ? (
    <Link href={href} className="flex items-center gap-1.5 min-w-0 hover:text-ink">{inner}</Link>
  ) : (
    <div className="flex items-center gap-1.5 min-w-0">{inner}</div>
  );
}

function LicenseCell({ v, today, in30 }: { v: string | null | undefined; today: string; in30: string }) {
  if (!v) return <span className="text-[var(--hint)] text-[12px]">—</span>;
  const expired = v < today;
  const soon = !expired && v <= in30;
  const cls =
    expired ? "bg-red-100 text-red-800"
    : soon ? "bg-[#FBEFD4] text-[#8A6919]"
    : "bg-[#DCFCE7] text-[#166534]";
  const dotCls =
    expired ? "bg-red-500"
    : soon ? "bg-[#E8B14A]"
    : "bg-[#22C55E]";
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotCls}`} />
      <span className="font-mono">{fmtDate(v)}</span>
    </span>
  );
}

function companyInitials(name: string): string {
  // Strip "PT ", "CV ", etc. prefixes to get meaningful initials
  const cleaned = name.replace(/^(PT|CV|UD|PD)\s+/i, "").trim();
  const words = cleaned.split(/\s+/).filter(Boolean).slice(0, 2);
  return (words.map((w) => w[0]).join("") || name[0] || "?").toUpperCase();
}

function fmtDate(v: string | null | undefined): string {
  if (!v) return "—";
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

/* ============ Icons ============ */
const iconProps = { width: 13, height: 13, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8 } as const;
function IconHash()     { return (<svg {...iconProps}><path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18"/></svg>); }
function IconBuilding() { return (<svg {...iconProps}><rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01M9 15h.01M15 15h.01M10 21v-4h4v4"/></svg>); }
function IconDoc()      { return (<svg {...iconProps}><path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path d="M14 2v6h6"/></svg>); }
function IconCal()      { return (<svg {...iconProps}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>); }
function IconClock()    { return (<svg {...iconProps}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>); }
