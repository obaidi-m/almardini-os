import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CompanyForm } from "../CompanyForm";
import { createCompanyAction } from "../actions";

export default async function NewCompanyPage() {
  const supabase = createClient();
  const [{ data: rolesData }, { data: clientsData }, { data: partnersData }] = await Promise.all([
    supabase.from("company_roles").select("code, label_en").order("sort_order"),
    supabase.from("clients").select("id, code, full_name").is("deleted_at", null).order("full_name").limit(500),
    supabase.from("partners").select("id, code, name").is("deleted_at", null).order("name").limit(500),
  ]);
  const roles = (rolesData as Array<{ code: string; label_en: string }>) ?? [];
  const existingClients = (clientsData as Array<{ id: string; code: string; full_name: string }>) ?? [];
  const partners = (partnersData as Array<{ id: string; code: string; name: string }>) ?? [];

  return (
    <div className="max-w-2xl">
      <Link href="/companies" className="text-[12.5px] text-[var(--muted)] hover:text-ink">← Companies</Link>
      <h1 className="text-[26px] font-semibold text-ink tracking-tight mt-2">New company</h1>
      <p className="text-[13px] text-[var(--muted)] mb-8">A CMP-xxxx code will be assigned automatically.</p>

      <CompanyForm
        mode="create"
        action={createCompanyAction}
        roles={roles}
        existingClients={existingClients}
        partners={partners}
      />
    </div>
  );
}
