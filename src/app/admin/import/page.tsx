import { createClient } from "@/lib/supabase/server";
import { ImportTabs } from "./ImportTabs";

export default async function ImportPage() {
  const supabase = createClient();

  // Data for the "Bulk open cases" tab. Kept minimal — the tab only needs
  // to render pickers, and the server action does its own auth + inserts.
  const [{ data: services }, { data: companies }, { data: clients }, { data: users }] = await Promise.all([
    supabase.from("service_types").select("id, code, name").eq("is_active", true).order("name"),
    supabase.from("companies").select("id, code, name").is("deleted_at", null).order("name").limit(1000),
    supabase.from("clients").select("id, code, full_name").is("deleted_at", null).order("full_name").limit(1000),
    supabase.from("users").select("id, full_name").eq("is_active", true).order("full_name"),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-[26px] text-ink">Import &amp; bulk actions</h1>
        <p className="text-[var(--muted)] mt-1 max-w-2xl">
          Bulk-load companies or clients from a spreadsheet, or open the same
          case on many targets at once — for a virtual office renewal across
          all its member companies, for example.
        </p>
      </div>
      <ImportTabs
        services={(services as Array<{ id: string; code: string; name: string }>) ?? []}
        companies={(companies as Array<{ id: string; code: string; name: string }>) ?? []}
        clients={(clients as Array<{ id: string; code: string; full_name: string }>) ?? []}
        users={(users as Array<{ id: string; full_name: string }>) ?? []}
      />
    </div>
  );
}
