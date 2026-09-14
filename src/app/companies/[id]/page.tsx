// Rebuilt at most every 60s per path — actions call revalidatePath
// to bust it immediately on mutations.
export const revalidate = 60;

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Company, EntityService, ServiceType } from "@/lib/types";
import { handledServiceIdsFromCases, type ServiceSchedule } from "@/lib/renewal";
import { CompanyDetail } from "./CompanyDetail";

type LinkedClient = {
  role: string;
  client: { id: string; code: string; full_name: string } | null;
};

export default async function CompanyDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const [{ data: company, error }, { data: links }, { data: allClients }, { data: rolesList }, { data: casesRaw }, { data: partnersData }, { data: entityServicesRaw }, { data: catalogRaw }, { data: sponsoredRaw }] = await Promise.all([
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
      .select(`id, code, title, status, priority, deadline, expires_at, created_at, updated_at,
               client:clients(id, full_name),
               service:service_types(id, code, name, schedule_kind, annual_month, annual_day, quarterly_day, quarterly_months, validity_amount, validity_unit)`)
      .eq("company_id", params.id)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(50),
    supabase
      .from("partners")
      .select("id, code, name")
      .is("deleted_at", null)
      .order("name")
      .limit(500),
    supabase
      .from("entity_services")
      .select("id, service_id, client_id, company_id, status, started_date, issued_date, expires_date, tier, term_months, sponsor_company_id, responsible_partner_id, drive_folder_url, notes, created_at, updated_at, deleted_at, service:service_types(id, code, name, applies_to, tracks_expiry, is_ongoing, schedule_kind, annual_month, annual_day, quarterly_day, quarterly_months, validity_amount, validity_unit), sponsor:companies!entity_services_sponsor_company_id_fkey(id, name, code), responsible:partners!entity_services_responsible_partner_id_fkey(id, name, code)")
      .eq("company_id", params.id)
      .is("deleted_at", null)
      .order("status")
      .order("expires_date", { ascending: true }),
    supabase
      .from("service_types")
      .select("id, code, name, applies_to, tracks_expiry, is_ongoing, schedule_kind")
      .eq("is_active", true)
      .in("applies_to", ["company", "either"])
      .order("name"),
    // People who hold a permit guaranteed by this company. Feeds the
    // "Linked people" list so the guarantor picker doubles as an implicit
    // link — no manual client_companies row needed.
    supabase
      .from("entity_services")
      .select("client:clients(id, code, full_name)")
      .eq("sponsor_company_id", params.id)
      .not("client_id", "is", null)
      .is("deleted_at", null),
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

  // Merge in permit-derived links (guarantor = this company) without
  // duplicating clients that already have an explicit client_companies row.
  const existingIds = new Set(linkedClients.map((l) => l.client?.id).filter(Boolean));
  const rawSponsored = (sponsoredRaw as unknown as Array<{ client: { id: string; code: string; full_name: string }[] | { id: string; code: string; full_name: string } | null }>) ?? [];
  for (const row of rawSponsored) {
    const client = Array.isArray(row.client) ? row.client[0] ?? null : row.client;
    if (!client || existingIds.has(client.id)) continue;
    existingIds.add(client.id);
    linkedClients.push({ role: "none", client });
  }

  const clients = (allClients as Array<{ id: string; code: string; full_name: string }>) ?? [];

  const unwrap = <T,>(v: T | T[] | null | undefined): T | null => Array.isArray(v) ? v[0] ?? null : v ?? null;
  const casesFull = ((casesRaw as unknown as Array<{
    id: string; code: string; title: string | null;
    status: import("@/lib/types").CaseStatus; priority: import("@/lib/types").CasePriority;
    deadline: string | null; expires_at: string | null; created_at: string; updated_at: string;
    client: { id: string; full_name: string } | { id: string; full_name: string }[] | null;
    service: { id: string; code: string; name: string; schedule_kind: "one_off" | "annual_fixed" | "quarterly_fixed" | null; annual_month: number | null; annual_day: number | null; quarterly_day: number | null; quarterly_months: number[] | null; validity_amount: number | null; validity_unit: string | null } | { id: string; code: string; name: string; schedule_kind: "one_off" | "annual_fixed" | "quarterly_fixed" | null; annual_month: number | null; annual_day: number | null; quarterly_day: number | null; quarterly_months: number[] | null; validity_amount: number | null; validity_unit: string | null }[] | null;
  }>) ?? []).map((row) => ({
    ...row,
    client: unwrap(row.client),
    service: unwrap(row.service),
  }));
  const cases = casesFull.map(({ created_at: _created_at, ...rest }) => rest);
  const handledServiceIds = handledServiceIdsFromCases(
    casesFull.map((c) => ({
      service_id: c.service?.id ?? null,
      created_at: c.created_at,
      service: c.service as ServiceSchedule,
    })),
  );

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
        catalog={(catalogRaw as Array<Pick<ServiceType, "id" | "code" | "name" | "applies_to" | "tracks_expiry" | "is_ongoing" | "schedule_kind">>) ?? []}
        handledServiceIds={handledServiceIds}
      />
    </div>
  );
}

function fmtDate(v: string | null | undefined): string {
  if (!v) return "—";
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}
