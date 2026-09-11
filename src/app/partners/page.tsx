import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Partner } from "@/lib/types";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/messages";

type SortKey = "newest" | "oldest" | "name_asc" | "name_desc";
type SearchParams = { show?: string; sort?: string };

const SORT_KEYS: SortKey[] = ["newest", "oldest", "name_asc", "name_desc"];

export default async function PartnersListPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createClient();
  const { t } = await getT();
  const sortLabelFor = (k: SortKey) => t(`sort.${k}` as MessageKey);
  const includeDeleted = searchParams.show === "archived";
  const sort: SortKey = (SORT_KEYS.find((k) => k === searchParams.sort) ?? "newest") as SortKey;

  let query = supabase
    .from("partners")
    .select("id, code, name, type, contact_person, phone, email, deleted_at, created_at")
    .limit(200);

  if (!includeDeleted) query = query.is("deleted_at", null);

  switch (sort) {
    case "oldest":    query = query.order("created_at", { ascending: true }); break;
    case "name_asc":  query = query.order("name", { ascending: true }); break;
    case "name_desc": query = query.order("name", { ascending: false }); break;
    default:          query = query.order("created_at", { ascending: false });
  }

  const { data, error } = await query;
  const rows: Partner[] = (data as Partner[]) ?? [];

  const activeCount = rows.filter((r) => !r.deleted_at).length;
  const archivedCount = rows.filter((r) => !!r.deleted_at).length;

  function hrefWith(patch: Partial<SearchParams>): string {
    const params = new URLSearchParams();
    const merged = { show: includeDeleted ? "archived" : undefined, sort, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, String(v));
    const s = params.toString();
    return s ? `/partners?${s}` : "/partners";
  }

  const sortLabel = sortLabelFor(sort);

  return (
    <div className="max-w-[1400px]">
      <div className="flex items-start justify-between gap-6 mb-5">
        <div>
          <h1 className="font-serif text-[28px] leading-tight text-ink tracking-tight">
            {t("page.partners.title")}
          </h1>
          <p className="text-[13.5px] text-[var(--muted)] mt-1">
            {t("page.partners.subtitle")}
          </p>
        </div>
        <Link
          href="/partners/new"
          className="inline-flex items-center gap-1.5 bg-brand hover:bg-brand-dark text-white text-[13px] font-medium px-3.5 py-2 rounded-lg shadow-[0_4px_12px_-4px_rgba(20,138,124,0.5)] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M12 5v14M5 12h14"/></svg>
          {t("action.new")}
        </Link>
      </div>

      <div className="flex items-center gap-2 mb-3 text-[12px]">
        <div className="inline-flex items-center gap-1.5 text-[var(--muted)]">
          <IconHandshake />
          <span className="font-medium text-ink">{t("toolbar.all_partners")}</span>
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
          <div className="absolute z-20 mt-1 left-0 min-w-[180px] bg-white rounded-lg shadow-lg border border-[var(--border)] py-1">
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
        <div className="grid grid-cols-[36px_100px_1.6fr_1fr_1fr_1.3fr] gap-3 px-3 py-2 text-[11px] uppercase tracking-[0.06em] text-[var(--muted)] font-semibold border-b border-[var(--border-strong)] bg-white/30">
          <div className="flex items-center justify-center">
            <span className="w-3.5 h-3.5 rounded border border-[var(--border-strong)] bg-white" aria-hidden />
          </div>
          <HeadCell icon={<IconHash />} label={t("col.code")} href={hrefWith({ sort: sort === "newest" ? "oldest" : "newest" })} sortHint={sort === "newest" ? "↓" : sort === "oldest" ? "↑" : undefined} />
          <HeadCell icon={<IconHandshake />} label={t("field.name")} href={hrefWith({ sort: sort === "name_asc" ? "name_desc" : "name_asc" })} sortHint={sort === "name_asc" ? "↑" : sort === "name_desc" ? "↓" : undefined} />
          <HeadCell icon={<IconUser />} label={t("field.contact_person")} />
          <HeadCell icon={<IconPhone />} label={t("field.phone")} />
          <HeadCell icon={<IconMail />} label={t("field.email")} />
        </div>

        {rows.length === 0 ? (
          <div className="py-20 text-center text-[13px] text-[var(--muted)]">
            <>{t("empty.no_partners")} <Link href="/partners/new" className="text-brand hover:text-brand-dark font-medium">{t("empty.add_first")}</Link></>
          </div>
        ) : (
          rows.map((p) => {
            return (
              <div key={p.id} className={`group grid grid-cols-[36px_100px_1.6fr_1fr_1fr_1.3fr] gap-3 px-3 py-2 text-[13px] items-center border-b border-[var(--border)] last:border-b-0 hover:bg-white/50 transition-colors ${p.deleted_at ? "opacity-55" : ""}`}>
                <div className="flex items-center justify-center">
                  <span className="w-3.5 h-3.5 rounded border border-[var(--border-strong)] bg-white opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden />
                </div>
                <Link href={`/partners/${p.id}`}>
                  <span className="font-mono text-[11px] text-brand-dark bg-brand-softer px-1.5 py-0.5 rounded">{p.code}</span>
                </Link>
                <Link href={`/partners/${p.id}`} className="min-w-0 flex items-center gap-2 group/name">
                  <span className="w-6 h-6 rounded-full bg-brand-softer text-brand-dark grid place-items-center text-[10.5px] font-semibold shrink-0">
                    {initials(p.name)}
                  </span>
                  <span className="text-ink font-medium truncate group-hover/name:text-brand-dark">{p.name}</span>
                  {p.deleted_at && (
                    <span className="text-[9.5px] uppercase tracking-wider font-semibold text-[var(--muted)] bg-[var(--surface-2)] px-1.5 py-0.5 rounded shrink-0">{t("badge.archived")}</span>
                  )}
                </Link>
                <div className="text-[12.5px] text-ink truncate">{p.contact_person ?? <span className="text-[var(--hint)]">—</span>}</div>
                <div className="text-[12.5px] text-ink truncate">{p.phone ?? <span className="text-[var(--hint)]">—</span>}</div>
                <div className="text-[12.5px] text-[var(--muted)] truncate">{p.email ?? <span className="text-[var(--hint)]">—</span>}</div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-3 text-[11.5px] text-[var(--muted)] px-1">
        {t("list.count.partners", { n: rows.length })}
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

function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

/* ============ Icons ============ */
const iconProps = { width: 13, height: 13, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8 } as const;
function IconHash()      { return (<svg {...iconProps}><path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18"/></svg>); }
function IconHandshake() { return (<svg {...iconProps}><path d="M3 12l4-4 4 4-2 2 4 4 6-6-8-8H5z"/></svg>); }
function IconTag()       { return (<svg {...iconProps}><path d="M20 12l-8 8-9-9V4h7l10 10z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>); }
function IconUser()      { return (<svg {...iconProps}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>); }
function IconPhone()     { return (<svg {...iconProps}><path d="M4 5a2 2 0 0 1 2-2h2l2 5-2 1a11 11 0 0 0 6 6l1-2 5 2v2a2 2 0 0 1-2 2A16 16 0 0 1 4 5z"/></svg>); }
function IconMail()      { return (<svg {...iconProps}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>); }
