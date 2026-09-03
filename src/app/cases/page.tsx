import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { CaseStatus, CasePriority } from "@/lib/types";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/messages";
import { ServiceFilter } from "./ServiceFilter";
import { serviceLabel } from "@/lib/service";

type SortKey = "recent" | "deadline_asc" | "priority" | "code_asc";
type SearchParams = { status?: string; mine?: string; sort?: string; service?: string; show?: string };

type CaseRow = {
  id: string;
  code: string;
  title: string | null;
  status: CaseStatus;
  priority: CasePriority;
  deadline: string | null;
  updated_at: string;
  deleted_at: string | null;
  client: { id: string; full_name: string } | { id: string; full_name: string }[] | null;
  company: { id: string; name: string } | { id: string; name: string }[] | null;
  service: { id: string; code: string; name: string } | { id: string; code: string; name: string }[] | null;
  assignee: { id: string; full_name: string } | { id: string; full_name: string }[] | null;
};

const STATUS_FILTERS: CaseStatus[] = ["new", "in_progress", "done", "delivered"];

const STATUS_PILL: Record<CaseStatus, { bg: string; text: string; dot: string }> = {
  new:         { bg: "bg-[#FEF3C7]", text: "text-[#92400E]", dot: "bg-[#F59E0B]" },
  in_progress: { bg: "bg-[#DBEAFE]", text: "text-[#1E40AF]", dot: "bg-[#3B82F6]" },
  done:        { bg: "bg-[#DCFCE7]", text: "text-[#166534]", dot: "bg-[#22C55E]" },
  delivered:   { bg: "bg-[var(--surface-2)]", text: "text-[var(--muted)]", dot: "bg-[var(--muted)]" },
};

const PRIORITY_STYLE: Record<CasePriority, string> = {
  low:    "text-[var(--muted)]",
  normal: "text-ink",
  high:   "text-[#8A6919] font-medium",
  urgent: "text-red-700 font-semibold",
};

const SORT_KEYS: SortKey[] = ["recent", "deadline_asc", "priority", "code_asc"];

