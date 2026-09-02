"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PartnerType } from "@/lib/types";

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

type PartnerPayload = {
  name: string;
  type: PartnerType;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

function parseForm(fd: FormData): PartnerPayload {
  const name = String(fd.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required.");
  const type = String(fd.get("type") ?? "");
  if (type !== "referrer" && type !== "agent" && type !== "both") {
    throw new Error("Type must be referrer, agent, or both.");
  }
  return {
    name,
    type,
    contact_person: str(fd, "contact_person"),
    phone: str(fd, "phone"),
    email: str(fd, "email")?.toLowerCase() ?? null,
    notes: str(fd, "notes"),
  };
}

export async function createPartnerAction(fd: FormData) {
  const { supabase, actorId } = await requireUser();
  const payload = parseForm(fd);

  const { data, error } = await supabase
    .from("partners")
    .insert({ ...payload, created_by: actorId, updated_by: actorId })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/partners");
  redirect(`/partners/${data.id}`);
}

export async function updatePartnerAction(fd: FormData) {
  const { supabase, actorId } = await requireUser();
  const id = String(fd.get("id") ?? "");
  if (!id) throw new Error("Missing partner id.");
  const payload = parseForm(fd);

  const { error } = await supabase
    .from("partners")
    .update({ ...payload, updated_by: actorId })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/partners");
  revalidatePath(`/partners/${id}`);
}

export async function softDeletePartnerAction(fd: FormData) {
  const { supabase, actorId } = await requireUser();
  const id = String(fd.get("id") ?? "");
  if (!id) throw new Error("Missing partner id.");

  const { error } = await supabase
    .from("partners")
    .update({ deleted_at: new Date().toISOString(), updated_by: actorId })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/partners");
  redirect("/partners");
}

export async function restorePartnerAction(fd: FormData) {
  const { supabase, actorId } = await requireUser();
  const id = String(fd.get("id") ?? "");
  if (!id) throw new Error("Missing partner id.");

  const { error } = await supabase
    .from("partners")
    .update({ deleted_at: null, updated_by: actorId })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/partners");
  revalidatePath(`/partners/${id}`);
}
