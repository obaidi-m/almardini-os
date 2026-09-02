import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";

type Row = {
  title: string;
  subtitle: string;
  expires_at: string;
  href: string;
};

const CASE_STYLE = { bg: "bg-[#FFEDD5]", text: "text-[#9A3412]", dot: "bg-[#F97316]" };

export default async function RenewalsPage() {
  const supabase = createClient();
  const { t } = await getT();

  const today = new Date();
  const in180 = new Date(); in180.setDate(in180.getDate() + 180);
  const in180Iso = in180.toISOString().slice(0, 10);

  const casesRes = await supabase
    .from("cases")
    .select("id, code, title, expires_at, client:clients(id, full_name), service:service_types(id, name, recurring_amount, recurring_unit)")
    .is("deleted_at", null)
    .not("expires_at", "is", null)
    .lte("expires_at", in180Iso)
    .order("expires_at", { ascending: true });

  const unwrap = <T,>(v: T | T[] | null | undefined): T | null => Array.isArray(v) ? v[0] ?? null : v ?? null;

  const rows: Row[] = [];
  for (const c of (casesRes.data ?? []) as Array<{ id: string; code: string; title: string | null; expires_at: string; client: { id: string; full_name: string }[] | { id: string; full_name: string } | null; service: { id: string; name: string; recurring_amount: number | null; recurring_unit: string | null }[] | { id: string; name: string; recurring_amount: number | null; recurring_unit: string | null } | null }>) {
    const cli = unwrap(c.client);
    const svc = unwrap(c.service);
    const recurring = svc?.recurring_amount && svc?.recurring_unit ? `recurring every ${svc.recurring_amount} ${svc.recurring_unit}` : "";
    rows.push({ title: `${c.title || svc?.name || "Case"} — ${cli?.full_name ?? "?"}`, subtitle: `${c.code}${recurring ? ` · ${recurring}` : ""}`, expires_at: c.expires_at, href: `/cases/${c.id}` });
  }

  const bucketDays = (iso: string): number => {
    const d = new Date(iso + "T00:00:00");
    return Math.floor((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const overdue = rows.filter((r) => bucketDays(r.expires_at) < 0).sort((a, b) => a.expires_at.localeCompare(b.expires_at));
  const in30    = rows.filter((r) => { const d = bucketDays(r.expires_at); return d >= 0 && d <= 30; });
  const in60    = rows.filter((r) => { const d = bucketDays(r.expires_at); return d > 30 && d <= 60; });
  const in90    = rows.filter((r) => { const d = bucketDays(r.expires_at); return d > 60 && d <= 90; });
  const later   = rows.filter((r) => bucketDays(r.expires_at) > 90);

  return (
    <div className="max-w-[1100px]">
      <div className="mb-5">
        <h1 className="font-serif text-[28px] leading-tight text-ink tracking-tight">{t("page.renewals.title")}</h1>
        <p className="text-[13.5px] text-[var(--muted)] mt-1">{t("page.renewals.subtitle")}</p>
      </div>

      <Bucket title={t("renewals.bucket.overdue")} count={overdue.length} rows={overdue} tone="red" t={t} />
      <Bucket title={t("renewals.bucket.30")} count={in30.length} rows={in30} tone="gold" t={t} />
      <Bucket title={t("renewals.bucket.30_60")} count={in60.length} rows={in60} tone="neutral" t={t} />
      <Bucket title={t("renewals.bucket.60_90")} count={in90.length} rows={in90} tone="neutral" t={t} />
      <Bucket title={t("renewals.bucket.later")} count={later.length} rows={later} tone="muted" t={t} />

      {rows.length === 0 && (
        <div className="py-16 text-center text-[13px] text-[var(--muted)]">
          {t("renewals.empty")}
        </div>
      )}
    </div>
  );
}

type Tr = (k: import("@/lib/i18n/messages").MessageKey, vars?: Record<string, string | number>) => string;

function Bucket({ title, count, rows, tone, t }: { title: string; count: number; rows: Row[]; tone: "red" | "gold" | "neutral" | "muted"; t: Tr }) {
  if (rows.length === 0) return null;

  const toneClass =
    tone === "red" ? "text-red-700"
    : tone === "gold" ? "text-[#8A6919]"
    : tone === "muted" ? "text-[var(--muted)]"
    : "text-ink";

  const dotClass =
    tone === "red" ? "bg-red-500"
    : tone === "gold" ? "bg-[#E8B14A]"
    : "bg-[var(--muted-2,var(--muted))]";

  return (
    <section className="mb-6">
      <div className={`flex items-center gap-2 mb-2 text-[11.5px] uppercase tracking-[0.08em] font-semibold ${toneClass}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
        <span>{title}</span>
        <span className="opacity-60 font-normal normal-case tracking-normal text-[11px]">· {count}</span>
      </div>
      <div className="border-y border-[var(--border-strong)]">
        {rows.map((r, i) => {
          return (
            <Link
              key={i}
              href={r.href}
              className={`group grid grid-cols-[90px_1fr_100px] gap-3 items-center px-3 py-2 text-[13px] hover:bg-white/50 transition-colors ${i > 0 ? "border-t border-[var(--border)]" : ""}`}
            >
              <span className={`inline-flex items-center gap-1.5 text-[10.5px] font-medium px-2 py-0.5 rounded-full justify-self-start ${CASE_STYLE.bg} ${CASE_STYLE.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${CASE_STYLE.dot}`} />
                {t("renewal.badge.case")}
              </span>
              <div className="min-w-0">
                <div className="text-ink font-medium truncate group-hover:text-brand-dark">{r.title}</div>
                <div className="text-[11.5px] text-[var(--muted)] truncate">{r.subtitle}</div>
              </div>
              <div className={`text-right text-[11.5px] font-mono ${tone === "red" ? "text-red-700 font-semibold" : tone === "gold" ? "text-[#8A6919] font-medium" : "text-[var(--muted)]"}`}>
                {fmtDate(r.expires_at)}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function fmtDate(v: string): string {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}
