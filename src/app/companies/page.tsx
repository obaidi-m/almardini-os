import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Company } from "@/lib/types";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/messages";

type SortKey = "newest" | "oldest" | "name_asc" | "name_desc";
type SearchParams = { show?: string; sort?: string };

const SORT_KEYS: SortKey[] = ["newest", "oldest", "name_asc", "name_desc"];

export default async function CompaniesListPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createClient();
  const { t } = await getT();
  const sortLabelFor = (k: SortKey) => t(`sort.${k}` as MessageKey);
  const includeDeleted = searchParams.show === "archived";
  const sort: SortKey = (SORT_KEYS.find((k) => k === searchParams.sort) ?? "newest") as SortKey;

  let query = supabase
    .from("companies")
    .select("id, code, name, nib, incorporation_date, deleted_at, created_at")
    .limit(200);

  if (!includeDeleted) query = query.is("deleted_at", null);

  switch (sort) {
    case "oldest":     query = query.order("created_at", { ascending: true }); break;
    case "name_asc":   query = query.order("name", { ascending: true }); break;
    case "name_desc":  query = query.order("name", { ascending: false }); break;
    default:           query = query.order("created_at", { ascending: false });
  }

  const { data, error } = await query;
  const rows: Company[] = (data as Company[]) ?? [];

  const activeCount = rows.filter((r) => !r.deleted_at).length;
  const archivedCount = rows.filter((r) => !!r.deleted_at).length;

  function hrefWith(patch: Partial<SearchParams>): string {
    const params = new URLSearchParams();
    const merged = { show: includeDeleted ? "archived" : undefined, sort, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, String(v));
    const s = params.toString();
    return s ? `/companies?${s}` : "/companies";
  }

  const sortLabel = sortLabelFor(sort);

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
          <span className="font-medium text-ink">{t("toolbar.all_companies")}</span>
          <span className="text-[var(--muted)]">·</span>
          <span>{rows.length}</span>
        </div>
        <div className="w-px h-4 bg-[var(--border-strong)] mx-1" />

        <details className="relative">
          <summary className="inline-flex items-center gap-1 text-[var(--muted)] hover:text-ink px-2 py-1 rounded hover:bg-white/50 cursor-pointer list-none">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M6 12h12M10 18h4"/></svg>
            <span>{t("toolbar.sorted_by_prefix")} <span className="text-ink font-medium">{sortLabel}</span></span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-60"><path d="M6 9l6 6 6-6"/></svg>
          </summary>
          <div className="absolute z-20 mt-1 left-0 min-w-[220px] bg-white rounded-lg shadow-lg border border-[var(--border)] py-1">
            {SORT_KEYS.map((k) => (
              <Link key={k} href={hrefWith({ sort: k })} className={`flex items-center justify-between gap-2 px-3 py-1.5 text-[12.5px] hover:bg-[var(--surface-2)] ${sort === k ? "text-brand-dark font-medium" : "text-ink"}`}>
                {sortLabelFor(k)}
                {sort === k && <span className="text-brand">✓</span>}
              </Link>
            ))}
          </div>
        </details>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-[var(--muted)]">
            <span className="text-ink font-medium num">{activeCount}</span> {t("toolbar.active_word")}
            {includeDeleted && (
              <>
                <span className="mx-1.5 opacity-40">·</span>
                <span className="text-[var(--muted)] num">{archivedCount}</span> {t("toolbar.archived_word")}
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
        <div className="grid grid-cols-[36px_100px_1.8fr_1.1fr_1fr] gap-3 px-3 py-2 text-[11px] uppercase tracking-[0.06em] text-[var(--muted)] font-semibold border-b border-[var(--border-strong)] bg-white/30">
          <div className="flex items-center justify-center">
            <span className="w-3.5 h-3.5 rounded border border-[var(--border-strong)] bg-white" aria-hidden />
          </div>
          <HeadCell icon={<IconHash />} label={t("col.code")} href={hrefWith({ sort: sort === "newest" ? "oldest" : "newest" })} sortHint={sort === "newest" ? "↓" : sort === "oldest" ? "↑" : undefined} />
          <HeadCell icon={<IconBuilding />} label={t("field.name")} href={hrefWith({ sort: sort === "name_asc" ? "name_desc" : "name_asc" })} sortHint={sort === "name_asc" ? "↑" : sort === "name_desc" ? "↓" : undefined} />
          <HeadCell icon={<IconDoc />} label={t("field.nib")} />
          <HeadCell icon={<IconCal />} label={t("col.incorporated")} />
        </div>

        {rows.length === 0 ? (
          <div className="py-20 text-center text-[13px] text-[var(--muted)]">
            {t("empty.no_companies")} <Link href="/companies/new" className="text-brand hover:text-brand-dark font-medium">{t("empty.add_first")}</Link>
          </div>
        ) : (
          rows.map((c) => (
            <div key={c.id} className={`group grid grid-cols-[36px_100px_1.8fr_1.1fr_1fr] gap-3 px-3 py-2 text-[13px] items-center border-b border-[var(--border)] last:border-b-0 hover:bg-white/50 transition-colors ${c.deleted_at ? "opacity-55" : ""}`}>
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
                  <span className="text-[9.5px] uppercase tracking-wider font-semibold text-[var(--muted)] bg-[var(--surface-2)] px-1.5 py-0.5 rounded shrink-0">{t("badge.archived")}</span>
                )}
              </Link>
              <div className="font-mono text-[11.5px] text-[var(--muted)] truncate">{c.nib ?? "—"}</div>
              <div className="text-[12.5px] text-[var(--muted)] font-mono">{fmtDate(c.incorporation_date)}</div>
            </div>
          ))
        )}
      </div>

      <div className="mt-3 text-[11.5px] text-[var(--muted)] px-1">
        {t("list.count.companies", { n: rows.length })}
        {rows.length === 200 && ` · ${t("common.showing_first", { n: 200 })}`}
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
