import Link from "next/link";
import { CompanyForm } from "../CompanyForm";
import { createCompanyAction } from "../actions";

export default function NewCompanyPage() {
  return (
    <div className="max-w-2xl">
      <Link href="/companies" className="text-[12.5px] text-[var(--muted)] hover:text-ink">← Companies</Link>
      <h1 className="text-[26px] font-semibold text-ink tracking-tight mt-2">New company</h1>
      <p className="text-[13px] text-[var(--muted)] mb-8">A CMP-xxxx code will be assigned automatically.</p>

      <CompanyForm mode="create" action={createCompanyAction} />
    </div>
  );
}
