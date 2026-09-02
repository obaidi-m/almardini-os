import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Partner } from "@/lib/types";
import { getT } from "@/lib/i18n/server";

type SortKey = "newest" | "oldest" | "name_asc" | "name_desc";
type TypeFilter = "" | "referrer" | "agent" | "both";
type SearchParams = { show?: string; sort?: string; type?: string };

const TYPE_LABEL: Record<Partner["type"], string> = {
  referrer: "Referrer",
  agent: "Agent",
  both: "Both",
};

const TYPE_STYLE: Record<Partner["type"], { bg: string; text: string; dot: string }> = {
  referrer: { bg: "bg-[#DBEAFE]", text: "text-[#1E40AF]", dot: "bg-[#3B82F6]" },
  agent:    { bg: "bg-[#EDE9FE]", text: "text-[#5B21B6]", dot: "bg-[#8B5CF6]" },
  both:     { bg: "bg-[#FBEFD4]", text: "text-[#8A6919]", dot: "bg-[#E8B14A]" },
};

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "Newest first" },
  { key: "oldest", label: "Oldest first" },
  { key: "name_asc", label: "Name A → Z" },
  { key: "name_desc", label: "Name Z → A" },
];

export default async function PartnersListPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createClient();
  const { t } = await getT();
  const includeDeleted = searchParams.show === "archived";
  const sort: SortKey = (SORT_OPTIONS.find((o) => o.key === searchParams.sort)?.key ?? "newest") as SortKey;
  const typeFilter = (["referrer", "agent", "both"].includes(searchParams.type ?? "") ? searchParams.type : "") as TypeFilter;

  let query = supabase
    .from("partners")
    .select("id, code, name, type, contact_person, phone, email, deleted_at, created_at")
    .limit(200);

  if (!includeDeleted) query = query.is("deleted_at", null);
  if (typeFilter) query = query.eq("type", typeFilter);

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
    const merged = { show: includeDeleted ? "archived" : undefined, sort, type: typeFilter || undefined, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, String(v));
    const s = params.toString();
    return s ? `/partners?${s}` : "/partners";
  }

  const sortLabel = SORT_OPTIONS.find((o) => o.key === sort)?.label ?? "Newest first";
  const activeFilterCount = typeFilter ? 1 : 0;

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
          <span className="font-medium text-ink">All partners</span>
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
          <div className="absolute z-20 mt-1 left-0 min-w-[180px] bg-white rounded-lg shadow-lg border border-[var(--border)] py-1">
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
            {activeFilterCount > 0 && <span className="ml-1 bg-brand text-white text-[10px] font-semibold rounded-full px-1.5 py-0.5 leading-none min-w-[16px] text-center">{activeFilterCount}</span>}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-60"><path d="M6 9l6 6 6-6"/></svg>
          </summary>
          <div className="absolute z-20 mt-1 left-0 min-w-[180px] bg-white rounded-lg shadow-lg border border-[var(--border)] p-3">
            <div className="text-[10.5px] uppercase tracking-wider font-semibold text-[var(--muted)] mb-1.5">Type</div>
            <div className="-mx-1">
              <Link href={hrefWith({ type: undefined })} className={`block px-2 py-1 rounded text-[12.5px] hover:bg-[var(--surface-2)] ${!typeFilter ? "text-brand-dark font-medium" : "text-ink"}`}>
                Any type
              </Link>
              {(["referrer", "agent", "both"] as const).map((tk) => (
                <Link key={tk} href={hrefWith({ type: tk })} className={`block px-2 py-1 rounded text-[12.5px] hover:bg-[var(--surface-2)] ${typeFilter === tk ? "text-brand-dark font-medium" : "text-ink"}`}>
                  {TYPE_LABEL[tk]}
                </Link>
              ))}
            </div>
          </div>
        </details>

        {typeFilter && (
          <div className="flex items-center gap-1.5 pl-1">
            <span className="inline-flex items-center gap-1 bg-brand-soft text-brand-dark px-2 py-0.5 rounded-full text-[11.5px]">
              {TYPE_LABEL[typeFilter as Partner["type"]]}
              <Link href={hrefWith({ type: undefined })} className="opacity-70 hover:opacity-100">×</Link>
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
        <div className="grid grid-cols-[36px_100px_1.4fr_100px_1fr_1fr_1.3fr] gap-3 px-3 py-2 text-[11px] uppercase tracking-[0.06em] text-[var(--muted)] font-semibold border-b border-[var(--border-strong)] bg-white/30">
          <div className="flex items-center justify-center">
            <span className="w-3.5 h-3.5 rounded border border-[var(--border-strong)] bg-white" aria-hidden />
          </div>
          <HeadCell icon={<IconHash />} label="Code" href={hrefWith({ sort: sort === "newest" ? "oldest" : "newest" })} sortHint={sort === "newest" ? "↓" : sort === "oldest" ? "↑" : undefined} />
          <HeadCell icon={<IconHandshake />} label="Name" href={hrefWith({ sort: sort === "name_asc" ? "name_desc" : "name_asc" })} sortHint={sort === "name_asc" ? "↑" : sort === "name_desc" ? "↓" : undefined} />
          <HeadCell icon={<IconTag />} label="Type" />
          <HeadCell icon={<IconUser />} label="Contact person" />
          <HeadCell icon={<IconPhone />} label="Phone" />
          <HeadCell icon={<IconMail />} label="Email" />
        </div>

        {rows.length === 0 ? (
          <div className="py-20 text-center text-[13px] text-[var(--muted)]">
            {typeFilter ? (
              <>No partners match those filters. <Link href={hrefWith({ type: undefined })} className="text-brand hover:text-brand-dark font-medium">Clear filters</Link></>
            ) : (
              <>No partners yet. <Link href="/partners/new" className="text-brand hover:text-brand-dark font-medium">Add your first one →</Link></>
            )}
          </div>
        ) : (
          rows.map((p) => {
            const ts = TYPE_STYLE[p.type];
            return (
              <div key={p.id} className={`group grid grid-cols-[36px_100px_1.4fr_100px_1fr_1fr_1.3fr] gap-3 px-3 py-2 text-[13px] items-center border-b border-[var(--border)] last:border-b-0 hover:bg-white/50 transition-colors ${p.deleted_at ? "opacity-55" : ""}`}>
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
                    <span className="text-[9.5px] uppercase tracking-wider font-semibold text-[var(--muted)] bg-[var(--surface-2)] px-1.5 py-0.5 rounded shrink-0">archived</span>
                  )}
                </Link>
                <div>
                  <span className={`inline-flex items-center gap-1.5 text-[10.5px] font-medium px-2 py-0.5 rounded-full ${ts.bg} ${ts.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${ts.dot}`} />
                    {TYPE_LABEL[p.type]}
                  </span>
                </div>
                <div className="text-[12.5px] text-ink truncate">{p.contact_person ?? <span className="text-[var(--hint)]">—</span>}</div>
                <div className="text-[12.5px] text-ink truncate">{p.phone ?? <span className="text-[var(--hint)]">—</span>}</div>
                <div className="text-[12.5px] text-[var(--muted)] truncate">{p.email ?? <span className="text-[var(--hint)]">—</span>}</div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-3 text-[11.5px] text-[var(--muted)] px-1">
        {rows.length} {rows.length === 1 ? "partner" : "partners"}
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
