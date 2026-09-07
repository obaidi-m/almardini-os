import Link from "next/link";
import { PartnerForm } from "../PartnerForm";
import { createPartnerAction } from "../actions";
import { getT } from "@/lib/i18n/server";

export default async function NewPartnerPage() {
  const { t } = await getT();
  return (
    <div className="max-w-2xl">
      <Link href="/partners" className="text-[12.5px] text-[var(--muted)] hover:text-ink">← {t("nav.partners")}</Link>
      <h1 className="text-[26px] font-semibold text-ink tracking-tight mt-2">{t("action.new_partner")}</h1>
      <p className="text-[13px] text-[var(--muted)] mb-8">A PRT-xxxx code will be assigned automatically.</p>

      <PartnerForm mode="create" action={createPartnerAction} />
    </div>
  );
}
