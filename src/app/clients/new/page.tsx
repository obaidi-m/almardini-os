import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ClientForm } from "../ClientForm";
import { createClientAction } from "../actions";
import type { Partner } from "@/lib/types";

export default async function NewClientPage() {
  const supabase = createClient();
  const { data: partners } = await supabase
    .from("partners")
    .select("id, name, code")
    .is("deleted_at", null)
    .order("name");

  return (
    <div className="max-w-2xl">
      <Link href="/clients" className="text-[12.5px] text-[var(--muted)] hover:text-ink">← Clients</Link>
      <h1 className="text-[26px] font-semibold text-ink tracking-tight mt-2">New client</h1>
      <p className="text-[13px] text-[var(--muted)] mb-8">A CLI-xxxx code will be assigned automatically.</p>

      <ClientForm
        mode="create"
        partners={(partners as Pick<Partner, "id" | "name" | "code">[]) ?? []}
        action={createClientAction}
      />
    </div>
  );
}
