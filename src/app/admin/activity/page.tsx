// Rebuilt at most every 60s per path — actions call revalidatePath
// to bust it immediately on mutations.
export const revalidate = 60;

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type SearchParams = { entity?: string; actor?: string; page?: string };

type ActivityRow = {
  id: number;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  actor: { id: string; full_name: string; email: string } | { id: string; full_name: string; email: string }[] | null;
};

const ENTITY_FILTERS: { code: string; label: string }[] = [
  { code: "",         label: "All entities" },
  { code: "client",   label: "Clients" },
  { code: "company",  label: "Companies" },
  { code: "case",     label: "Cases" },
  { code: "partner",  label: "Partners" },
  { code: "case_update", label: "Case updates" },
  { code: "user",     label: "Users" },
  { code: "role",     label: "Roles" },
  { code: "service_type", label: "Services" },
];

const ACTION_TONE: Record<string, string> = {
  created:        "bg-green-100 text-green-800",
  updated:        "bg-blue-100 text-blue-800",
  status_changed: "bg-violet-100 text-violet-800",
  deleted:        "bg-red-100 text-red-800",
  archived:       "bg-neutral-200 text-neutral-700",
  activated:      "bg-green-100 text-green-800",
  invited:        "bg-blue-100 text-blue-800",
  role_changed:   "bg-amber-100 text-amber-800",
};

const PAGE_SIZE = 50;

