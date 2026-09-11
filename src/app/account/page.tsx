export const revalidate = 0;

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccountForm } from "./AccountForm";

export default async function AccountPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // Middleware already gates this route, but a defensive check here keeps
  // the render logic simple — no user, no page.
  if (!user) redirect("/login");

  return (
    <div className="max-w-[1200px]">
      <Link href="/" className="inline-flex items-center gap-1 text-[12.5px] text-[var(--muted)] hover:text-ink mb-3">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Back
      </Link>
      <h1 className="font-serif text-[28px] leading-tight text-ink tracking-tight mb-1">Account</h1>
      <p className="text-[13px] text-[var(--muted)] mb-6">Your sign-in details.</p>

      <AccountForm email={user.email ?? ""} />
    </div>
  );
}
