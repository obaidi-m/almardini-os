import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CaseForm } from "../CaseForm";
import { createCaseAction } from "../actions";
import { serviceLabel } from "@/lib/service";
import { getT } from "@/lib/i18n/server";

export default async function NewCasePage({ searchParams }: { searchParams: { client?: string; client_id?: string; company_id?: string } }) {
  const supabase = createClient();
  const { t } = await getT();

  const [{ data: clients }, { data: companies }, { data: services }, { data: users }] = await Promise.all([
    supabase.from("clients").select("id, code, full_name").is("deleted_at", null).order("full_name"),
    supabase.from("companies").select("id, code, name").is("deleted_at", null).order("name"),
    supabase.from("service_types").select("id, code, name, has_deliverable, is_active").eq("is_active", true).order("sort_order"),
    supabase.from("users").select("id, full_name").eq("is_active", true).order("full_name"),
  ]);

  const clientOptions = (clients ?? []).map((c) => ({ id: c.id, label: c.full_name, hint: c.code }));
  const companyOptions = (companies ?? []).map((c) => ({ id: c.id, label: c.name, hint: c.code }));
  const serviceOptions = (services ?? []).map((s) => ({ id: s.id, label: serviceLabel(s) }));
  const userOptions = (users ?? []).map((u) => ({ id: u.id, label: u.full_name }));

  const hasDeliverableByService: Record<string, boolean> = {};
  for (const s of services ?? []) hasDeliverableByService[s.id] = s.has_deliverable !== false;

  return (
    <div className="max-w-2xl">
      <Link href="/cases" className="text-[12.5px] text-[var(--muted)] hover:text-ink">← {t("nav.cases")}</Link>
      <h1 className="text-[26px] font-semibold text-ink tracking-tight mt-2">{t("action.new_case")}</h1>
      <p className="text-[13px] text-[var(--muted)] mb-8">A CAS-xxxx code will be assigned automatically. Status starts at New.</p>

      <CaseForm
        mode="create"
        defaults={{
          client_id: searchParams.client ?? searchParams.client_id ?? null,
          company_id: searchParams.company_id ?? null,
          priority: "normal",
        }}
        clients={clientOptions}
        companies={companyOptions}
        services={serviceOptions}
        users={userOptions}
        hasDeliverableByService={hasDeliverableByService}
        action={createCaseAction}
      />
    </div>
  );
}
