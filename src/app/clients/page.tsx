import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Client } from "@/lib/types";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/messages";

type SortKey = "newest" | "oldest" | "name_asc" | "name_desc";
type SearchParams = { show?: string; sort?: string; nationality?: string; channel?: string };

const SORT_KEYS: SortKey[] = ["newest", "oldest", "name_asc", "name_desc"];

export default async function ClientsListPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createClient();
  const { t } = await getT();
  const includeDeleted = searchParams.show === "archived";
  const sort: SortKey = (SORT_KEYS.find((k) => k === searchParams.sort) ?? "newest") as SortKey;
  const sortLabelFor = (k: SortKey) => t(`sort.${k}` as MessageKey);
  const filterNationality = (searchParams.nationality ?? "").trim();
  const filterChannel = (searchParams.channel ?? "").trim();

  // Base query for the current page
  let query = supabase
    .from("clients")
    .select("id, code, full_name, nationality, passport_no, phone, email, preferred_channel, deleted_at, created_at")
    .limit(200);

  if (!includeDeleted) query = query.is("deleted_at", null);
  if (filterNationality) query = query.eq("nationality", filterNationality);
  if (filterChannel) query = query.eq("preferred_channel", filterChannel);

  switch (sort) {
    case "oldest":    query = query.order("created_at", { ascending: true }); break;
    case "name_asc":  query = query.order("full_name", { ascending: true }); break;
    case "name_desc": query = query.order("full_name", { ascending: false }); break;
    default:          query = query.order("created_at", { ascending: false });
  }

  const { data, error } = await query;
  const rows: Client[] = (data as Client[]) ?? [];

  const activeCount = rows.filter((r) => !r.deleted_at).length;
  const archivedCount = rows.filter((r) => !!r.deleted_at).length;

  // Distinct nationality list (from the un-filtered client set) for the filter menu
  const { data: natRows } = await supabase
    .from("clients")
    .select("nationality")
    .is("deleted_at", null)
    .not("nationality", "is", null)
    .limit(2000);
  const nationalities = Array.from(
    new Set(((natRows as { nationality: string | null }[] | null) ?? []).map((r) => r.nationality).filter(Boolean) as string[]),
  ).sort();

  const CHANNEL_OPTIONS = ["whatsapp", "email", "phone", "in_person"];

  // Helper to preserve the query state when swapping one param
  function hrefWith(patch: Partial<SearchParams>): string {
    const params = new URLSearchParams();
    const merged = { show: includeDeleted ? "archived" : undefined, sort, nationality: filterNationality || undefined, channel: filterChannel || undefined, ...patch };
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, String(v));
    }
    const s = params.toString();
    return s ? `/clients?${s}` : "/clients";
  }

  const sortLabel = sortLabelFor(sort);
  const activeFilterCount = (filterNationality ? 1 : 0) + (filterChannel ? 1 : 0);

  return (
    <div className="max-w-[1400px]">
      {/* Page header */}
      <div className="flex items-start justify-between gap-6 mb-5">
        <div>
          <h1 className="font-serif text-[28px] leading-tight text-ink tracking-tight">
            {t("page.clients.title")}
          </h1>
          <p className="text-[13.5px] text-[var(--muted)] mt-1">
            {t("page.clients.subtitle")}
          </p>
        </div>
        <Link
          href="/clients/new"
          className="inline-flex items-center gap-1.5 bg-brand hover:bg-brand-dark text-white text-[13px] font-medium px-3.5 py-2 rounded-lg shadow-[0_4px_12px_-4px_rgba(20,138,124,0.5)] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M12 5v14M5 12h14" />
          </svg>
          {t("action.new")}
        </Link>
      </div>

      {/* Compact toolbar */}
      <div className="flex items-center gap-2 mb-3 text-[12px]">
        <div className="inline-flex items-center gap-1.5 text-[var(--muted)]">
          <IconClients />
          <span className="font-medium text-ink">{t("toolbar.all_clients")}</span>
          <span className="text-[var(--muted)]">·</span>
          <span>{rows.length}</span>
        </div>

        <div className="w-px h-4 bg-[var(--border-strong)] mx-1" />

        {/* Sort dropdown */}
        <details className="relative group">
          <summary className="inline-flex items-center gap-1 text-[var(--muted)] hover:text-ink px-2 py-1 rounded hover:bg-white/50 cursor-pointer list-none">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M6 12h12M10 18h4" />
            </svg>
            <span>{t("toolbar.sorted_by_prefix")} <span className="text-ink font-medium">{sortLabel}</span></span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-60"><path d="M6 9l6 6 6-6"/></svg>
          </summary>
          <div className="absolute z-20 mt-1 left-0 min-w-[180px] bg-white rounded-lg shadow-lg border border-[var(--border)] py-1">
            {SORT_KEYS.map((k) => (
              <Link
                key={k}
                href={hrefWith({ sort: k })}
                className={`flex items-center justify-between gap-2 px-3 py-1.5 text-[12.5px] hover:bg-[var(--surface-2)] ${sort === k ? "text-brand-dark font-medium" : "text-ink"}`}
              >
                {sortLabelFor(k)}
                {sort === k && <span className="text-brand text-[13px]">✓</span>}
              </Link>
            ))}
          </div>
        </details>

        {/* Filter dropdown */}
        <details className="relative group">
          <summary className="inline-flex items-center gap-1 text-[var(--muted)] hover:text-ink px-2 py-1 rounded hover:bg-white/50 cursor-pointer list-none">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 3H2l8 9v7l4 2v-9l8-9z" />
            </svg>
            <span>{t("toolbar.filter")}</span>
            {activeFilterCount > 0 && (
              <span className="ml-1 bg-brand text-white text-[10px] font-semibold rounded-full px-1.5 py-0.5 leading-none min-w-[16px] text-center">
                {activeFilterCount}
              </span>
            )}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-60"><path d="M6 9l6 6 6-6"/></svg>
          </summary>
          <div className="absolute z-20 mt-1 left-0 min-w-[240px] bg-white rounded-lg shadow-lg border border-[var(--border)] p-3 space-y-3">
            <div>
              <div className="text-[10.5px] uppercase tracking-wider font-semibold text-[var(--muted)] mb-1.5">{t("filter.section.nationality")}</div>
              <div className="max-h-[220px] overflow-y-auto -mx-1">
                <Link
                  href={hrefWith({ nationality: undefined })}
                  className={`block px-2 py-1 rounded text-[12.5px] hover:bg-[var(--surface-2)] ${!filterNationality ? "text-brand-dark font-medium" : "text-ink"}`}
                >
                  {t("toolbar.any_nationality")}
                </Link>
                {nationalities.map((n) => (
                  <Link
                    key={n}
                    href={hrefWith({ nationality: n })}
                    className={`block px-2 py-1 rounded text-[12.5px] hover:bg-[var(--surface-2)] ${filterNationality === n ? "text-brand-dark font-medium" : "text-ink"}`}
                  >
                    {n}
                  </Link>
                ))}
              </div>
            </div>
            <div className="border-t border-[var(--border)] pt-3">
              <div className="text-[10.5px] uppercase tracking-wider font-semibold text-[var(--muted)] mb-1.5">{t("filter.section.channel")}</div>
              <div className="-mx-1">
                <Link
                  href={hrefWith({ channel: undefined })}
                  className={`block px-2 py-1 rounded text-[12.5px] hover:bg-[var(--surface-2)] ${!filterChannel ? "text-brand-dark font-medium" : "text-ink"}`}
                >
                  {t("toolbar.any_channel")}
                </Link>
                {CHANNEL_OPTIONS.map((c) => (
                  <Link
                    key={c}
                    href={hrefWith({ channel: c })}
                    className={`block px-2 py-1 rounded text-[12.5px] hover:bg-[var(--surface-2)] ${filterChannel === c ? "text-brand-dark font-medium" : "text-ink"}`}
                  >
                    {t(`channel.${c}` as MessageKey)}
                  </Link>
                ))}
              </div>
            </div>
            {activeFilterCount > 0 && (
              <Link
                href={hrefWith({ nationality: undefined, channel: undefined })}
                className="block text-center text-[11.5px] text-[var(--muted)] hover:text-ink pt-1 border-t border-[var(--border)]"
              >
                {t("toolbar.clear_filters")}
              </Link>
            )}
          </div>
        </details>

        {activeFilterCount > 0 && (
          <div className="flex items-center gap-1.5 pl-1">
            {filterNationality && (
              <span className="inline-flex items-center gap-1 bg-brand-soft text-brand-dark px-2 py-0.5 rounded-full text-[11.5px]">
                {filterNationality}
                <Link href={hrefWith({ nationality: undefined })} className="opacity-70 hover:opacity-100">×</Link>
              </span>
            )}
            {filterChannel && (
              <span className="inline-flex items-center gap-1 bg-brand-soft text-brand-dark px-2 py-0.5 rounded-full text-[11.5px]">
                {t(`channel.${filterChannel}` as MessageKey)}
                <Link href={hrefWith({ channel: undefined })} className="opacity-70 hover:opacity-100">×</Link>
              </span>
            )}
          </div>
        )}

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
          <Link
            href={hrefWith({ show: includeDeleted ? undefined : "archived" })}
            className={`px-2.5 py-1 rounded-md text-[11.5px] font-medium transition-colors ${
              includeDeleted
                ? "bg-brand-soft text-brand-dark"
                : "text-[var(--muted)] hover:text-ink hover:bg-white/40"
            }`}
          >
            {includeDeleted ? t("action.hide_archived") : t("action.show_archived")}
          </Link>
        </div>
      </div>

      {error && (
        <div className="text-[12.5px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
          {error.message}
        </div>
      )}

      {/* Dense table — flanked by strong top/bottom lines so it reads as a table */}
      <div className="border-y border-[var(--border-strong)]">
        {/* Header */}
        <div className="grid grid-cols-[36px_90px_1.3fr_0.9fr_1fr_1fr_1.4fr_100px] gap-3 px-3 py-2 text-[11px] uppercase tracking-[0.06em] text-[var(--muted)] font-semibold border-b border-[var(--border-strong)] bg-white/30">
          <div className="flex items-center justify-center">
            <span className="w-3.5 h-3.5 rounded border border-[var(--border-strong)] bg-white" aria-hidden />
          </div>
          <HeadCell icon={<IconHash />} label={t("col.code")} href={hrefWith({ sort: sort === "newest" ? "oldest" : "newest" })} sortHint={sort === "newest" ? "↓" : sort === "oldest" ? "↑" : undefined} />
          <HeadCell icon={<IconUser />} label={t("field.name")} href={hrefWith({ sort: sort === "name_asc" ? "name_desc" : "name_asc" })} sortHint={sort === "name_asc" ? "↑" : sort === "name_desc" ? "↓" : undefined} />
          <HeadCell icon={<IconGlobe />} label={t("field.nationality")} />
          <HeadCell icon={<IconPassport />} label={t("col.passport")} />
          <HeadCell icon={<IconPhone />} label={t("field.phone")} />
          <HeadCell icon={<IconMail />} label={t("field.email")} />
          <HeadCell icon={<IconChat />} label={t("col.channel")} />
        </div>

        {rows.length === 0 ? (
          <div className="py-20 text-center text-[13px] text-[var(--muted)]">
            {activeFilterCount > 0 ? (
              <>
                {t("empty.no_clients_match")}{" "}
                <Link href={hrefWith({ nationality: undefined, channel: undefined })} className="text-brand hover:text-brand-dark font-medium">
                  {t("empty.clear_link")}
                </Link>
              </>
            ) : (
              <>
                {t("empty.no_clients")}{" "}
                <Link href="/clients/new" className="text-brand hover:text-brand-dark font-medium">
                  {t("empty.add_first")}
                </Link>
              </>
            )}
          </div>
        ) : (
          rows.map((c) => (
            <div
              key={c.id}
              className={`group grid grid-cols-[36px_90px_1.3fr_0.9fr_1fr_1fr_1.4fr_100px] gap-3 px-3 py-2 text-[13px] items-center border-b border-[var(--border)] last:border-b-0 hover:bg-white/50 transition-colors ${
                c.deleted_at ? "opacity-55" : ""
              }`}
            >
              <div className="flex items-center justify-center">
                <span className="w-3.5 h-3.5 rounded border border-[var(--border-strong)] bg-white opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden />
              </div>
              <Link href={`/clients/${c.id}`} className="min-w-0">
                <span className="font-mono text-[11px] text-brand-dark bg-brand-softer px-1.5 py-0.5 rounded">
                  {c.code}
                </span>
              </Link>
              <Link href={`/clients/${c.id}`} className="min-w-0 flex items-center gap-2 group/name">
                <span className="w-6 h-6 rounded-full bg-brand-softer text-brand-dark grid place-items-center text-[10.5px] font-semibold shrink-0">
                  {initials(c.full_name)}
                </span>
                <span className="text-ink font-medium truncate group-hover/name:text-brand-dark">
                  {c.full_name}
                </span>
                {c.deleted_at && (
                  <span className="text-[9.5px] uppercase tracking-wider font-semibold text-[var(--muted)] bg-[var(--surface-2)] px-1.5 py-0.5 rounded shrink-0">
                    {t("badge.archived")}
                  </span>
                )}
              </Link>
              <div className="truncate">
                {c.nationality ? (
                  <span className="inline-block text-[11.5px] text-ink bg-white/60 border border-[var(--border)] px-1.5 py-0.5 rounded">
                    {c.nationality}
                  </span>
                ) : (
                  <span className="text-[var(--hint)]">—</span>
                )}
              </div>
              <div className="font-mono text-[11.5px] text-[var(--muted)] truncate">
                {c.passport_no ?? "—"}
              </div>
              <div className="text-ink text-[12.5px] truncate">
                {c.phone ?? <span className="text-[var(--hint)]">—</span>}
              </div>
              <div className="text-[var(--muted)] text-[12.5px] truncate">
                {c.email ?? <span className="text-[var(--hint)]">—</span>}
              </div>
              <div>
                <ChannelPill channel={c.preferred_channel} label={c.preferred_channel ? t(`channel.${c.preferred_channel}` as MessageKey) : undefined} />
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-3 text-[11.5px] text-[var(--muted)] px-1">
        {t("list.count.clients", { n: rows.length })}
        {rows.length === 200 && ` · ${t("common.showing_first", { n: 200 })}`}
      </div>
    </div>
  );
}

/* ============ Cells & bits ============ */

function HeadCell({ icon, label, href, sortHint }: { icon: React.ReactNode; label: string; href?: string; sortHint?: string }) {
  const inner = (
    <>
      <span className="text-[var(--muted)] shrink-0 opacity-60">{icon}</span>
      <span className="truncate">{label}</span>
      {sortHint && <span className="text-brand-dark opacity-80 ml-0.5">{sortHint}</span>}
    </>
  );
  if (href) {
    return (
      <Link href={href} className="flex items-center gap-1.5 min-w-0 hover:text-ink">
        {inner}
      </Link>
    );
  }
  return <div className="flex items-center gap-1.5 min-w-0">{inner}</div>;
}

function ChannelPill({ channel, label }: { channel?: string | null; label?: string }) {
  if (!channel) return <span className="text-[var(--hint)] text-[12px]">—</span>;
  const styles: Record<string, { bg: string; text: string; dot: string }> = {
    whatsapp:  { bg: "bg-[#DCFCE7]", text: "text-[#166534]", dot: "bg-[#22C55E]" },
    email:     { bg: "bg-[#DBEAFE]", text: "text-[#1E40AF]", dot: "bg-[#3B82F6]" },
    phone:     { bg: "bg-[#FEF3C7]", text: "text-[#92400E]", dot: "bg-[#F59E0B]" },
    in_person: { bg: "bg-[#EDE9FE]", text: "text-[#5B21B6]", dot: "bg-[#8B5CF6]" },
  };
  const s = styles[channel] ?? { bg: "bg-[var(--surface-2)]", text: "text-[var(--muted)]", dot: "bg-[var(--muted)]" };
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10.5px] font-medium px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {label ?? channel.replace(/_/g, " ")}
    </span>
  );
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/* ============ Column-header icons ============ */
const iconProps = { width: 13, height: 13, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8 } as const;
function IconClients()  { return (<svg {...iconProps}><circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><circle cx="17" cy="6" r="3"/><path d="M17 12c3 0 5 1.5 5 5"/></svg>); }
function IconHash()     { return (<svg {...iconProps}><path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18"/></svg>); }
function IconUser()     { return (<svg {...iconProps}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>); }
function IconGlobe()    { return (<svg {...iconProps}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>); }
function IconPassport() { return (<svg {...iconProps}><rect x="5" y="3" width="14" height="18" rx="1.5"/><circle cx="12" cy="10" r="2.5"/><path d="M9 16h6"/></svg>); }
function IconPhone()    { return (<svg {...iconProps}><path d="M4 5a2 2 0 0 1 2-2h2l2 5-2 1a11 11 0 0 0 6 6l1-2 5 2v2a2 2 0 0 1-2 2A16 16 0 0 1 4 5z"/></svg>); }
function IconMail()     { return (<svg {...iconProps}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>); }
function IconChat()     { return (<svg {...iconProps}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z"/></svg>); }
