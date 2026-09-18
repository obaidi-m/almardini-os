// Rebuilt at most every 60s per path — actions call revalidatePath
// to bust it immediately on mutations.
export const revalidate = 60;

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CompanyForm } from "../CompanyForm";
import { createCompanyAction } from "../actions";
import { getT } from "@/lib/i18n/server";

export default async function NewCompanyPage() {
  const supabase = createClient();
  const { t } = await getT();
  const { data: partnersData } = await supabase
    .from("partners").select("id, code, name").is("deleted_at", null).order("name").limit(500);
  const partners = (partnersData as Array<{ id: string; code: string; name: string }>) ?? [];

  return (
    <div className="max-w-2xl">
      <Link href="/companies" className="text-[12.5px] text-[var(--muted)] hover:text-ink">← {t("nav.companies")}</Link>
      <h1 className="text-[26px] font-semibold text-ink tracking-tight mt-2">{t("action.new_company")}</h1>
      <p className="text-[13px] text-[var(--muted)] mb-8">A CMP-xxxx code will be assigned automatically.</p>

      <CompanyForm
        mode="create"
        action={createCompanyAction}
        partners={partners}
      />
    </div>
  );
}
