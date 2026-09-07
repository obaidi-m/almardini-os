import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Client, EntityService, Partner, ServiceType } from "@/lib/types";
import { ClientDetail } from "./ClientDetail";

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const [{ data: client, error }, { data: partners }, { data: companyLinks }, { data: allCompanies }, { data: rolesList }, { data: caseRows }, { data: entityServicesRaw }, { data: catalogRaw }] = await Promise.all([
    supabase
      .from("clients")
      .select(
        "id, code, full_name, nationality, passport_no, date_of_birth, place_of_birth, phone, email, preferred_channel, introduced_by_partner_id, drive_folder_url, notes, deleted_at, created_at, updated_at, introduced_by:partners!clients_introduced_by_fk(id, name, code)",
      )
      .eq("id", params.id)
      .maybeSingle(),
    supabase.from("partners").select("id, name, code").is("deleted_at", null).order("name"),
    supabase
      .from("client_companies")
      .select("role, company:companies(id, code, name)")
      .eq("client_id", params.id)
      .order("role"),
    supabase
      .from("companies")
      .select("id, code, name")
      .is("deleted_at", null)
      .order("name")
      .limit(500),
    supabase
      .from("company_roles")
      .select("code, label_en, label_id, sort_order")
      .order("sort_order"),
    supabase
      .from("cases")
      .select("id, code, title, status, priority, expires_at, service:service_types(id, code, name, schedule_kind, annual_month, annual_day, quarterly_day, quarterly_months, validity_amount, validity_unit)")
      .eq("client_id", params.id)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(50),
    supabase
      .from("entity_services")
      .select("id, service_id, client_id, company_id, status, started_date, issued_date, expires_date, tier, term_months, sponsor_company_id, responsible_partner_id, drive_folder_url, notes, created_at, updated_at, deleted_at, service:service_types(id, code, name, applies_to, tracks_expiry, is_ongoing), sponsor:companies!entity_services_sponsor_company_id_fkey(id, name, code), responsible:partners!entity_services_responsible_partner_id_fkey(id, name, code)")
      .eq("client_id", params.id)
      .is("deleted_at", null)
      .order("status")
      .order("expires_date", { ascending: true }),
    supabase
      .from("service_types")
      .select("id, code, name, applies_to, tracks_expiry, is_ongoing")
      .eq("is_active", true)
      .in("applies_to", ["person", "either"])
      .order("name"),
  ]);

  if (error) {
    return (
      <div className="text-[13px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
        {error.message}
      </div>
    );
  }
  if (!client) notFound();

  const raw = client as unknown as Omit<Client, "introduced_by"> & {
    introduced_by: { id: string; name: string; code: string }[] | { id: string; name: string; code: string } | null;
  };
  const introduced_by = Array.isArray(raw.introduced_by) ? raw.introduced_by[0] ?? null : raw.introduced_by ?? null;
  const normalized: Client = { ...raw, introduced_by };

  const rawLinks = (companyLinks as unknown as Array<{ role: string; company: { id: string; code: string; name: string }[] | { id: string; code: string; name: string } | null }>) ?? [];
  const linkedCompanies = rawLinks.map((l) => ({
    role: l.role,
    company: Array.isArray(l.company) ? l.company[0] ?? null : l.company,
  }));
  const companies = (allCompanies as Array<{ id: string; code: string; name: string }>) ?? [];

  return (
    <div className="max-w-[1200px]">
      {/* Breadcrumb + page header */}
      <Link href="/clients" className="inline-flex items-center gap-1 text-[12.5px] text-[var(--muted)] hover:text-ink mb-3">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Clients
      </Link>
      <div className="flex items-baseline flex-wrap gap-x-3 gap-y-1 mb-1">
        <h1 className="font-serif text-[28px] leading-tight text-ink tracking-tight">
          {normalized.full_name}
        </h1>
        <span className="font-mono text-[11px] text-brand-dark bg-brand-softer px-1.5 py-0.5 rounded">
          {normalized.code}
        </span>
        {normalized.deleted_at && (
          <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--muted)] bg-[var(--surface-2)] px-1.5 py-0.5 rounded">
            archived
          </span>
        )}
      </div>
      <p className="text-[13px] text-[var(--muted)] mb-6">
        {normalized.nationality || "—"}
        {normalized.passport_no && (
          <>
            <span className="mx-2 opacity-40">·</span>
            <span className="font-mono">{normalized.passport_no}</span>
          </>
        )}
      </p>

      <ClientDetail
        client={normalized}
        partners={(partners as Pick<Partner, "id" | "name" | "code">[]) ?? []}
        linkedCompanies={linkedCompanies}
        allCompanies={companies}
        roles={(rolesList as Array<{ code: string; label_en: string; label_id: string | null; sort_order: number }>) ?? []}
        cases={(caseRows as unknown as Array<{ id: string; code: string; title: string | null; status: import("@/lib/types").CaseStatus; priority: import("@/lib/types").CasePriority; expires_at: string | null; service: { id: string; code: string; name: string; schedule_kind: "one_off" | "annual_fixed" | "quarterly_fixed" | null; annual_month: number | null; annual_day: number | null; quarterly_day: number | null; quarterly_months: number[] | null; validity_amount: number | null; validity_unit: string | null }[] | { id: string; code: string; name: string; schedule_kind: "one_off" | "annual_fixed" | "quarterly_fixed" | null; annual_month: number | null; annual_day: number | null; quarterly_day: number | null; quarterly_months: number[] | null; validity_amount: number | null; validity_unit: string | null } | null }>) ?? []}
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
