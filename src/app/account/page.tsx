export const revalidate = 0;

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccountForm } from "./AccountForm";

export default async function AccountPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div>
      <h1 className="font-serif text-[28px] leading-tight text-ink tracking-tight mb-1">Account</h1>
      <p className="text-[13px] text-[var(--muted)] mb-6">Your sign-in details.</p>

      <AccountForm email={user.email ?? ""} />
    </div>
  );
}
