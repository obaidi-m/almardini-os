import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopBanner } from "@/components/admin/TopBanner";
import { Sidebar } from "@/components/admin/Sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Load the user's row + role
  const { data: me } = await supabase
    .from("users")
    .select("full_name, email, role:roles(code, name)")
    .eq("id", user.id)
    .single();

  // Only owners can access the admin panel for now.
  // Later we can broaden to "users.invite" permission etc.
  const roleCode = (me?.role as { code?: string } | null)?.code;
  if (roleCode !== "owner") {
    redirect("/"); // /admin is for owners only
  }

  return (
    <div>
      <TopBanner />
      <div className="grid grid-cols-[240px_1fr]">
        <Sidebar userName={me?.full_name || user.email || "User"} userEmail={me?.email || user.email || ""} />
        <main className="p-8 max-w-[1200px] w-full">{children}</main>
      </div>
    </div>
  );
}