export default async function CasesListPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createClient();
  const { t } = await getT();
  const sortLabelFor = (k: SortKey) => t(`sort.${k}` as MessageKey);
  const status = searchParams.status && STATUS_FILTERS.includes(searchParams.status as CaseStatus)
    ? (searchParams.status as CaseStatus)
    : null;
  const mineOnly = searchParams.mine === "1";
  // Delivered cases are the healthy end state, not deletion candidates —
  // they're hidden by default on the "All" view to keep the list actionable,
  // but stay one click away via the Delivered status pill or ?show=delivered.
  // Archived (soft-deleted) cases are the real "elsewhere" pile — off by
  // default, opt in with ?show=archived.
  const showArchived  = searchParams.show === "archived";
  const showDelivered = searchParams.show === "delivered" || status === "delivered" || !!status;
  const sort: SortKey = (SORT_KEYS.find((k) => k === searchParams.sort) ?? "recent") as SortKey;
  const serviceIds = (searchParams.service ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const serviceFilterParam = serviceIds.join(",");

  const { data: services } = await supabase
    .from("service_types")
    .select("id, name")
    .eq("is_active", true)
    .order("name");
  const serviceOptions = (services as Array<{ id: string; name: string }> | null) ?? [];
  const selectedServiceNames = serviceIds
    .map((id) => serviceOptions.find((s) => s.id === id)?.name)
    .filter((n): n is string => !!n);

  const { data: { user } } = await supabase.auth.getUser();

  let query = supabase
    .from("cases")
    .select(`id, code, title, status, priority, deadline, updated_at, deleted_at,
             client:clients(id, full_name),
             company:companies(id, name),
             service:service_types(id, code, name),
             assignee:users!cases_assigned_to_fkey(id, full_name)`)
    .limit(200);

  if (!showArchived) query = query.is("deleted_at", null);
  if (status) query = query.eq("status", status);
  else if (!showDelivered) query = query.neq("status", "delivered");
  if (mineOnly && user) query = query.eq("assigned_to", user.id);
  if (serviceIds.length > 0) query = query.in("service_type_id", serviceIds);

  switch (sort) {
    case "deadline_asc": query = query.order("deadline", { ascending: true, nullsFirst: false }); break;
    case "priority":     query = query.order("priority", { ascending: false }); break;
    case "code_asc":     query = query.order("code", { ascending: true }); break;
    default:             query = query.order("updated_at", { ascending: false });
  }

  const { data, error } = await query;
  const rows: CaseRow[] = (data as unknown as CaseRow[]) ?? [];

  function hrefWith(patch: Partial<SearchParams>): string {
    const params = new URLSearchParams();
    const merged = {
      status: status ?? undefined,
      mine: mineOnly ? "1" : undefined,
      sort,
      service: serviceFilterParam || undefined,
      show: searchParams.show,
      ...patch,
    };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, String(v));
    const s = params.toString();
    return s ? `/cases?${s}` : "/cases";
  }

  const sortLabel = sortLabelFor(sort);
  const activeFilterCount = (status ? 1 : 0) + (mineOnly ? 1 : 0) + (serviceIds.length > 0 ? 1 : 0);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="max-w-[1400px]">
      <div className="flex items-start justify-between gap-6 mb-5">
        <div>
          <h1 className="font-serif text-[28px] leading-tight text-ink tracking-tight">
            {t("page.cases.title")}
          </h1>
          <p className="text-[13.5px] text-[var(--muted)] mt-1">
            {t("page.cases.subtitle")}
          </p>
        </div>
        <Link
          href="/cases/new"
          className="inline-flex items-center gap-1.5 bg-brand hover:bg-brand-dark text-white text-[13px] font-medium px-3.5 py-2 rounded-lg shadow-[0_4px_12px_-4px_rgba(20,138,124,0.5)] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M12 5v14M5 12h14"/></svg>
          {t("action.new")}
        </Link>
      </div>

      {/* Status filter row */}
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        <StatusPill label={t("cases.filter.all")} href={hrefWith({ status: undefined })} active={!status} />
        {STATUS_FILTERS.map((s) => {
          const p = STATUS_PILL[s];
          return (
            <StatusPill
              key={s}
              label={t(`status.${s}` as MessageKey)}
              href={hrefWith({ status: s })}
              active={status === s}
              dot={p.dot}
            />
          );
        })}
        <div className="w-px h-4 bg-[var(--border-strong)] mx-1" />
        <Link
          href={hrefWith({ mine: mineOnly ? undefined : "1" })}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-medium transition-colors ${
            mineOnly ? "bg-brand text-white" : "text-[var(--muted)] hover:text-ink hover:bg-white/50"
          }`}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>
          {mineOnly ? t("cases.filter.my_cases_only") : t("cases.filter.my_cases")}
        </Link>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3 text-[12px]">
        <div className="inline-flex items-center gap-1.5 text-[var(--muted)]">
          <IconFolder />
          <span className="font-medium text-ink">
            {status ? t(`status.${status}` as MessageKey) : t("toolbar.all_cases")}
            {mineOnly ? ` · ${t("toolbar.mine")}` : ""}
          </span>
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

        <ServiceFilter
          userId={user?.id ?? null}
          options={serviceOptions}
          selectedIds={serviceIds}
          selectedNames={selectedServiceNames}
          baseHref={hrefWith({ service: undefined })}
          otherParams={{ status: status ?? undefined, mine: mineOnly ? "1" : undefined, sort }}
          clearLabel={t("toolbar.clear_filters")}
        />

        {activeFilterCount > 0 && (
          <Link href="/cases" className="text-[11.5px] text-[var(--muted)] hover:text-ink px-2 py-1 rounded hover:bg-white/50">
            {t("toolbar.reset_all")}
          </Link>
        )}

        <div className="ml-auto flex items-center gap-3 text-[var(--muted)]">
          {!status && (
            <Link
              href={hrefWith({ show: showDelivered ? undefined : "delivered" })}
              className={`text-[11.5px] px-2 py-1 rounded hover:bg-white/50 ${
                showDelivered ? "text-ink font-medium" : "text-[var(--muted)] hover:text-ink"
              }`}
            >
              {showDelivered ? "Hide delivered" : "Show delivered"}
            </Link>
          )}
          <Link
            href={hrefWith({ show: showArchived ? undefined : "archived" })}
            className={`text-[11.5px] px-2 py-1 rounded hover:bg-white/50 ${
              showArchived ? "text-ink font-medium" : "text-[var(--muted)] hover:text-ink"
            }`}
          >
            {showArchived ? "Hide archived" : "Show archived"}
          </Link>
          <span>{t("list.count.cases", { n: rows.length })}</span>
        </div>
      </div>

      {error && (
        <div className="text-[12.5px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{error.message}</div>
      )}

      <div className="border-y border-[var(--border-strong)]">
        <div className="grid grid-cols-[36px_100px_1.6fr_1fr_120px_1fr_90px_100px] gap-3 px-3 py-2 text-[11px] uppercase tracking-[0.06em] text-[var(--muted)] font-semibold border-b border-[var(--border-strong)] bg-white/30">
          <div className="flex items-center justify-center">
            <span className="w-3.5 h-3.5 rounded border border-[var(--border-strong)] bg-white" aria-hidden />
          </div>
          <HeadCell icon={<IconHash />} label={t("col.code")} href={hrefWith({ sort: "code_asc" })} sortHint={sort === "code_asc" ? "↑" : undefined} />
          <HeadCell icon={<IconUser />} label={t("cases.col.client_title")} />
          <HeadCell icon={<IconDoc />} label={t("cases.col.service")} />
          <HeadCell icon={<IconDot />} label={t("cases.col.status")} />
          <HeadCell icon={<IconUser />} label={t("cases.col.assignee")} />
          <HeadCell icon={<IconFlag />} label={t("cases.col.priority")} href={hrefWith({ sort: "priority" })} sortHint={sort === "priority" ? "↓" : undefined} />
          <HeadCell icon={<IconClock />} label={t("cases.col.deadline")} href={hrefWith({ sort: "deadline_asc" })} sortHint={sort === "deadline_asc" ? "↑" : undefined} />
        </div>

        {rows.length === 0 ? (
          <div className="py-20 text-center text-[13px] text-[var(--muted)]">
            {status || mineOnly || serviceIds.length > 0 ? (
              <>{t("cases.empty.no_match")} <Link href="/cases" className="text-brand hover:text-brand-dark font-medium">{t("cases.empty.reset")}</Link></>
            ) : (
              <>{t("empty.no_cases")} <Link href="/cases/new" className="text-brand hover:text-brand-dark font-medium">{t("cases.empty.create_first")}</Link></>
            )}
          </div>
        ) : (
          rows.map((c) => {
            const client = Array.isArray(c.client) ? c.client[0] : c.client;
            const company = Array.isArray(c.company) ? c.company[0] : c.company;
            const service = Array.isArray(c.service) ? c.service[0] : c.service;
            const assignee = Array.isArray(c.assignee) ? c.assignee[0] : c.assignee;
            const overdue = c.deadline && c.deadline < today && c.status !== "delivered";
            const sp = STATUS_PILL[c.status];
            return (
              <div key={c.id} className={`group grid grid-cols-[36px_100px_1.6fr_1fr_120px_1fr_90px_100px] gap-3 px-3 py-2 text-[13px] items-center border-b border-[var(--border)] last:border-b-0 hover:bg-white/50 transition-colors ${c.deleted_at ? "opacity-55" : ""}`}>
                <div className="flex items-center justify-center">
                  <span className="w-3.5 h-3.5 rounded border border-[var(--border-strong)] bg-white opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden />
                </div>
                <Link href={`/cases/${c.id}`}>
                  <span className="font-mono text-[11px] text-brand-dark bg-brand-softer px-1.5 py-0.5 rounded">{c.code}</span>
                </Link>
                <Link href={`/cases/${c.id}`} className="min-w-0 group/name">
                  <div className="text-ink font-medium truncate group-hover/name:text-brand-dark">
                    {client?.full_name ?? (company ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold">{t("cases.row.company_prefix")}</span>
                        {company.name}
                      </span>
                    ) : <span className="italic text-[var(--muted)]">—</span>)}
                  </div>
                  {c.title && (
                    <div className="text-[11.5px] text-[var(--muted)] truncate">{c.title}</div>
                  )}
                </Link>
                <div className="text-[12.5px] text-[var(--muted)] truncate">{service ? serviceLabel(service) : <span className="text-[var(--hint)]">—</span>}</div>
                <div>
                  <span className={`inline-flex items-center gap-1.5 text-[10.5px] font-medium px-2 py-0.5 rounded-full ${sp.bg} ${sp.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${sp.dot}`} />
                    {t(`status.${c.status}` as MessageKey)}
                  </span>
                </div>
                <div className="min-w-0 flex items-center gap-1.5 text-[12.5px] text-ink truncate">
                  {assignee ? (
                    <>
                      <span className="w-5 h-5 rounded-full bg-brand-softer text-brand-dark grid place-items-center text-[9.5px] font-semibold shrink-0">
                        {initials(assignee.full_name)}
                      </span>
                      <span className="truncate">{assignee.full_name}</span>
                    </>
                  ) : (
                    <span className="text-[var(--hint)]">{t("cases.row.unassigned")}</span>
                  )}
                </div>
                <div className={`text-[11.5px] ${PRIORITY_STYLE[c.priority]}`}>{t(`priority.${c.priority}` as MessageKey)}</div>
                <div className={`text-[11.5px] font-mono ${overdue ? "text-red-700 font-semibold" : "text-[var(--muted)]"}`}>
                  {fmtDate(c.deadline)}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-3 text-[11.5px] text-[var(--muted)] px-1">
        {t("list.count.cases", { n: rows.length })}
        {rows.length === 200 && ` · ${t("common.showing_first", { n: 200 })}`}
      </div>
    </div>
  );
}

/* ============ Cells ============ */

function StatusPill({ label, href, active, dot }: { label: string; href: string; active: boolean; dot?: string }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-medium transition-colors ${
        active ? "bg-ink text-white" : "text-[var(--muted)] hover:text-ink hover:bg-white/50"
      }`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-white" : dot}`} />}
      {label}
    </Link>
  );
}

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

function fmtDate(v: string | null | undefined): string {
  if (!v) return "—";
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

/* ============ Icons ============ */
const iconProps = { width: 13, height: 13, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8 } as const;
function IconHash()   { return (<svg {...iconProps}><path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18"/></svg>); }
function IconUser()   { return (<svg {...iconProps}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>); }
function IconDoc()    { return (<svg {...iconProps}><path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path d="M14 2v6h6"/></svg>); }
function IconDot()    { return (<svg {...iconProps}><circle cx="12" cy="12" r="4"/></svg>); }
function IconFlag()   { return (<svg {...iconProps}><path d="M4 21V4a2 2 0 0 1 2-2h10l-3 5 3 5H6"/></svg>); }
function IconClock()  { return (<svg {...iconProps}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>); }
function IconFolder() { return (<svg {...iconProps}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>); }
