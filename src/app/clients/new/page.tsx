// Rebuilt at most every 60s per path — actions call revalidatePath
// to bust it immediately on mutations.
export const revalidate = 60;

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ClientForm } from "../ClientForm";
import { createClientAction } from "../actions";
import type { Partner } from "@/lib/types";
import { getT } from "@/lib/i18n/server";

export default async function NewClientPage() {
  const supabase = createClient();
  const { t } = await getT();
  const [{ data: partners }, { data: companies }, { data: roles }] = await Promise.all([
    supabase.from("partners").select("id, name, code").is("deleted_at", null).order("name"),
    supabase.from("companies").select("id, code, name").is("deleted_at", null).order("name").limit(500),
    supabase.from("company_roles").select("code, label_en").order("sort_order"),
  ]);

  return (
    <div className="max-w-2xl">
      <Link href="/clients" className="text-[12.5px] text-[var(--muted)] hover:text-ink">← {t("nav.clients")}</Link>
      <h1 className="text-[26px] font-semibold text-ink tracking-tight mt-2">{t("action.new_client")}</h1>
      <p className="text-[13px] text-[var(--muted)] mb-8">A CLI-xxxx code will be assigned automatically.</p>

      <ClientForm
        mode="create"
        partners={(partners as Pick<Partner, "id" | "name" | "code">[]) ?? []}
        existingCompanies={(companies as Array<{ id: string; code: string; name: string }>) ?? []}
        roles={(roles as Array<{ code: string; label_en: string }>) ?? []}
        action={createClientAction}
      />
    </div>
  );
}