export default async function AdminActivityPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createClient();
  const entityFilter = (searchParams.entity ?? "").trim();
  const actorFilter = (searchParams.actor ?? "").trim();
  const pageIndex = Math.max(0, Number(searchParams.page ?? "0") | 0);

  const from = pageIndex * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let q = supabase
    .from("activity_log")
    .select(`id, action, entity_type, entity_id, summary, metadata, created_at,
             actor:users!activity_log_actor_id_fkey(id, full_name, email)`, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (entityFilter) q = q.eq("entity_type", entityFilter);
  if (actorFilter) q = q.eq("actor_id", actorFilter);

  const [{ data, count, error }, { data: actorList }] = await Promise.all([
    q,
    supabase.from("users").select("id, full_name").eq("is_active", true).order("full_name"),
  ]);

  const rows = (data as unknown as ActivityRow[]) ?? [];
  const actors = (actorList as Array<{ id: string; full_name: string }>) ?? [];
  const unwrapActor = (a: ActivityRow["actor"]) => Array.isArray(a) ? a[0] ?? null : a;

  // Batch-fetch the display code/name for every referenced entity so the
  // Entity column can show e.g. "CL-0042 · Ali Rahman" instead of just
  // "client". One query per entity type, ids scoped to what's on this page.
  const idsByType = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!r.entity_id) continue;
    if (!idsByType.has(r.entity_type)) idsByType.set(r.entity_type, new Set());
    idsByType.get(r.entity_type)!.add(r.entity_id);
  }
  const labels = new Map<string, { code: string; name: string | null }>();
  const key = (t: string, id: string) => `${t}:${id}`;
  const fetchLabels = async (
    table: string, type: string, ids: string[], nameCol: string | null,
  ) => {
    if (ids.length === 0) return;
    const cols = nameCol ? `id, code, ${nameCol}` : `id, code`;
    const { data: rs } = await supabase.from(table).select(cols).in("id", ids);
    for (const r of (rs as unknown as Array<{ id: string; code: string } & Record<string, unknown>> | null) ?? []) {
      labels.set(key(type, r.id), { code: r.code, name: nameCol ? (r[nameCol] as string | null) ?? null : null });
    }
  };
  await Promise.all([
    fetchLabels("clients",       "client",  [...(idsByType.get("client")  ?? [])], "full_name"),
    fetchLabels("companies",     "company", [...(idsByType.get("company") ?? [])], "name"),
    fetchLabels("cases",         "case",    [...(idsByType.get("case")    ?? [])], "title"),
    fetchLabels("partners",      "partner", [...(idsByType.get("partner") ?? [])], "name"),
    fetchLabels("service_types", "service_type", [...(idsByType.get("service_type") ?? [])], "name"),
  ]);
  // case_update rows point at the update, not the parent case. Resolve them
  // in one extra query so the log links straight to the case.
  const caseUpdateIds = [...(idsByType.get("case_update") ?? [])];
  if (caseUpdateIds.length > 0) {
    const { data: us } = await supabase
      .from("case_updates")
      .select("id, case:cases!inner(id, code, title)")
      .in("id", caseUpdateIds);
    for (const u of (us as unknown as Array<{ id: string; case: { id: string; code: string; title: string | null } | { id: string; code: string; title: string | null }[] | null }> | null) ?? []) {
      const cse = Array.isArray(u.case) ? u.case[0] ?? null : u.case;
      if (cse) labels.set(key("case_update", u.id), { code: cse.code, name: cse.title });
    }
  }
  // Deleted-record trigger writes summary + metadata but the row is gone, so
  // fetching by id returns nothing. Fall back to the metadata payload the
  // trigger captured at delete time (the DELETE branch stores to_jsonb(old)).
  for (const r of rows) {
    if (!r.entity_id) continue;
    if (labels.has(key(r.entity_type, r.entity_id))) continue;
    const meta = r.metadata as { code?: string; name?: string; full_name?: string; title?: string } | null;
    if (meta && meta.code) {
      labels.set(key(r.entity_type, r.entity_id), {
        code: meta.code,
        name: meta.full_name ?? meta.name ?? meta.title ?? null,
      });
    }
  }

  function hrefWith(patch: Partial<SearchParams>): string {
    const params = new URLSearchParams();
    const merged = { entity: entityFilter || undefined, actor: actorFilter || undefined, page: pageIndex ? String(pageIndex) : undefined, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, String(v));
    const s = params.toString();
    return s ? `/admin/activity?${s}` : "/admin/activity";
  }

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-[26px] text-ink">Activity log</h1>
        <p className="text-[var(--muted)] mt-1 max-w-2xl">
          Every write to a client, company, case, partner, user, or service is recorded
          here — who did it, when, and (for updates) what changed. Read-only.
        </p>
      </div>

      {error && (
        <div className="mb-4 text-[13px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error.message}
        </div>
      )}

      <form className="flex flex-wrap items-end gap-3 mb-5" action="/admin/activity">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wider text-[var(--muted)] font-semibold">Entity</span>
          <select name="entity" defaultValue={entityFilter}
            className="px-2.5 py-1.5 border border-[var(--border)] rounded-md text-sm bg-[var(--surface)]">
            {ENTITY_FILTERS.map((e) => <option key={e.code} value={e.code}>{e.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wider text-[var(--muted)] font-semibold">Actor</span>
          <select name="actor" defaultValue={actorFilter}
            className="px-2.5 py-1.5 border border-[var(--border)] rounded-md text-sm bg-[var(--surface)] min-w-[220px]">
            <option value="">Anyone</option>
            {actors.map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
          </select>
        </label>
        <button type="submit"
          className="px-4 py-1.5 bg-brand text-white rounded-md text-sm font-medium hover:bg-brand-dark">
          Apply
        </button>
        {(entityFilter || actorFilter) && (
          <Link href="/admin/activity" className="text-[12.5px] text-[var(--muted)] hover:text-ink px-2 py-1.5">
            Clear
          </Link>
        )}
        <span className="ml-auto text-[12px] text-[var(--muted)] pb-1.5">
          {count ?? 0} event{count === 1 ? "" : "s"}
        </span>
      </form>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--muted)] bg-[var(--bg)] border-b border-[var(--border)]">
              <th className="px-4 py-2.5 font-semibold w-[150px]">When</th>
              <th className="px-4 py-2.5 font-semibold w-[180px]">Who</th>
              <th className="px-4 py-2.5 font-semibold w-[130px]">Action</th>
              <th className="px-4 py-2.5 font-semibold w-[220px]">Entity</th>
              <th className="px-4 py-2.5 font-semibold">Summary / changes</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-[13px] text-[var(--muted)]">
                  No activity matches these filters.
                </td>
              </tr>
            ) : rows.map((r) => {
              const actor = unwrapActor(r.actor);
              const tone = ACTION_TONE[r.action] ?? "bg-neutral-100 text-neutral-800";
              return (
                <tr key={r.id} className="border-b border-[var(--border)] last:border-0 align-top">
                  <td className="px-4 py-2.5 text-[12px] text-[var(--muted)] font-mono whitespace-nowrap">
                    {fmtDateTime(r.created_at)}
                  </td>
                  <td className="px-4 py-2.5">
                    {actor ? (
                      <div className="min-w-0">
                        <div className="text-[13px] text-ink font-medium truncate">{actor.full_name}</div>
                        <div className="text-[11px] text-[var(--muted)] truncate">{actor.email}</div>
                      </div>
                    ) : <span className="text-[12px] text-[var(--muted)] italic">system</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block text-[10.5px] font-semibold px-1.5 py-0.5 rounded ${tone}`}>
                      {r.action}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[12.5px] text-ink">
                    <EntityLink
                      type={r.entity_type}
                      id={r.entity_id}
                      label={r.entity_id ? labels.get(`${r.entity_type}:${r.entity_id}`) ?? null : null}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-[12.5px] text-ink">
                    <div>{r.summary ?? "—"}</div>
                    <FieldDiff metadata={r.metadata} entityType={r.entity_type} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-[12.5px]">
          <div className="text-[var(--muted)]">Page {pageIndex + 1} of {totalPages}</div>
          <div className="flex gap-2">
            {pageIndex > 0 && (
              <Link href={hrefWith({ page: pageIndex === 1 ? undefined : String(pageIndex - 1) })}
                className="px-3 py-1.5 border border-[var(--border)] rounded-md hover:bg-[var(--surface)]">
                ← Newer
              </Link>
            )}
            {pageIndex + 1 < totalPages && (
              <Link href={hrefWith({ page: String(pageIndex + 1) })}
                className="px-3 py-1.5 border border-[var(--border)] rounded-md hover:bg-[var(--surface)]">
                Older →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* -------- helpers -------- */

function fmtDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return iso; }
}

/** Map entity_type → clickable app route where the record lives, showing
 *  the record's code (and short name where we have one) so an operator
 *  can tell at a glance which client / company / case a row is about.
 *  Deleted records have no page to land on — we render the label as
 *  plain text instead of a broken link. case_update rows resolve to the
 *  parent case so the link actually goes somewhere useful. */
function EntityLink({
  type, id, label,
}: {
  type: string;
  id: string | null;
  label: { code: string; name: string | null } | null;
}) {
  if (!id) return <span className="text-[var(--muted)] italic">{type}</span>;

  const parentCaseId = type === "case_update" ? id : null;
  const route: Record<string, string | undefined> = {
    client: `/clients/${id}`,
    company: `/companies/${id}`,
    case: `/cases/${id}`,
    partner: `/partners/${id}`,
    case_update: parentCaseId ? `/cases/${parentCaseId}` : undefined,
  };
  // case_update route uses the resolved parent case id, not the update id.
  // We only have that once labels are joined — until then it's non-clickable.

  const code = label?.code;
  const name = label?.name;
  const inner = (
    <>
      <span className="font-mono text-[11.5px]">{code ?? type}</span>
      {name && <div className="text-[11px] text-[var(--muted)] truncate max-w-[200px]">{name}</div>}
    </>
  );

  const href = route[type];
  if (!href || !code) {
    return <div className={code ? "text-ink" : "text-[var(--muted)]"}>{inner}</div>;
  }
  return <Link href={href} className="block text-brand hover:underline">{inner}</Link>;
}

/** Ignored fields carry no editorial signal — updated_at flips on every
 *  write, and *_at columns are set by triggers, not by the user. */
const DIFF_IGNORE = new Set(["updated_at", "created_at", "updated_by", "deleted_at"]);

function FieldDiff({ metadata, entityType }: { metadata: Record<string, unknown> | null; entityType: string }) {
  if (!metadata) return null;
  // The trigger stores updates as { before: {...}, after: {...} }.
  const before = metadata.before as Record<string, unknown> | undefined;
  const after  = metadata.after  as Record<string, unknown> | undefined;
  if (!before || !after) return null;

  const changed: Array<{ key: string; from: unknown; to: unknown }> = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) {
    if (DIFF_IGNORE.has(k)) continue;
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) {
      changed.push({ key: k, from: before[k], to: after[k] });
    }
  }
  if (changed.length === 0) return null;

  return (
    <ul className="mt-1 space-y-0.5">
      {changed.map((c) => (
        <li key={c.key} className="text-[11.5px] text-[var(--muted)]">
          <span className="font-mono text-ink">{c.key}</span>:{" "}
          <span className="line-through opacity-70">{fmtVal(c.from)}</span>
          {" → "}
          <span className="text-ink">{fmtVal(c.to)}</span>
        </li>
      ))}
      {entityType /* eslint-disable-line @typescript-eslint/no-unused-expressions */ && null}
    </ul>
  );
}

function fmtVal(v: unknown): string {
  if (v == null || v === "") return "∅";
  if (typeof v === "string") return v.length > 60 ? v.slice(0, 60) + "…" : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  const s = JSON.stringify(v);
  return s.length > 60 ? s.slice(0, 60) + "…" : s;
}
