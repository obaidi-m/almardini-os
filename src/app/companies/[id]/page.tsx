import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Company } from "@/lib/types";
import { CompanyDetail } from "./CompanyDetail";

type LinkedClient = {
  role: string;
  client: { id: string; code: string; full_name: string } | null;
};

export default async function CompanyDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const [{ data: company, error }, { data: links }, { data: allClients }, { data: rolesList }, { data: casesRaw }] = await Promise.all([
    supabase
      .from("companies")
      .select("id, code, name, nib, incorporation_date, address, drive_folder_url, notes, deleted_at, created_at, updated_at")
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
               service:service_types(id, name, recurring_amount, recurring_unit, validity_amount, validity_unit)`)
      .eq("company_id", params.id)
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
  if (!company) notFound();

  const c = company as Company;

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
    service: { id: string; name: string; recurring_amount: number | null; recurring_unit: string | null; validity_amount: number | null; validity_unit: string | null } | { id: string; name: string; recurring_amount: number | null; recurring_unit: string | null; validity_amount: number | null; validity_unit: string | null }[] | null;
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
      />
    </div>
  );
}

function fmtDate(v: string | null | undefined): string {
  if (!v) return "—";
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}
