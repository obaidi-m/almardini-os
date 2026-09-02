import { createClient } from "@/lib/supabase/server";
import { CompanyRoleRow } from "./CompanyRoleRow";
import { NewCompanyRoleForm } from "./NewCompanyRoleForm";

export type CompanyRoleRecord = {
  code: string;
  label_en: string;
  label_id: string | null;
  sort_order: number;
};

export default async function CompanyRolesAdminPage() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("company_roles")
    .select("code, label_en, label_id, sort_order")
    .order("sort_order");

  const rows = (data as CompanyRoleRecord[]) ?? [];

  return (
    <div className="max-w-3xl">
      <h1 className="text-[26px] font-semibold text-ink tracking-tight">Company roles</h1>
      <p className="text-[13px] text-[var(--muted)] mb-6">
        Positions a client can hold on a company (Direktur, Komisaris, etc.). Editable here.
        A role that&apos;s still assigned to at least one client cannot be deleted.
      </p>

      {error && (
        <div className="text-[12.5px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">
          {error.message}
        </div>
      )}

      <div className="mb-6">
        <div className="grid grid-cols-[1fr_1fr_150px_100px] gap-4 px-2 pb-2 text-[11px] uppercase tracking-wide text-[var(--muted)] font-medium border-b border-[var(--border)]">
          <div>English label</div>
          <div>Indonesian label</div>
          <div>Code</div>
          <div className="text-right">Actions</div>
        </div>
        {rows.length === 0 && (
          <div className="py-8 text-center text-[13px] text-[var(--muted)]">No roles yet.</div>
        )}
        {rows.map((r) => <CompanyRoleRow key={r.code} role={r} />)}
      </div>

      <div className="border-t border-[var(--border)] pt-6">
        <div className="text-[11px] uppercase tracking-widest text-[var(--muted)] font-semibold mb-3">
          Add a role
        </div>
        <NewCompanyRoleForm />
      </div>
    </div>
  );
}
