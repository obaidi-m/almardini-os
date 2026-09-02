import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopBanner } from "@/components/admin/TopBanner";
import { OpsSidebar } from "@/components/app/OpsSidebar";
import { getT } from "@/lib/i18n/server";
import { CASE_STATUS_LABELS, CASE_PRIORITY_LABELS } from "@/lib/types";
import type { CaseStatus, CasePriority } from "@/lib/types";

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
  service: { id: string; name: string } | null;
};

type Renewal = { kind: "passport" | "case_expiry"; label: string; expires_at: string; href: string };

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

  // Windows for renewals
  const today = new Date();
  const in90 = new Date(); in90.setDate(in90.getDate() + 90);
  const todayIso = today.toISOString().slice(0, 10);
  const in90Iso = in90.toISOString().slice(0, 10);

  const [
    myCasesRes,
    readyToDeliverRes,
    countsRes,
    recentCasesRes,
    expiringPassportsRes,
    expiringCasesRes,
  ] = await Promise.all([
    supabase
      .from("cases")
      .select(`
        id, code, title, status, priority, deadline,
        client:clients(id, full_name),
        service:service_types(id, name)
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
            service:service_types(id, name)
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
        service:service_types(id, name)
      `)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(8),
    supabase
      .from("clients")
      .select("id, full_name, passport_expires_at")
      .is("deleted_at", null)
      .not("passport_expires_at", "is", null)
      .gte("passport_expires_at", todayIso)
      .lte("passport_expires_at", in90Iso)
      .order("passport_expires_at", { ascending: true })
      .limit(20),
    supabase
      .from("cases")
      .select("id, code, title, expires_at, client:clients(id, full_name)")
      .is("deleted_at", null)
      .not("expires_at", "is", null)
      .gte("expires_at", todayIso)
      .lte("expires_at", in90Iso)
      .order("expires_at", { ascending: true })
      .limit(20),
  ]);

  const unwrap = <T,>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? v[0] ?? null : v ?? null;

  const normalize = (rows: unknown[] | null): CaseCard[] =>
    (rows ?? []).map((r) => {
      const rr = r as {
        id: string; code: string; title: string | null; status: CaseStatus; priority: CasePriority; deadline: string | null;
        client: { id: string; full_name: string }[] | { id: string; full_name: string } | null;
        service: { id: string; name: string }[] | { id: string; name: string } | null;
      };
      return { ...rr, client: unwrap(rr.client), service: unwrap(rr.service) };
    });

  const myCases = normalize(myCasesRes.data as unknown[] | null);
  const readyToDeliver = normalize(readyToDeliverRes.data as unknown[] | null);
  const recentCases = normalize(recentCasesRes.data as unknown[] | null);

  const counts: Record<CaseStatus, number> = { new: 0, in_progress: 0, done: 0, delivered: 0 };
  for (const r of (countsRes.data ?? []) as { status: CaseStatus }[]) counts[r.status] = (counts[r.status] ?? 0) + 1;

  const renewals: Renewal[] = [
    ...((expiringPassportsRes.data ?? []) as { id: string; full_name: string; passport_expires_at: string }[]).map((r) => ({
      kind: "passport" as const,
      label: `${r.full_name} — passport`,
      expires_at: r.passport_expires_at,
      href: `/clients/${r.id}`,
    })),
    ...((expiringCasesRes.data ?? []) as { id: string; code: string; title: string | null; expires_at: string; client: { full_name: string }[] | { full_name: string } | null }[]).map((r) => {
      const cli = unwrap(r.client);
      return {
        kind: "case_expiry" as const,
        label: `${r.code} — ${r.title || cli?.full_name || "case"}`,
        expires_at: r.expires_at,
        href: `/cases/${r.id}`,
      };
    }),
  ].sort((a, b) => a.expires_at.localeCompare(b.expires_at));

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
                <div className="text-[11px] uppercase tracking-wide text-[var(--muted)] font-semibold">{CASE_STATUS_LABELS[s]}</div>
                <div className="text-[28px] font-semibold text-ink mt-1 leading-none">{counts[s]}</div>
              </Link>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-8">
            {/* Left column */}
            <div className="space-y-8">
              <Panel
                title={`${t("section.my_cases")} (${myCases.length})`}
                action={<Link href="/cases?mine=1" className="text-[12px] text-brand hover:underline">{t("action.open")}</Link>}
              >
                {myCases.length === 0 ? (
                  <Empty>Nothing assigned to you. Enjoy the calm.</Empty>
                ) : (
                  <CasesGrouped cases={myCases} />
                )}
              </Panel>

              {isOwnerLike && (
                <Panel
                  title={`${t("section.ready_to_deliver")} (${readyToDeliver.length})`}
                  action={<Link href="/cases?status=done" className="text-[12px] text-brand hover:underline">{t("action.open")}</Link>}
                >
                  {readyToDeliver.length === 0 ? (
                    <Empty>Nothing waiting to go out.</Empty>
                  ) : (
                    <CasesFlat cases={readyToDeliver} showStatus={false} />
                  )}
                </Panel>
              )}

              <Panel
                title={t("section.recent_activity")}
                action={<Link href="/cases" className="text-[12px] text-brand hover:underline">{t("nav.cases")}</Link>}
              >
                {recentCases.length === 0 ? <Empty>No cases yet.</Empty> : <CasesFlat cases={recentCases} showStatus />}
              </Panel>
            </div>

            {/* Right column */}
            <div className="space-y-8">
              <Panel
                title={`Renewals in the next 90 days (${renewals.length})`}
              >
                {renewals.length === 0 ? (
                  <Empty>Nothing expiring soon.</Empty>
                ) : (
                  <ul className="divide-y divide-[var(--border)]">
                    {renewals.map((r, i) => (
                      <li key={i} className="py-2 flex items-center gap-3">
                        <RenewalBadge kind={r.kind} />
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
                  <QuickAction href="/clients/new" label="New client" />
                  <QuickAction href="/cases/new" label="New case" />
                  <QuickAction href="/companies/new" label="New company" />
                  <QuickAction href="/partners/new" label="New partner" />
                </div>
              </Panel>
            </div>
          </div>
        </main>
      </div>
    </div>
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

function CasesGrouped({ cases }: { cases: CaseCard[] }) {
  const groups: Record<CaseStatus, CaseCard[]> = { new: [], in_progress: [], done: [], delivered: [] };
  for (const c of cases) groups[c.status].push(c);
  return (
    <div className="space-y-4">
      {OPEN_STATUSES.map((s) =>
        groups[s].length === 0 ? null : (
          <div key={s}>
            <div className="text-[11px] uppercase font-medium text-[var(--muted)] mb-1.5">{CASE_STATUS_LABELS[s]} ({groups[s].length})</div>
            <ul className="divide-y divide-[var(--border)]">
              {groups[s].map((c) => <CaseRow key={c.id} c={c} showStatus={false} />)}
            </ul>
          </div>
        ),
      )}
    </div>
  );
}

function CasesFlat({ cases, showStatus }: { cases: CaseCard[]; showStatus: boolean }) {
  return (
    <ul className="divide-y divide-[var(--border)]">
      {cases.map((c) => <CaseRow key={c.id} c={c} showStatus={showStatus} />)}
    </ul>
  );
}

function CaseRow({ c, showStatus }: { c: CaseCard; showStatus: boolean }) {
  return (
    <li>
      <Link href={`/cases/${c.id}`} className="py-2 grid grid-cols-[80px_1fr_auto] gap-3 items-center hover:text-brand">
        <span className="font-mono text-[12px] text-[var(--muted)]">{c.code}</span>
        <span className="min-w-0">
          <span className="text-[13.5px] text-ink font-medium truncate block">
            {c.client?.full_name ?? "Deleted client"}
          </span>
          <span className="text-[11.5px] text-[var(--muted)] truncate block">
            {c.title || c.service?.name || "—"}
          </span>
        </span>
        <span className="flex items-center gap-2 shrink-0">
          <span className={`text-[11px] ${PRIORITY_COLORS[c.priority]}`}>{CASE_PRIORITY_LABELS[c.priority]}</span>
          {c.deadline && <span className="text-[11px] text-[var(--muted)]">· {fmtDate(c.deadline)}</span>}
          {showStatus && (
            <span className={`text-[10.5px] font-medium px-1.5 py-0.5 rounded ${STATUS_COLORS[c.status]}`}>
              {CASE_STATUS_LABELS[c.status]}
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}

function RenewalBadge({ kind }: { kind: Renewal["kind"] }) {
  const label = kind === "passport" ? "Passport" : "Case";
  const color =
    kind === "passport"
      ? "bg-blue-100 text-blue-800"
      : "bg-orange-100 text-orange-800";
  return (
    <span className={`text-[10.5px] font-medium px-1.5 py-0.5 rounded shrink-0 w-[64px] text-center ${color}`}>
      {label}
    </span>
  );
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
