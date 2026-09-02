"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function requireUser() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  return { supabase, actorId: user.id };
}

function str(fd: FormData, key: string): string | null {
  const v = String(fd.get(key) ?? "").trim();
  return v === "" ? null : v;
}

type CompanyPayload = {
  name: string;
  nib: string | null;
  incorporation_date: string | null;
  address: string | null;
  license_expires_at: string | null;
  drive_folder_url: string | null;
  notes: string | null;
};

function parseForm(fd: FormData): CompanyPayload {
  const name = String(fd.get("name") ?? "").trim();
  if (!name) throw new Error("Company name is required.");
  return {
    name,
    nib: str(fd, "nib"),
    incorporation_date: str(fd, "incorporation_date"),
    address: str(fd, "address"),
    license_expires_at: str(fd, "license_expires_at"),
    drive_folder_url: str(fd, "drive_folder_url"),
    notes: str(fd, "notes"),
  };
}

export async function createCompanyAction(fd: FormData) {
  const { supabase, actorId } = await requireUser();
  const payload = parseForm(fd);

  const { data, error } = await supabase
    .from("companies")
    .insert({ ...payload, created_by: actorId, updated_by: actorId })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/companies");
  redirect(`/companies/${data.id}`);
}

export async function updateCompanyAction(fd: FormData) {
  const { supabase, actorId } = await requireUser();
  const id = String(fd.get("id") ?? "");
  if (!id) throw new Error("Missing company id.");
  const payload = parseForm(fd);

  const { error } = await supabase
    .from("companies")
    .update({ ...payload, updated_by: actorId })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/companies");
  revalidatePath(`/companies/${id}`);
}

export async function softDeleteCompanyAction(fd: FormData) {
  const { supabase, actorId } = await requireUser();
  const id = String(fd.get("id") ?? "");
  if (!id) throw new Error("Missing company id.");

  const { error } = await supabase
    .from("companies")
    .update({ deleted_at: new Date().toISOString(), updated_by: actorId })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/companies");
  redirect("/companies");
}

export async function restoreCompanyAction(fd: FormData) {
  const { supabase, actorId } = await requireUser();
  const id = String(fd.get("id") ?? "");
  if (!id) throw new Error("Missing company id.");

  const { error } = await supabase
    .from("companies")
    .update({ deleted_at: null, updated_by: actorId })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/companies");
  revalidatePath(`/companies/${id}`);
}

// -----------------------------------------------------------------------
// Client ↔ Company links
// -----------------------------------------------------------------------

export async function linkClientToCompanyAction(fd: FormData) {
  const { supabase } = await requireUser();
  const client_id = String(fd.get("client_id") ?? "");
  const company_id = String(fd.get("company_id") ?? "");
  const role = String(fd.get("role") ?? "").trim();

  if (!client_id) throw new Error("Missing client.");
  if (!company_id) throw new Error("Missing company.");
  if (!role) throw new Error("Missing role.");

  const { error } = await supabase
    .from("client_companies")
    .insert({ client_id, company_id, role });
  if (error) {
    if (error.message.includes("duplicate")) {
      throw new Error("That client is already linked to this company with that role.");
    }
    throw new Error(error.message);
  }

  revalidatePath(`/clients/${client_id}`);
  revalidatePath(`/companies/${company_id}`);
}

export async function unlinkClientFromCompanyAction(fd: FormData) {
  const { supabase } = await requireUser();
  const client_id = String(fd.get("client_id") ?? "");
  const company_id = String(fd.get("company_id") ?? "");
  const role = String(fd.get("role") ?? "").trim();
  if (!client_id || !company_id || !role) throw new Error("Missing fields.");

  const { error } = await supabase
    .from("client_companies")
    .delete()
    .match({ client_id, company_id, role });
  if (error) throw new Error(error.message);

  revalidatePath(`/clients/${client_id}`);
  revalidatePath(`/companies/${company_id}`);
}
