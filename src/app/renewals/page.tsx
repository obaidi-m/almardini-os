import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { daysUntil, leadDaysForService, renewalTier } from "@/lib/renewal";

type Svc = {
  id: string;
  name: string;
  recurring_amount: number | null;
  recurring_unit: string | null;
  validity_amount: number | null;
  validity_unit: string | null;
} | null;

type Row = {
  id: string;
  code: string;
  title: string;
  subtitle: string;
  expires_at: string;
  href: string;
  service: Svc;
  daysLeft: number;
};

const CASE_STYLE = { bg: "bg-[#FFEDD5]", text: "text-[#9A3412]", dot: "bg-[#F97316]" };

export default async function RenewalsPage() {
  const supabase = createClient();
  const { t } = await getT();

  // Pull every non-deleted case that carries an expiry date. We used to cap
  // to a 180-day window; now we let the per-service lead-time rule decide
  // what's "due to renew". Anything beyond its own window falls into Later
  // and is collapsed by default so the page stays readable.
  const casesRes = await supabase
    .from("cases")
    .select("id, code, title, expires_at, client:clients(id, full_name), company:companies(id, name), service:service_types(id, name, recurring_amount, recurring_unit, validity_amount, validity_unit)")
    .is("deleted_at", null)
    .not("expires_at", "is", null)
    .order("expires_at", { ascending: true });

  const unwrap = <T,>(v: T | T[] | null | undefined): T | null => Array.isArray(v) ? v[0] ?? null : v ?? null;

  const rows: Row[] = [];
  for (const c of (casesRes.data ?? []) as Array<{
    id: string; code: string; title: string | null; expires_at: string;
    client: { id: string; full_name: string }[] | { id: string; full_name: string } | null;
    company: { id: string; name: string }[] | { id: string; name: string } | null;
    service: (NonNullable<Svc>)[] | NonNullable<Svc> | null;
  }>) {
    const cli = unwrap(c.client);
    const cmp = unwrap(c.company);
    const svc = unwrap(c.service);
    const owner = cli?.full_name ?? cmp?.name ?? "?";
    const cadenceLabel = svc?.recurring_amount && svc?.recurring_unit
      ? `recurring every ${svc.recurring_amount} ${svc.recurring_unit}`
      : svc?.validity_amount && svc?.validity_unit
        ? `valid ${svc.validity_amount} ${svc.validity_unit}`
        : "";
    rows.push({
      id: c.id,
      code: c.code,
      title: `${c.title || svc?.name || "Case"} — ${owner}`,
      subtitle: `${c.code}${cadenceLabel ? ` · ${cadenceLabel}` : ""}`,
      expires_at: c.expires_at,
      href: `/cases/${c.id}`,
      service: svc,
      daysLeft: daysUntil(c.expires_at),
    });
  }

  const overdue  = rows.filter((r) => renewalTier(r.expires_at, r.service) === "overdue");
  const dueSoon  = rows.filter((r) => renewalTier(r.expires_at, r.service) === "due_soon");
  const later    = rows.filter((r) => renewalTier(r.expires_at, r.service) === "later");

  return (
    <div className="max-w-[1100px]">
      <div className="mb-5">
        <h1 className="font-serif text-[28px] leading-tight text-ink tracking-tight">{t("page.renewals.title")}</h1>
        <p className="text-[13.5px] text-[var(--muted)] mt-1">
          Renewal windows use a fixed rule: yearly services surface 90 days out, quarterly 30 days, monthly 10 days.
        </p>
      </div>

      <Bucket title={`Overdue · ${overdue.length}`} rows={overdue} tone="red" />
      <Bucket title={`Due to renew · ${dueSoon.length}`} rows={dueSoon} tone="gold" />

      {later.length > 0 && (
        <details className="mb-6">
          <summary className="cursor-pointer list-none inline-flex items-center gap-2 text-[11.5px] uppercase tracking-[0.08em] font-semibold text-[var(--muted)] hover:text-ink py-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--muted)]" />
            <span>Later · {later.length}</span>
            <span className="text-[10px]">(outside their reminder window)</span>
          </summary>
          <div className="mt-2">
            <RowList rows={later} tone="muted" />
          </div>
        </details>
      )}

      {rows.length === 0 && (
        <div className="py-16 text-center text-[13px] text-[var(--muted)]">
          {t("renewals.empty")}
        </div>
      )}
    </div>
  );
}

function Bucket({ title, rows, tone }: { title: string; rows: Row[]; tone: "red" | "gold" | "muted" }) {
  if (rows.length === 0) return null;
  const toneClass =
    tone === "red" ? "text-red-700"
    : tone === "gold" ? "text-[#8A6919]"
    : "text-[var(--muted)]";
  const dotClass =
    tone === "red" ? "bg-red-500"
    : tone === "gold" ? "bg-[#E8B14A]"
    : "bg-[var(--muted-2,var(--muted))]";

  return (
    <section className="mb-6">
      <div className={`flex items-center gap-2 mb-2 text-[11.5px] uppercase tracking-[0.08em] font-semibold ${toneClass}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
        <span>{title}</span>
      </div>
      <RowList rows={rows} tone={tone} />
    </section>
  );
}

function RowList({ rows, tone }: { rows: Row[]; tone: "red" | "gold" | "muted" }) {
  return (
    <div className="border-y border-[var(--border-strong)]">
      {rows.map((r, i) => (
        <Link
          key={r.id}
          href={r.href}
          className={`group grid grid-cols-[90px_1fr_90px_100px] gap-3 items-center px-3 py-2 text-[13px] hover:bg-white/50 transition-colors ${i > 0 ? "border-t border-[var(--border)]" : ""}`}
        >
          <span className={`inline-flex items-center gap-1.5 text-[10.5px] font-medium px-2 py-0.5 rounded-full justify-self-start ${CASE_STYLE.bg} ${CASE_STYLE.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${CASE_STYLE.dot}`} />
            case
          </span>
          <div className="min-w-0">
            <div className="text-ink font-medium truncate group-hover:text-brand-dark">{r.title}</div>
            <div className="text-[11.5px] text-[var(--muted)] truncate">
              {r.subtitle} · lead {leadDaysForService(r.service)}d
            </div>
          </div>
          <div className={`text-right text-[11.5px] tabular-nums ${
            tone === "red" ? "text-red-700 font-semibold"
            : tone === "gold" ? "text-[#8A6919] font-medium"
            : "text-[var(--muted)]"
          }`}>
            {r.daysLeft < 0 ? `overdue ${-r.daysLeft}d` : `in ${r.daysLeft}d`}
          </div>
          <div className={`text-right text-[11.5px] font-mono ${
            tone === "red" ? "text-red-700 font-semibold"
            : tone === "gold" ? "text-[#8A6919] font-medium"
            : "text-[var(--muted)]"
          }`}>
            {fmtDate(r.expires_at)}
          </div>
        </Link>
      ))}
    </div>
  );
}

function fmtDate(v: string): string {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}
