import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Partner, CaseStatus, CasePriority } from "@/lib/types";
import { PartnerDetail } from "./PartnerDetail";

const TYPE_LABEL: Record<Partner["type"], string> = {
  referrer: "Referrer",
  agent: "Agent",
  both: "Both",
};

const TYPE_STYLE: Record<Partner["type"], { bg: string; text: string; dot: string }> = {
  referrer: { bg: "bg-[#DBEAFE]", text: "text-[#1E40AF]", dot: "bg-[#3B82F6]" },
  agent:    { bg: "bg-[#EDE9FE]", text: "text-[#5B21B6]", dot: "bg-[#8B5CF6]" },
  both:     { bg: "bg-[#FBEFD4]", text: "text-[#8A6919]", dot: "bg-[#E8B14A]" },
};

export default async function PartnerDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const [{ data: partner, error }, { data: introducedClients }, { data: introducedCompanies }, { data: casesRaw }] = await Promise.all([
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
  const companies = (introducedCompanies as Array<{ id: string; code: string; name: string }>) ?? [];

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

  const ts = TYPE_STYLE[p.type];

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
        <span className={`inline-flex items-center gap-1.5 text-[10.5px] font-medium px-2 py-0.5 rounded-full ${ts.bg} ${ts.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${ts.dot}`} />
          {TYPE_LABEL[p.type]}
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

      <PartnerDetail partner={p} introducedClients={clients} introducedCompanies={companies} cases={cases} />
    </div>
  );
}
