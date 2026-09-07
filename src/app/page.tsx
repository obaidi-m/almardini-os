import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopBanner } from "@/components/admin/TopBanner";
import { OpsSidebar } from "@/components/app/OpsSidebar";
import { getT } from "@/lib/i18n/server";
import type { CaseStatus, CasePriority } from "@/lib/types";
import type { MessageKey } from "@/lib/i18n/messages";
import { effectiveExpiryDate, renewalTier } from "@/lib/renewal";
import { ExpiryPill } from "@/components/app/ExpiryPill";
import { serviceLabel } from "@/lib/service";

const STATUS_COLORS: Record<CaseStatus, string> = {
  new: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-blue-100 text-blue-800",
  done: "bg-green-100 text-green-800",
  delivered: "bg-neutral-200 text-neutral-700",
};

const PRIORITY_COLORS: Record<CasePriority, string> = {
  low: "text-[var(--muted)]",
  normal: "text-ink",
  high: "text-orange-700",
  urgent: "text-red-700 font-semibold",
};

const OPEN_STATUSES: CaseStatus[] = ["new", "in_progress", "done"];

type CaseCard = {
  id: string;
  code: string;
  title: string | null;
  status: CaseStatus;
  priority: CasePriority;
  deadline: string | null;
  client: { id: string; full_name: string } | null;
  service: { id: string; code: string; name: string } | null;
};

type Renewal = { kind: "case_expiry" | "vo_expiry"; label: string; expires_at: string; href: string };

type AttentionRow = {
  id: string;
  code: string;
  title: string;
  href: string;
  meta: string;
};

