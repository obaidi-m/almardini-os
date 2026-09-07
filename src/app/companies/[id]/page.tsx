import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Company, EntityService, ServiceType, VirtualOffice } from "@/lib/types";
import { CompanyDetail } from "./CompanyDetail";
import { expireOverdueVirtualOffices } from "@/lib/virtual-offices";

type LinkedClient = {
  role: string;
  client: { id: string; code: string; full_name: string } | null;
};

export default async function CompanyDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  await expireOverdueVirtualOffices(supabase);

  const [{ data: company, error }, { data: links }, { data: allClients }, { data: rolesList }, { data: casesRaw }, { data: vosRaw }, { data: partnersData }, { data: entityServicesRaw }, { data: catalogRaw }] = await Promise.all([
    supabase
      .from("companies")
      .select("id, code, name, nib, incorporation_date, address, drive_folder_url, notes, introduced_by_partner_id, deleted_at, created_at, updated_at, introduced_by:partners!companies_introduced_by_fk(id, name, code)")
      .eq("id", params.id)
      .maybeSingle(),
    supabase
      .from("client_companies")
      .select("role, client:clients(id, code, full_name)")
      .eq("company_id", params.id)
      .order("role"),
    supabase
      .from("clients")
      .select("id, code, full_name")
      .is("deleted_at", null)
      .order("full_name")
      .limit(500),
    supabase
      .from("company_roles")
      .select("code, label_en, label_id, sort_order")
      .order("sort_order"),
    supabase
      .from("cases")
      .select(`id, code, title, status, priority, deadline, expires_at, updated_at,
               client:clients(id, full_name),
               service:service_types(id, code, name, schedule_kind, annual_month, annual_day, quarterly_day, quarterly_months, validity_amount, validity_unit)`)
      .eq("company_id", params.id)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(50),
    supabase
      .from("virtual_offices")
      .select("id, company_id, tier, term_months, start_date, end_date, pic_name, pic_phone, status, notes, drive_folder_url, responsible_partner_id, created_at, updated_at, deleted_at, responsible:partners!virtual_offices_responsible_partner_fk(id, name, code)")
      .eq("company_id", params.id)
      .is("deleted_at", null)
      .order("end_date", { ascending: false }),
    supabase
      .from("partners")
      .select("id, code, name")
      .is("deleted_at", null)
      .order("name")
      .limit(500),
    supabase
      .from("entity_services")
      .select("id, service_id, client_id, company_id, status, started_date, issued_date, expires_date, tier, term_months, sponsor_company_id, responsible_partner_id, drive_folder_url, notes, created_at, updated_at, deleted_at, service:service_types(id, code, name, applies_to, tracks_expiry, is_ongoing), sponsor:companies!entity_services_sponsor_company_id_fkey(id, name, code), responsible:partners!entity_services_responsible_partner_id_fkey(id, name, code)")
      .eq("company_id", params.id)
      .is("deleted_at", null)
      .order("status")
      .order("expires_date", { ascending: true }),
    supabase
      .from("service_types")
      .select("id, code, name, applies_to, tracks_expiry, is_ongoing")
      .eq("is_active", true)
      .in("applies_to", ["company", "either"])
      .order("name"),
  ]);

  if (error) {
    return (
      <div className="text-[13px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
        {error.message}
      </div>
    );
  }
  if (!company) notFound();

  const raw = company as Company & { introduced_by?: { id: string; name: string; code: string }[] | { id: string; name: string; code: string } | null };
  const introducedBy = Array.isArray(raw.introduced_by) ? raw.introduced_by[0] ?? null : raw.introduced_by ?? null;
  const c: Company = { ...raw, introduced_by: introducedBy };

  const rawLinks = (links as unknown as Array<{ role: string; client: { id: string; code: string; full_name: string }[] | { id: string; code: string; full_name: string } | null }>) ?? [];
  const linkedClients: LinkedClient[] = rawLinks.map((l) => ({
    role: l.role,
    client: Array.isArray(l.client) ? l.client[0] ?? null : l.client,
  }));

  const clients = (allClients as Array<{ id: string; code: string; full_name: string }>) ?? [];

  const unwrap = <T,>(v: T | T[] | null | undefined): T | null => Array.isArray(v) ? v[0] ?? null : v ?? null;
  const cases = ((casesRaw as unknown as Array<{
    id: string; code: string; title: string | null;
    status: import("@/lib/types").CaseStatus; priority: import("@/lib/types").CasePriority;
    deadline: string | null; expires_at: string | null; updated_at: string;
    client: { id: string; full_name: string } | { id: string; full_name: string }[] | null;
    service: { id: string; code: string; name: string; schedule_kind: "one_off" | "annual_fixed" | "quarterly_fixed" | null; annual_month: number | null; annual_day: number | null; quarterly_day: number | null; quarterly_months: number[] | null; validity_amount: number | null; validity_unit: string | null } | { id: string; code: string; name: string; schedule_kind: "one_off" | "annual_fixed" | "quarterly_fixed" | null; annual_month: number | null; annual_day: number | null; quarterly_day: number | null; quarterly_months: number[] | null; validity_amount: number | null; validity_unit: string | null }[] | null;
  }>) ?? []).map((row) => ({
    id: row.id, code: row.code, title: row.title,
    status: row.status, priority: row.priority,
    deadline: row.deadline, expires_at: row.expires_at, updated_at: row.updated_at,
    client: unwrap(row.client),
    service: unwrap(row.service),
  }));

  return (
    <div className="max-w-[1200px]">
      <Link href="/companies" className="inline-flex items-center gap-1 text-[12.5px] text-[var(--muted)] hover:text-ink mb-3">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Companies
      </Link>
      <div className="flex items-baseline flex-wrap gap-x-3 gap-y-1 mb-1">
        <h1 className="font-serif text-[28px] leading-tight text-ink tracking-tight">{c.name}</h1>
        <span className="font-mono text-[11px] text-brand-dark bg-brand-softer px-1.5 py-0.5 rounded">
          {c.code}
        </span>
        {c.deleted_at && (
          <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--muted)] bg-[var(--surface-2)] px-1.5 py-0.5 rounded">
            archived
          </span>
        )}
      </div>
      <p className="text-[13px] text-[var(--muted)] mb-6">
        {c.nib ? <span className="font-mono">{c.nib}</span> : "No NIB"}
        {c.incorporation_date && (
          <>
            <span className="mx-2 opacity-40">·</span>
            <span>Incorporated {fmtDate(c.incorporation_date)}</span>
          </>
        )}
      </p>

      <CompanyDetail
        company={c}
        linkedClients={linkedClients}
        allClients={clients}
        roles={(rolesList as Array<{ code: string; label_en: string; label_id: string | null; sort_order: number }>) ?? []}
        cases={cases}
        virtualOffices={((vosRaw as unknown as Array<VirtualOffice & { responsible?: { id: string; name: string; code: string } | { id: string; name: string; code: string }[] | null }>) ?? []).map((v) => ({
          ...v,
          responsible: Array.isArray(v.responsible) ? v.responsible[0] ?? null : v.responsible ?? null,
        }))}
        partners={(partnersData as Array<{ id: string; code: string; name: string }>) ?? []}
        entityServices={((entityServicesRaw as unknown as Array<EntityService & {
          service: EntityService["service"] | EntityService["service"][];
          sponsor: EntityService["sponsor"] | EntityService["sponsor"][];
          responsible: EntityService["responsible"] | EntityService["responsible"][];
        }>) ?? []).map((r) => ({
          ...r,
          service: Array.isArray(r.service) ? r.service[0] ?? null : r.service ?? null,
          sponsor: Array.isArray(r.sponsor) ? r.sponsor[0] ?? null : r.sponsor ?? null,
          responsible: Array.isArray(r.responsible) ? r.responsible[0] ?? null : r.responsible ?? null,
        }))}
        catalog={(catalogRaw as Array<Pick<ServiceType, "id" | "code" | "name" | "applies_to" | "tracks_expiry" | "is_ongoing">>) ?? []}
      />
    </div>
  );
}

function fmtDate(v: string | null | undefined): string {
  if (!v) return "—";
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}
