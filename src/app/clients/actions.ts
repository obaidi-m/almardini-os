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

function normalizePassport(v: string | null): string | null {
  return v ? v.replace(/\s+/g, "").toUpperCase() : null;
}

type ClientPayload = {
  full_name: string;
  nationality: string | null;
  passport_no: string | null;
  passport_expires_at: string | null;
  date_of_birth: string | null;
  place_of_birth: string | null;
  phone: string | null;
  email: string | null;
  preferred_channel: "whatsapp" | "email";
  introduced_by_partner_id: string | null;
  drive_folder_url: string | null;
  notes: string | null;
};

function parseForm(fd: FormData): ClientPayload {
  const full_name = String(fd.get("full_name") ?? "").trim();
  if (!full_name) throw new Error("Full name is required.");
  const preferred = String(fd.get("preferred_channel") ?? "whatsapp");
  if (preferred !== "whatsapp" && preferred !== "email") {
    throw new Error("Preferred channel must be whatsapp or email.");
  }
  return {
    full_name,
    nationality: str(fd, "nationality"),
    passport_no: normalizePassport(str(fd, "passport_no")),
    passport_expires_at: str(fd, "passport_expires_at"),
    date_of_birth: str(fd, "date_of_birth"),
    place_of_birth: str(fd, "place_of_birth"),
    phone: str(fd, "phone"),
    email: str(fd, "email")?.toLowerCase() ?? null,
    preferred_channel: preferred,
    introduced_by_partner_id: str(fd, "introduced_by_partner_id"),
    drive_folder_url: str(fd, "drive_folder_url"),
    notes: str(fd, "notes"),
  };
}

function humanizeSupabaseError(msg: string): string {
  if (msg.includes("clients_passport_unique")) {
    return "A client with this passport number already exists.";
  }
  return msg;
}

export async function createClientAction(fd: FormData) {
  const { supabase, actorId } = await requireUser();
  const payload = parseForm(fd);

  const { data, error } = await supabase
    .from("clients")
    .insert({ ...payload, created_by: actorId, updated_by: actorId })
    .select("id")
    .single();
  if (error) throw new Error(humanizeSupabaseError(error.message));

  revalidatePath("/clients");
  redirect(`/clients/${data.id}`);
}

export async function updateClientAction(fd: FormData) {
  const { supabase, actorId } = await requireUser();
  const id = String(fd.get("id") ?? "");
  if (!id) throw new Error("Missing client id.");
  const payload = parseForm(fd);

  const { error } = await supabase
    .from("clients")
    .update({ ...payload, updated_by: actorId })
    .eq("id", id);
  if (error) throw new Error(humanizeSupabaseError(error.message));

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
}

export async function softDeleteClientAction(fd: FormData) {
  const { supabase, actorId } = await requireUser();
  const id = String(fd.get("id") ?? "");
  if (!id) throw new Error("Missing client id.");

  const { error } = await supabase
    .from("clients")
    .update({ deleted_at: new Date().toISOString(), updated_by: actorId })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/clients");
  redirect("/clients");
}

export async function restoreClientAction(fd: FormData) {
  const { supabase, actorId } = await requireUser();
  const id = String(fd.get("id") ?? "");
  if (!id) throw new Error("Missing client id.");

  const { error } = await supabase
    .from("clients")
    .update({ deleted_at: null, updated_by: actorId })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
}

/** Soft-warn duplicate check: same name + nationality (case-insensitive), excluding a given id. */
export async function findSoftDuplicates(fullName: string, nationality: string | null, excludeId?: string) {
  const { supabase } = await requireUser();
  const trimmed = fullName.trim();
  if (!trimmed) return [];
  let q = supabase
    .from("clients")
    .select("id, code, full_name, nationality, passport_no")
    .is("deleted_at", null)
    .ilike("full_name", trimmed);
  if (nationality) q = q.eq("nationality", nationality);
  if (excludeId) q = q.neq("id", excludeId);
  const { data, error } = await q.limit(5);
  if (error) return [];
  return data ?? [];
}