export default async function DashboardPage() {
  const supabase = createClient();
  const { t } = await getT();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("users")
    .select("full_name, email, role:roles(code, name)")
    .eq("id", user.id)
    .single();
  const roleCode = (me?.role as { code?: string } | null)?.code;
  const isOwnerLike = roleCode === "owner" || roleCode === "ops_lead";

  // Windows
  const today = new Date();
  const in90 = new Date(); in90.setDate(in90.getDate() + 90);
  const todayIso = today.toISOString().slice(0, 10);
  const in90Iso = in90.toISOString().slice(0, 10);

  const [
    myCasesRes,
    readyToDeliverRes,
    countsRes,
    recentCasesRes,
    expiringSubsRes,
    attentionCasesRes,
    latestUpdatesRes,
  ] = await Promise.all([
    supabase
      .from("cases")
      .select(`
        id, code, title, status, priority, deadline,
        client:clients(id, full_name),
        service:service_types(id, code, name)
      `)
      .eq("assigned_to", user.id)
      .is("deleted_at", null)
      .in("status", OPEN_STATUSES)
      .order("priority", { ascending: false })
      .order("deadline", { ascending: true, nullsFirst: false })
      .limit(50),
    isOwnerLike
      ? supabase
          .from("cases")
          .select(`
            id, code, title, status, priority, deadline,
            client:clients(id, full_name),
            service:service_types(id, code, name)
          `)
          .eq("status", "done")
          .is("deleted_at", null)
          .order("updated_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] as unknown[], error: null }),
    // status counts across all visible cases
    supabase
      .from("cases")
      .select("status")
      .is("deleted_at", null)
      .in("status", OPEN_STATUSES)
      .limit(2000),
    supabase
      .from("cases")
      .select(`
        id, code, title, status, priority, deadline, updated_at,
        client:clients(id, full_name),
        service:service_types(id, code, name)
      `)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(8),
    // "Renewals" side panel: read active subscriptions in the next 90 days,
    // then apply the per-service lead rule client-side. Sourced from the
    // unified entity_services table so closed cases and duplicated VO rows
    // don't inflate the count.
    supabase
      .from("entity_services")
      .select(`
        id, expires_date,
        client:clients(id, full_name),
        company:companies!entity_services_company_id_fkey(id, name),
        service:service_types(id, code, name, schedule_kind, annual_month, annual_day, quarterly_day, quarterly_months, validity_amount, validity_unit)
      `)
      .is("deleted_at", null)
      .eq("status", "active")
      .order("expires_date", { ascending: true, nullsFirst: false })
      .limit(500),
    // For the attention panel: all active cases (owner-like only)
    isOwnerLike
      ? supabase
          .from("cases")
          .select("id, code, title, status, deadline, expires_at, created_at, client:clients(id, full_name), service:service_types(id, code, name, schedule_kind, annual_month, annual_day, quarterly_day, quarterly_months, validity_amount, validity_unit)")
          .is("deleted_at", null)
          .in("status", OPEN_STATUSES)
          .limit(500)
      : Promise.resolve({ data: [] as unknown[], error: null }),
    // Latest update per case for stuck computation
    isOwnerLike
      ? supabase
          .from("case_updates")
          .select("case_id, created_at")
          .order("created_at", { ascending: false })
          .limit(2000)
      : Promise.resolve({ data: [] as unknown[], error: null }),
  ]);

  const unwrap = <T,>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? v[0] ?? null : v ?? null;

  const normalize = (rows: unknown[] | null): CaseCard[] =>
    (rows ?? []).map((r) => {
      const rr = r as {
        id: string; code: string; title: string | null; status: CaseStatus; priority: CasePriority; deadline: string | null;
        client: { id: string; full_name: string }[] | { id: string; full_name: string } | null;
        service: { id: string; code: string; name: string }[] | { id: string; code: string; name: string } | null;
      };
      return { ...rr, client: unwrap(rr.client), service: unwrap(rr.service) };
    });

  const myCases = normalize(myCasesRes.data as unknown[] | null);
  const readyToDeliver = normalize(readyToDeliverRes.data as unknown[] | null);
  const recentCases = normalize(recentCasesRes.data as unknown[] | null);

  const counts: Record<CaseStatus, number> = { new: 0, in_progress: 0, done: 0, delivered: 0 };
  for (const r of (countsRes.data ?? []) as { status: CaseStatus }[]) counts[r.status] = (counts[r.status] ?? 0) + 1;

  // Renewals side panel: every active subscription expiring in the next
  // 90 days, sorted by soonest. No per-service tier filter — the pill
  // colors already grade urgency for the eye.
  type ExpSvc = { id: string; code: string; name: string; schedule_kind: "one_off" | "annual_fixed" | "quarterly_fixed" | null; annual_month: number | null; annual_day: number | null; quarterly_day: number | null; quarterly_months: number[] | null; validity_amount: number | null; validity_unit: string | null };
  const renewals: Renewal[] = ((expiringSubsRes.data ?? []) as Array<{
    id: string; expires_date: string | null;
    client:  { id: string; full_name: string }[] | { id: string; full_name: string } | null;
    company: { id: string; name: string }[]      | { id: string; name: string }      | null;
    service: ExpSvc[] | ExpSvc | null;
  }>).flatMap((r) => {
    const cli = unwrap(r.client);
    const cmp = unwrap(r.company);
    const svc = unwrap(r.service);
    // Ongoing subs have no expires_date; fall back to the service's next
    // scheduled occurrence so annual/quarterly subscriptions surface ahead
    // of their next cycle without needing a case per company per cycle.
    const effective = effectiveExpiryDate(r.expires_date, svc);
    if (!effective || effective > in90Iso) return [];
    const owner = cli?.full_name ?? cmp?.name ?? "?";
    const label = `${owner} — ${svc?.name ?? "Subscription"}`;
    const href  = cli ? `/clients/${cli.id}` : cmp ? `/companies/${cmp.id}` : "/renewals";
    return [{
      kind: cli ? ("case_expiry" as const) : ("vo_expiry" as const),
      label,
      expires_at: effective,
      href,
    }];
  });

  renewals.sort((a, b) => a.expires_at.localeCompare(b.expires_at));

  // Compute attention buckets for Admin + Owner
  type AttentionCase = {
    id: string; code: string; title: string | null; status: CaseStatus;
    deadline: string | null; expires_at: string | null; created_at: string;
    client: { id: string; full_name: string } | { id: string; full_name: string }[] | null;
    service: { id: string; code: string; name: string; schedule_kind: "one_off" | "annual_fixed" | "quarterly_fixed" | null; annual_month: number | null; annual_day: number | null; quarterly_day: number | null; quarterly_months: number[] | null; validity_amount: number | null; validity_unit: string | null } | { id: string; code: string; name: string; schedule_kind: "one_off" | "annual_fixed" | "quarterly_fixed" | null; annual_month: number | null; annual_day: number | null; quarterly_day: number | null; quarterly_months: number[] | null; validity_amount: number | null; validity_unit: string | null }[] | null;
  };
  const activeCases = ((attentionCasesRes.data ?? []) as AttentionCase[]).map((c) => ({
    ...c,
    client: unwrap(c.client),
    service: unwrap(c.service),
  }));

  const lastActivity = new Map<string, string>();
  for (const u of (latestUpdatesRes.data ?? []) as { case_id: string; created_at: string }[]) {
    if (!lastActivity.has(u.case_id)) lastActivity.set(u.case_id, u.created_at);
  }

  const daysBetween = (fromIso: string): number => {
    const diff = today.getTime() - new Date(fromIso).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };
  const stuckDays = (c: typeof activeCases[number]): number => {
    const last = lastActivity.get(c.id) ?? c.created_at;
    return daysBetween(last);
  };

  const overdueCases = activeCases
    .filter((c) => c.deadline && c.deadline < todayIso && c.status !== "done")
    .sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? ""));

  const readyCases = activeCases
    .filter((c) => c.status === "done")
    .sort((a, b) => stuckDays(b) - stuckDays(a));

  // Owner "renewals due" bucket: an active case is due when its expiry
  // falls inside its own service's lead-time window (90/30/10 by cadence).
  // Overdue cases are covered by the Overdue bucket above; this one is
  // "action needed soon", not "action needed yesterday".
  const recurringDue = activeCases
    .filter((c) => renewalTier(c.expires_at, c.service) === "due_soon")
    .sort((a, b) => (a.expires_at ?? "").localeCompare(b.expires_at ?? ""));

  const stuck7 = activeCases.filter((c) => stuckDays(c) > 7).sort((a, b) => stuckDays(b) - stuckDays(a));
  const stuck3 = activeCases.filter((c) => { const d = stuckDays(c); return d > 3 && d <= 7; }).sort((a, b) => stuckDays(b) - stuckDays(a));
  const stuck1 = activeCases.filter((c) => { const d = stuckDays(c); return d >= 1 && d <= 3; }).sort((a, b) => stuckDays(b) - stuckDays(a));

  const toRowOverdue = (c: typeof activeCases[number]): AttentionRow => ({
    id: c.id, code: c.code,
    title: `${c.title || serviceLabel(c.service) || "Case"}${c.client ? ` · ${c.client.full_name}` : ""}`,
    href: `/cases/${c.id}`,
    meta: t("attention.was_due", { d: c.deadline ? t("attention.days", { n: -daysBetween(c.deadline) }) : "—" }),
  });
  const toRowReady = (c: typeof activeCases[number]): AttentionRow => ({
    id: c.id, code: c.code,
    title: `${c.title || serviceLabel(c.service) || "Case"}${c.client ? ` · ${c.client.full_name}` : ""}`,
    href: `/cases/${c.id}`,
    meta: t("attention.days", { n: stuckDays(c) }),
  });
  const toRowRecurring = (c: typeof activeCases[number]): AttentionRow => ({
    id: c.id, code: c.code,
    title: `${c.title || serviceLabel(c.service) || "Case"}${c.client ? ` · ${c.client.full_name}` : ""}`,
    href: `/cases/${c.id}`,
    meta: c.expires_at ? fmtShortDate(c.expires_at) : "—",
  });
  const toRowStuck = (c: typeof activeCases[number]): AttentionRow => ({
    id: c.id, code: c.code,
    title: `${c.title || serviceLabel(c.service) || "Case"}${c.client ? ` · ${c.client.full_name}` : ""} · ${t(`status.${c.status}` as MessageKey)}`,
    href: `/cases/${c.id}`,
    meta: t("attention.no_update", { d: t("attention.days", { n: stuckDays(c) }) }),
  });

  const attention = {
    overdue: overdueCases.map(toRowOverdue),
    ready: readyCases.map(toRowReady),
    recurring: recurringDue.map(toRowRecurring),
    stuck7: stuck7.map(toRowStuck),
    stuck3: stuck3.map(toRowStuck),
    stuck1: stuck1.map(toRowStuck),
  };
  const attentionEmpty = attention.overdue.length + attention.ready.length + attention.recurring.length + attention.stuck7.length + attention.stuck3.length + attention.stuck1.length === 0;

  const firstName = (me?.full_name || "there").split(" ")[0];

  return (
    <div>
      <TopBanner />
      <div className="grid grid-cols-[240px_1fr]">
        <OpsSidebar
          userName={me?.full_name || user.email || "User"}
          userEmail={me?.email || user.email || ""}
          isOwner={roleCode === "owner"}
        />
        <main className="p-8 max-w-[1400px] w-full">
          <div className="mb-6">
            <h1 className="text-[26px] font-semibold text-ink tracking-tight">{t("page.dashboard.greeting", { name: firstName })}</h1>
            <p className="text-[13px] text-[var(--muted)]">{t("page.dashboard.subtitle")}</p>
          </div>


          {/* Status counts */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {OPEN_STATUSES.map((s) => (
              <Link
                key={s}
                href={`/cases?status=${s}`}
                className="border border-[var(--border)] rounded-lg p-4 bg-white hover:border-brand transition-colors"
              >
                <div className="text-[11px] uppercase tracking-wide text-[var(--muted)] font-semibold">{t(`status.${s}`)}</div>
                <div className="text-[28px] font-semibold text-ink mt-1 leading-none">{counts[s]}</div>
              </Link>
            ))}
          </div>

          {isOwnerLike ? (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8">
              <div>
                <AttentionPanel attention={attention} empty={attentionEmpty} t={t} />
              </div>
              <div>
                <Panel title={t("section.quick_actions")}>
                  <div className="grid grid-cols-2 gap-2">
                    <QuickAction href="/clients/new" label={t("action.new_client")} />
                    <QuickAction href="/cases/new" label={t("action.new_case")} />
                    <QuickAction href="/companies/new" label={t("action.new_company")} />
                    <QuickAction href="/partners/new" label={t("action.new_partner")} />
                  </div>
                </Panel>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-8">
              {/* Left column */}
              <div className="space-y-8">
                <Panel
                  title={`${t("section.my_cases")} (${myCases.length})`}
                  action={<Link href="/cases?mine=1" className="text-[12px] text-brand hover:underline">{t("action.open")}</Link>}
                >
                  {myCases.length === 0 ? (
                    <Empty>{t("dash.nothing_assigned")}</Empty>
                  ) : (
                    <CasesGrouped cases={myCases} t={t} />
                  )}
                </Panel>

                <Panel
                  title={t("section.recent_activity")}
                  action={<Link href="/cases" className="text-[12px] text-brand hover:underline">{t("nav.cases")}</Link>}
                >
                  {recentCases.length === 0 ? <Empty>{t("dash.no_cases_yet")}</Empty> : <CasesFlat cases={recentCases} showStatus t={t} />}
                </Panel>
              </div>

              {/* Right column */}
              <div className="space-y-8">
                <Panel
                  title={t("dash.renewals_90", { n: renewals.length })}
                >
                  {renewals.length === 0 ? (
                    <Empty>{t("dash.no_expiring")}</Empty>
                  ) : (
                    <ul className="divide-y divide-[var(--border)]">
                      {renewals.map((r, i) => (
                        <li key={i} className="py-2 flex items-center gap-3">
                          <RenewalBadge kind={r.kind} t={t} />
                          <Link href={r.href} className="flex-1 min-w-0 text-[13px] text-ink hover:text-brand truncate">
                            {r.label}
                          </Link>
                          <span className="text-[12px] text-[var(--muted)] shrink-0">{fmtDate(r.expires_at)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>

                <Panel title={t("section.quick_actions")}>
                  <div className="grid grid-cols-2 gap-2">
                    <QuickAction href="/clients/new" label={t("action.new_client")} />
                    <QuickAction href="/cases/new" label={t("action.new_case")} />
                    <QuickAction href="/companies/new" label={t("action.new_company")} />
                    <QuickAction href="/partners/new" label={t("action.new_partner")} />
                  </div>
                </Panel>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function RenewalsPanel({ renewals }: { renewals: Renewal[] }) {
  const shown = renewals.slice(0, 8);
  const extra = renewals.length - shown.length;
  return (
    <section className="bg-white border border-[var(--border)] rounded-lg overflow-hidden">
      <div className="px-4 pt-3 pb-2 flex items-baseline justify-between">
        <h3 className="text-[13px] font-semibold text-ink">Renewals · next 90 days</h3>
        <span className="text-[11px] text-[var(--muted)] tabular-nums">{renewals.length}</span>
      </div>
      {renewals.length === 0 ? (
        <div className="px-4 pb-4 text-[12px] text-[var(--muted)]">Nothing expiring in the next 90 days.</div>
      ) : (
        <>
          <ul className="divide-y divide-[var(--border)]">
            {shown.map((r) => (
              <li key={r.href + r.expires_at + r.label} className="px-4 py-2">
                <Link href={r.href} className="grid grid-cols-[1fr_auto] gap-2 items-center group">
                  <span className="text-[12.5px] text-ink truncate group-hover:text-brand-dark">
                    {r.label}
                  </span>
                  <ExpiryPill expires={r.expires_at} />
                </Link>
              </li>
            ))}
          </ul>
          {extra > 0 && (
            <Link
              href="/renewals"
              className="block px-4 py-2 text-[11.5px] text-[var(--muted)] hover:text-ink border-t border-[var(--border)]"
            >
              View all {renewals.length} →
            </Link>
          )}
        </>
      )}
    </section>
  );
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[11px] uppercase tracking-widest text-[var(--muted)] font-semibold">{title}</h2>
        {action}
      </div>
      <div className="border border-[var(--border)] rounded-lg bg-white p-4">
        {children}
      </div>
    </section>
  );
}

type Tr = (k: MessageKey, vars?: Record<string, string | number>) => string;

function CasesGrouped({ cases, t }: { cases: CaseCard[]; t: Tr }) {
  const groups: Record<CaseStatus, CaseCard[]> = { new: [], in_progress: [], done: [], delivered: [] };
  for (const c of cases) groups[c.status].push(c);
  return (
    <div className="space-y-4">
      {OPEN_STATUSES.map((s) =>
        groups[s].length === 0 ? null : (
          <div key={s}>
            <div className="text-[11px] uppercase font-medium text-[var(--muted)] mb-1.5">{t(`status.${s}` as MessageKey)} ({groups[s].length})</div>
            <ul className="divide-y divide-[var(--border)]">
              {groups[s].map((c) => <CaseRow key={c.id} c={c} showStatus={false} t={t} />)}
            </ul>
          </div>
        ),
      )}
    </div>
  );
}

function CasesFlat({ cases, showStatus, t }: { cases: CaseCard[]; showStatus: boolean; t: Tr }) {
  return (
    <ul className="divide-y divide-[var(--border)]">
      {cases.map((c) => <CaseRow key={c.id} c={c} showStatus={showStatus} t={t} />)}
    </ul>
  );
}

function CaseRow({ c, showStatus, t }: { c: CaseCard; showStatus: boolean; t: Tr }) {
  return (
    <li>
      <Link href={`/cases/${c.id}`} className="py-2 grid grid-cols-[80px_1fr_auto] gap-3 items-center hover:text-brand">
        <span className="font-mono text-[12px] text-[var(--muted)]">{c.code}</span>
        <span className="min-w-0">
          <span className="text-[13.5px] text-ink font-medium truncate block">
            {c.client?.full_name ?? t("common.deleted_client")}
          </span>
          <span className="text-[11.5px] text-[var(--muted)] truncate block">
            {c.title || serviceLabel(c.service) || "—"}
          </span>
        </span>
        <span className="flex items-center gap-2 shrink-0">
          <span className={`text-[11px] ${PRIORITY_COLORS[c.priority]}`}>{t(`priority.${c.priority}` as MessageKey)}</span>
          {c.deadline && <span className="text-[11px] text-[var(--muted)]">· {fmtDate(c.deadline)}</span>}
          {showStatus && (
            <span className={`text-[10.5px] font-medium px-1.5 py-0.5 rounded ${STATUS_COLORS[c.status]}`}>
              {t(`status.${c.status}` as MessageKey)}
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}

function RenewalBadge({ kind, t }: { kind: Renewal["kind"]; t: Tr }) {
  const isVO = kind === "vo_expiry";
  const label = isVO ? "office" : t("renewal.badge.case");
  const color = isVO ? "bg-sky-100 text-sky-800" : "bg-orange-100 text-orange-800";
  return (
    <span className={`text-[10.5px] font-medium px-1.5 py-0.5 rounded shrink-0 w-[64px] text-center ${color}`}>
      {label}
    </span>
  );
}

function AttentionPanel({
  attention, empty, t,
}: {
  attention: {
    overdue: AttentionRow[];
    ready: AttentionRow[];
    recurring: AttentionRow[];
    stuck7: AttentionRow[];
    stuck3: AttentionRow[];
    stuck1: AttentionRow[];
  };
  empty: boolean;
  t: Tr;
}) {
  return (
    <section className="mb-8">
      <div className="text-[11px] uppercase tracking-widest text-[var(--muted)] font-semibold mb-3">
        {t("attention.title")}
      </div>
      <div className="bg-white border border-[var(--border)] rounded-lg divide-y divide-[var(--border)]">
        {empty && (
          <div className="p-6 text-center text-[13px] text-[var(--muted)]">
            {t("attention.all_clear")}
          </div>
        )}

        <AttentionSection
          title={t("attention.overdue", { n: attention.overdue.length })}
          rows={attention.overdue}
          tone="red"
          hideIfEmpty
        />
        <AttentionSection
          title={t("attention.ready", { n: attention.ready.length })}
          rows={attention.ready}
          tone="green"
          hideIfEmpty
        />
        <AttentionSection
          title={t("attention.recurring", { n: attention.recurring.length })}
          rows={attention.recurring}
          tone="orange"
          hideIfEmpty
        />
        <AttentionSection
          title={t("attention.stuck_7", { n: attention.stuck7.length })}
          rows={attention.stuck7}
          tone="red"
          hideIfEmpty
        />
        <AttentionSection
          title={t("attention.stuck_3", { n: attention.stuck3.length })}
          rows={attention.stuck3}
          tone="amber"
          hideIfEmpty
        />
        {attention.stuck1.length > 0 && (
          <details className="group" open data-persist>
            <summary className="p-3 cursor-pointer list-none flex items-center gap-2 text-[12.5px] font-semibold text-[#8A6919] hover:bg-[var(--surface-muted)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E8B14A]" />
              {t("attention.stuck_show", { n: attention.stuck1.length })}
              <span className="ml-auto text-[11px] text-[var(--muted)] group-open:hidden">▸</span>
              <span className="ml-auto text-[11px] text-[var(--muted)] hidden group-open:inline">▾</span>
            </summary>
            <ul className="divide-y divide-[var(--border)]">
              {attention.stuck1.map((r) => <AttentionRowLine key={r.id} row={r} />)}
            </ul>
          </details>
        )}
      </div>
    </section>
  );
}

function AttentionSection({
  title, rows, tone, hideIfEmpty,
}: {
  title: string;
  rows: AttentionRow[];
  tone: "red" | "green" | "orange" | "amber";
  hideIfEmpty?: boolean;
}) {
  if (hideIfEmpty && rows.length === 0) return null;

  const dotColor = tone === "red" ? "bg-red-500"
    : tone === "green" ? "bg-green-500"
    : tone === "orange" ? "bg-orange-500"
    : "bg-[#E8B14A]";
  const textColor = tone === "red" ? "text-red-700"
    : tone === "green" ? "text-green-800"
    : tone === "orange" ? "text-orange-800"
    : "text-[#8A6919]";

  return (
    <div>
      <div className={`px-4 py-2.5 flex items-center gap-2 text-[12.5px] font-semibold ${textColor} bg-[var(--surface-muted)]`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
        {title}
      </div>
      <ul className="divide-y divide-[var(--border)]">
        {rows.map((r) => <AttentionRowLine key={r.id} row={r} />)}
      </ul>
    </div>
  );
}

function AttentionRowLine({ row }: { row: AttentionRow }) {
  return (
    <li>
      <Link
        href={row.href}
        className="grid grid-cols-[80px_1fr_auto] gap-3 items-center px-4 py-2 text-[13px] hover:bg-white/50 transition-colors group"
      >
        <span className="font-mono text-[11px] text-brand-dark bg-brand-softer px-1.5 py-0.5 rounded justify-self-start">{row.code}</span>
        <span className="text-ink truncate group-hover:text-brand-dark">{row.title}</span>
        <span className="text-[11.5px] text-[var(--muted)] shrink-0">{row.meta}</span>
      </Link>
    </li>
  );
}

function fmtShortDate(v: string): string {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return v;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${Number(m[3])} ${months[Number(m[2]) - 1]}`;
}

function QuickAction({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="px-3 py-2 border border-[var(--border)] rounded-md text-[13px] text-ink hover:border-brand hover:text-brand text-center"
    >
      {label}
    </Link>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[12.5px] text-[var(--muted)] py-2">{children}</p>;
}

function fmtDate(v: string | null | undefined): string {
  if (!v) return "—";
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}
