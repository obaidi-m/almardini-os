// Rebuilt at most every 60s per path — actions call revalidatePath
// to bust it immediately on mutations.
export const revalidate = 60;

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CaseDetail } from "./CaseDetail";
import type { CaseStatus, CasePriority } from "@/lib/types";
import { serviceLabel } from "@/lib/service";

export type CaseRecord = {
  id: string;
  code: string;
  title: string | null;
  status: CaseStatus;
  priority: CasePriority;
  client_id: string | null;
  company_id: string | null;
  service_type_id: string;
  assigned_to: string | null;
  deadline: string | null;
  expires_at: string | null;
  drive_folder_url: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type UpdateRow = {
  id: string;
  text: string;
  status_before: CaseStatus | null;
  status_after: CaseStatus | null;
  created_at: string;
  author: { id: string; full_name: string } | null;
};

export default async function CaseDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const [
    { data: caseRow, error },
    { data: updatesRaw },
    { data: clients },
    { data: companies },
    { data: services },
    { data: users },
    { data: me },
  ] = await Promise.all([
    supabase
      .from("cases")
      .select(`
        id, code, title, status, priority, client_id, company_id, service_type_id,
        assigned_to, deadline, expires_at,
        drive_folder_url, deleted_at, created_at, updated_at,
        client:clients(id, code, full_name, phone, email, preferred_channel),
        company:companies(id, code, name),
        service:service_types(id, code, name, has_deliverable),
        assignee:users!cases_assigned_to_fkey(id, full_name)
      `)
      .eq("id", params.id)
      .maybeSingle(),
    supabase
      .from("case_updates")
      .select("id, text, status_before, status_after, created_at, author:users(id, full_name)")
      .eq("case_id", params.id)
      .order("created_at", { ascending: false }),
    supabase.from("clients").select("id, code, full_name").is("deleted_at", null).order("full_name"),
    supabase.from("companies").select("id, code, name").is("deleted_at", null).order("name"),
    supabase.from("service_types").select("id, code, name, has_deliverable, is_active, applies_to").eq("is_active", true).order("sort_order"),
    supabase.from("users").select("id, full_name").eq("is_active", true).order("full_name"),
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { data: null };
      return supabase.from("users").select("id, role:roles(code)").eq("id", user.id).single();
    })(),
  ]);

  if (error) {
    return (
      <div className="text-[13px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
        {error.message}
      </div>
    );
  }
  if (!caseRow) notFound();

  const raw = caseRow as unknown as CaseRecord & {
    client: { id: string; code: string; full_name: string; phone: string | null; email: string | null; preferred_channel: "whatsapp" | "email" }[] | { id: string; code: string; full_name: string; phone: string | null; email: string | null; preferred_channel: "whatsapp" | "email" } | null;
    company: { id: string; code: string; name: string }[] | { id: string; code: string; name: string } | null;
    service: { id: string; code: string; name: string; has_deliverable: boolean }[] | { id: string; code: string; name: string; has_deliverable: boolean } | null;
    assignee: { id: string; full_name: string }[] | { id: string; full_name: string } | null;
  };
  const unwrap = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

  const c = raw;
  const client = unwrap(raw.client);
  const company = unwrap(raw.company);
  const service = unwrap(raw.service);
  const assignee = unwrap(raw.assignee);

  const updates: UpdateRow[] = (updatesRaw ?? []).map((u) => {
    const uu = u as unknown as UpdateRow & { author: { id: string; full_name: string }[] | { id: string; full_name: string } | null };
    return { ...uu, author: unwrap(uu.author) };
  });

  const roleCode = ((me as { role?: { code?: string } | { code?: string }[] } | null)?.role
    ? (Array.isArray((me as { role: unknown }).role) ? ((me as { role: { code?: string }[] }).role[0]?.code) : ((me as { role: { code?: string } }).role.code))
    : undefined) as string | undefined;
  const canDeliver = roleCode === "owner" || roleCode === "ops_lead";

  const today = new Date().toISOString().slice(0, 10);
  const overdue = c.deadline && c.deadline < today && c.status !== "delivered";
  const soonIso = (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10); })();
  const dueSoon = !overdue && c.deadline && c.deadline <= soonIso && c.status !== "delivered";

  return (
    <div className="max-w-[1200px]">
      <Link href="/cases" className="inline-flex items-center gap-1 text-[12.5px] text-[var(--muted)] hover:text-ink mb-3">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Cases
      </Link>
      <div className="flex items-baseline flex-wrap gap-x-3 gap-y-1 mb-1">
        <h1 className="font-serif text-[28px] leading-tight text-ink tracking-tight">
          {c.title || service?.name || "Untitled case"}
        </h1>
        <span className="font-mono text-[11px] text-brand-dark bg-brand-softer px-1.5 py-0.5 rounded">
          {c.code}
        </span>
        {c.deleted_at && (
          <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--muted)] bg-[var(--surface-2)] px-1.5 py-0.5 rounded">
            archived
          </span>
        )}
        {overdue && (
          <span className="text-[10px] uppercase tracking-wider font-semibold text-red-700 bg-red-50 px-1.5 py-0.5 rounded">
            overdue
          </span>
        )}
        {dueSoon && (
          <span className="text-[10px] uppercase tracking-wider font-semibold text-[#8A6919] bg-[var(--gold-soft)] px-1.5 py-0.5 rounded">
            due soon
          </span>
        )}
        {c.priority !== "normal" && (
          <span className={`text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded ${
            c.priority === "urgent" ? "text-red-700 bg-red-50" :
            c.priority === "high"   ? "text-[#8A6919] bg-[var(--gold-soft)]" :
                                      "text-[var(--muted)] bg-[var(--surface-2)]"
          }`}>
            {c.priority}
          </span>
        )}
      </div>
      <p className="text-[13px] text-[var(--muted)] mb-6">
        {client?.full_name && (
          <>
            <Link href={`/clients/${client.id}`} className="hover:text-ink">{client.full_name}</Link>
          </>
        )}
        {client && company && <span className="mx-2 opacity-40">·</span>}
        {company?.name && (
          <Link href={`/companies/${company.id}`} className="hover:text-ink">{company.name}</Link>
        )}
        {(client || company) && service?.name && <span className="mx-2 opacity-40">·</span>}
        {service?.name && <span>{serviceLabel(service)}</span>}
      </p>

      <CaseDetail
        caseRow={c}
        client={client}
        company={company}
        service={service}
        assignee={assignee}
        updates={updates}
        canDeliver={canDeliver}
        clientOptions={(clients ?? []).map((x) => ({ id: x.id, label: x.full_name, hint: x.code }))}
        companyOptions={(companies ?? []).map((x) => ({ id: x.id, label: x.name, hint: x.code }))}
        serviceOptions={(services ?? []).map((x) => ({ id: x.id, label: serviceLabel(x), appliesTo: (x.applies_to ?? "either") as "person" | "company" | "either" }))}
        userOptions={(users ?? []).map((x) => ({ id: x.id, label: x.full_name }))}
        hasDeliverableByService={Object.fromEntries((services ?? []).map((s) => [s.id, s.has_deliverable !== false]))}
      />
    </div>
  );
}
