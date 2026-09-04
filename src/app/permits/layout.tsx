import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopBanner } from "@/components/admin/TopBanner";
import { OpsSidebar } from "@/components/app/OpsSidebar";

export default async function PermitsLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("users")
    .select("full_name, email, role:roles(code, name)")
    .eq("id", user.id)
    .single();

  const roleCode = (me?.role as { code?: string } | null)?.code;

  return (
    <div>
      <TopBanner />
      <div className="grid grid-cols-[240px_1fr]">
        <OpsSidebar
          userName={me?.full_name || user.email || "User"}
          userEmail={me?.email || user.email || ""}
          isOwner={roleCode === "owner"}
        />
        <main className="p-8 max-w-[1400px] w-full">{children}</main>
      </div>
    </div>
  );
}
