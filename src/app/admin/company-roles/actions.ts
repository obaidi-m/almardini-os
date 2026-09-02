"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function requireOwner() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data: me } = await supabase.from("users").select("role:roles(code)").eq("id", user.id).single();
  if ((me?.role as { code?: string } | null)?.code !== "owner") throw new Error("Owner only");
  return { supabase, actorId: user.id };
}

function slugCode(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export async function createCompanyRoleAction(fd: FormData) {
  const { supabase } = await requireOwner();
  const label_en = String(fd.get("label_en") ?? "").trim();
  const label_id = String(fd.get("label_id") ?? "").trim() || null;
  const rawCode = String(fd.get("code") ?? "").trim();
  const code = slugCode(rawCode || label_en);

  if (!label_en) throw new Error("English label is required.");
  if (!code) throw new Error("Code is required.");

  const { data: max } = await supabase
    .from("company_roles")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (max?.sort_order ?? 0) + 10;

  const { error } = await supabase
    .from("company_roles")
    .insert({ code, label_en, label_id, sort_order: nextOrder });
  if (error) {
    if (error.message.includes("duplicate")) throw new Error(`A role with code "${code}" already exists.`);
    throw new Error(error.message);
  }
  revalidatePath("/admin/company-roles");
}

export async function updateCompanyRoleAction(fd: FormData) {
  const { supabase } = await requireOwner();
  const code = String(fd.get("code") ?? "");
  const label_en = String(fd.get("label_en") ?? "").trim();
  const label_id = String(fd.get("label_id") ?? "").trim() || null;
  if (!code) throw new Error("Missing role.");
  if (!label_en) throw new Error("English label is required.");

  const { error } = await supabase
    .from("company_roles")
    .update({ label_en, label_id })
    .eq("code", code);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/company-roles");
}

export async function deleteCompanyRoleAction(fd: FormData) {
  const { supabase } = await requireOwner();
  const code = String(fd.get("code") ?? "");
  if (!code) throw new Error("Missing role.");

  const { error } = await supabase.from("company_roles").delete().eq("code", code);
  if (error) {
    if (error.code === "23503" || error.message.includes("foreign key")) {
      throw new Error("This role is still assigned to at least one client. Reassign those first.");
    }
    throw new Error(error.message);
  }
  revalidatePath("/admin/company-roles");
}
