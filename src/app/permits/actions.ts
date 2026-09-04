"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { PermitStatus } from "@/lib/types";

const STATUSES: PermitStatus[] = ["active", "expired", "terminated"];

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

type Payload = {
  client_id: string;
  kind: string;
  reference_no: string | null;
  issued_date: string | null;
  expires_date: string;
  status: PermitStatus;
  sponsor_company_id: string | null;
  responsible_partner_id: string | null;
  notes: string | null;
  drive_folder_url: string | null;
};

function parseForm(fd: FormData): Payload {
  const client_id = str(fd, "client_id");
  if (!client_id) throw new Error("Client is required.");
  const kind = str(fd, "kind");
  if (!kind) throw new Error("Kind is required.");
  const expires_date = str(fd, "expires_date");
  if (!expires_date) throw new Error("Expires date is required.");
  const status = String(fd.get("status") ?? "active") as PermitStatus;
  if (!STATUSES.includes(status)) throw new Error("Invalid status.");
  return {
    client_id,
    kind,
    reference_no: str(fd, "reference_no"),
    issued_date: str(fd, "issued_date"),
    expires_date,
    status,
    sponsor_company_id: str(fd, "sponsor_company_id"),
    responsible_partner_id: str(fd, "responsible_partner_id"),
    notes: str(fd, "notes"),
    drive_folder_url: str(fd, "drive_folder_url"),
  };
}

export async function createPermitAction(fd: FormData) {
  const { supabase, actorId } = await requireUser();
  const payload = parseForm(fd);
  const { error } = await supabase
    .from("permits")
    .insert({ ...payload, created_by: actorId, updated_by: actorId });
  if (error) throw new Error(error.message);
  revalidatePath(`/clients/${payload.client_id}`);
  revalidatePath("/permits");
}

export async function updatePermitAction(fd: FormData) {
  const { supabase, actorId } = await requireUser();
  const id = String(fd.get("id") ?? "");
  if (!id) throw new Error("Missing permit id.");
  const payload = parseForm(fd);
  const { error } = await supabase
    .from("permits")
    .update({ ...payload, updated_by: actorId })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/clients/${payload.client_id}`);
  revalidatePath("/permits");
}

/** Renew: mark the current permit expired, open a fresh row starting today
 *  (or the day after the old expires_date if that's still in the future).
 *  Kind, sponsor, PJ, reference format all carry over — editable after. */
export async function renewPermitAction(fd: FormData) {
  const { supabase, actorId } = await requireUser();
  const id = String(fd.get("id") ?? "");
  if (!id) throw new Error("Missing permit id.");
  const durationMonths = Math.max(1, Math.floor(Number(fd.get("duration_months") ?? 12)));

  const { data: current, error: fetchError } = await supabase
    .from("permits")
    .select("client_id, kind, reference_no, expires_date, sponsor_company_id, responsible_partner_id, drive_folder_url")
    .eq("id", id)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const todayIso = new Date().toISOString().slice(0, 10);
  const newStart = current.expires_date < todayIso ? todayIso : current.expires_date;
  const d = new Date(newStart + "T00:00:00");
  d.setMonth(d.getMonth() + durationMonths);
  const newEnd = d.toISOString().slice(0, 10);

  const { error: expireError } = await supabase
    .from("permits")
    .update({ status: "expired", updated_by: actorId })
    .eq("id", id);
  if (expireError) throw new Error(expireError.message);

  const { error: insertError } = await supabase.from("permits").insert({
    client_id: current.client_id,
    kind: current.kind,
    reference_no: null,       // new document = new reference number
    issued_date: newStart,
    expires_date: newEnd,
    status: "active",
    sponsor_company_id: current.sponsor_company_id,
    responsible_partner_id: current.responsible_partner_id,
    drive_folder_url: current.drive_folder_url,
    created_by: actorId,
    updated_by: actorId,
  });
  if (insertError) throw new Error(insertError.message);

  revalidatePath(`/clients/${current.client_id}`);
  revalidatePath("/permits");
}

export async function terminatePermitAction(fd: FormData) {
  const { supabase, actorId } = await requireUser();
  const id = String(fd.get("id") ?? "");
  if (!id) throw new Error("Missing permit id.");
  const { data: row } = await supabase.from("permits").select("client_id").eq("id", id).single();
  const { error } = await supabase
    .from("permits")
    .update({ status: "terminated", updated_by: actorId })
    .eq("id", id);
  if (error) throw new Error(error.message);
  if (row?.client_id) revalidatePath(`/clients/${row.client_id}`);
  revalidatePath("/permits");
}

export async function archivePermitAction(fd: FormData) {
  const { supabase, actorId } = await requireUser();
  const id = String(fd.get("id") ?? "");
  if (!id) throw new Error("Missing permit id.");
  const { data: row } = await supabase.from("permits").select("client_id").eq("id", id).single();
  const { error } = await supabase
    .from("permits")
    .update({ deleted_at: new Date().toISOString(), updated_by: actorId })
    .eq("id", id);
  if (error) throw new Error(error.message);
  if (row?.client_id) revalidatePath(`/clients/${row.client_id}`);
  revalidatePath("/permits");
}
