import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Partner, CaseStatus, CasePriority } from "@/lib/types";
import { PartnerDetail } from "./PartnerDetail";

export default async function PartnerDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const [{ data: partner, error }, { data: introducedClients }, { data: introducedCompanies }, { data: managedVOs }, { data: casesRaw }] = await Promise.all([
    supabase
      .from("partners")
      .select("id, code, name, type, contact_person, phone, email, notes, deleted_at, created_at, updated_at")
      .eq("id", params.id)
      .maybeSingle(),
    supabase
      .from("clients")
      .select("id, code, full_name")
      .eq("introduced_by_partner_id", params.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("companies")
      .select("id, code, name")
      .eq("introduced_by_partner_id", params.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("entity_services")
      .select(`
        id, tier, term_months, started_date, expires_date, status,
        company:companies!entity_services_company_id_fkey(id, code, name),
        service:service_types!inner(id, name)
      `)
      .eq("responsible_partner_id", params.id)
      .not("company_id", "is", null)
      .ilike("service.name", "%virtual office%")
      .is("deleted_at", null)
      .order("expires_date", { ascending: false })
      .limit(200),
    supabase
      .from("cases")
      .select(`id, code, title, status, priority, deadline, updated_at,
               client:clients(id, full_name),
               company:companies(id, name),
               service:service_types(id, code, name)`)
      .eq("partner_id", params.id)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(50),
  ]);

  if (error) {
    return (
      <div className="text-[13px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
        {error.message}
      </div>
    );
  }
  if (!partner) notFound();

  const p = partner as Partner;
  const clients = (introducedClients as Array<{ id: string; code: string; full_name: string }>) ?? [];

  const unwrapCo = <T,>(v: T | T[] | null | undefined): T | null => Array.isArray(v) ? v[0] ?? null : v ?? null;
  type VORaw = {
    id: string;
    tier: string | null;
    term_months: number | null;
    started_date: string | null;
    expires_date: string | null;
    status: "active" | "expired" | "terminated" | "paused";
    company: { id: string; code: string; name: string } | { id: string; code: string; name: string }[] | null;
  };
  const managedOffices = ((managedVOs as VORaw[]) ?? []).map((v) => ({
    id: v.id,
    tier: (v.tier ?? "silver") as "bronze" | "silver" | "gold" | "platinum",
    term_months: v.term_months ?? 12,
    start_date: v.started_date,
    end_date: v.expires_date ?? "",
    status: (v.status === "paused" ? "active" : v.status) as "active" | "expired" | "terminated",
    company: unwrapCo(v.company),
  }));

  // Related companies = introduced-by ∪ companies where this partner is PJ of any VO.
  const companyMap = new Map<string, { id: string; code: string; name: string }>();
  for (const c of (introducedCompanies as Array<{ id: string; code: string; name: string }>) ?? []) {
    companyMap.set(c.id, c);
  }
  for (const vo of managedOffices) {
    if (vo.company) companyMap.set(vo.company.id, vo.company);
  }
  const companies = Array.from(companyMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  const unwrap = <T,>(v: T | T[] | null | undefined): T | null => Array.isArray(v) ? v[0] ?? null : v ?? null;
  const cases = ((casesRaw as unknown as Array<{
    id: string; code: string; title: string | null;
    status: CaseStatus; priority: CasePriority;
    deadline: string | null; updated_at: string;
    client: { id: string; full_name: string } | { id: string; full_name: string }[] | null;
    company: { id: string; name: string } | { id: string; name: string }[] | null;
    service: { id: string; code: string; name: string } | { id: string; code: string; name: string }[] | null;
  }>) ?? []).map((row) => ({
    id: row.id, code: row.code, title: row.title,
    status: row.status, priority: row.priority,
    deadline: row.deadline, updated_at: row.updated_at,
    client: unwrap(row.client),
    company: unwrap(row.company),
    service: unwrap(row.service),
  }));

  return (
    <div className="max-w-[1200px]">
      <Link href="/partners" className="inline-flex items-center gap-1 text-[12.5px] text-[var(--muted)] hover:text-ink mb-3">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Partners
      </Link>
      <div className="flex items-baseline flex-wrap gap-x-3 gap-y-1 mb-1">
        <h1 className="font-serif text-[28px] leading-tight text-ink tracking-tight">{p.name}</h1>
        <span className="font-mono text-[11px] text-brand-dark bg-brand-softer px-1.5 py-0.5 rounded">
          {p.code}
        </span>
        {p.deleted_at && (
          <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--muted)] bg-[var(--surface-2)] px-1.5 py-0.5 rounded">
            archived
          </span>
        )}
      </div>
      <p className="text-[13px] text-[var(--muted)] mb-6">
        {p.contact_person || "—"}
        {p.phone && <><span className="mx-2 opacity-40">·</span><span>{p.phone}</span></>}
        {p.email && <><span className="mx-2 opacity-40">·</span><span>{p.email}</span></>}
      </p>

      <PartnerDetail partner={p} introducedClients={clients} introducedCompanies={companies} managedOffices={managedOffices} cases={cases} />
    </div>
  );
}
