"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { VirtualOfficeTier, VirtualOfficeStatus } from "@/lib/types";

const TIERS: VirtualOfficeTier[] = ["silver", "gold", "platinum"];
const STATUSES: VirtualOfficeStatus[] = ["active", "expired", "terminated"];

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
function int(fd: FormData, key: string, fallback: number): number {
  const n = Number(fd.get(key));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

type VOPayload = {
  company_id: string;
  tier: VirtualOfficeTier;
  term_months: number;
  start_date: string | null;
  end_date: string;
  pic_name: string | null;
  pic_phone: string | null;
  status: VirtualOfficeStatus;
  notes: string | null;
  drive_folder_url: string | null;
  responsible_partner_id: string | null;
};

function parseForm(fd: FormData): VOPayload {
  const company_id = str(fd, "company_id");
  if (!company_id) throw new Error("Company is required.");

  const tier = String(fd.get("tier") ?? "silver") as VirtualOfficeTier;
  if (!TIERS.includes(tier)) throw new Error("Invalid tier.");

  const status = String(fd.get("status") ?? "active") as VirtualOfficeStatus;
  if (!STATUSES.includes(status)) throw new Error("Invalid status.");

  const end_date = str(fd, "end_date");
  if (!end_date) throw new Error("End date is required.");

  return {
    company_id,
    tier,
    term_months: int(fd, "term_months", 12),
    start_date: str(fd, "start_date"),
    end_date,
    pic_name: str(fd, "pic_name"),
    pic_phone: str(fd, "pic_phone"),
    status,
    notes: str(fd, "notes"),
    drive_folder_url: str(fd, "drive_folder_url"),
    responsible_partner_id: str(fd, "responsible_partner_id"),
  };
}

export async function createVirtualOfficeAction(fd: FormData) {
  const { supabase, actorId } = await requireUser();
  const payload = parseForm(fd);

  const { error } = await supabase
    .from("virtual_offices")
    .insert({ ...payload, created_by: actorId, updated_by: actorId });
  if (error) throw new Error(error.message);

  revalidatePath(`/companies/${payload.company_id}`);
  revalidatePath("/virtual-offices");
}

export async function updateVirtualOfficeAction(fd: FormData) {
  const { supabase, actorId } = await requireUser();
  const id = String(fd.get("id") ?? "");
  if (!id) throw new Error("Missing virtual office id.");
  const payload = parseForm(fd);

  const { error } = await supabase
    .from("virtual_offices")
    .update({ ...payload, updated_by: actorId })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/companies/${payload.company_id}`);
  revalidatePath("/virtual-offices");
}

/** Renew: mark the current VO expired, open a fresh row for the next term.
 *  Dates advance by term_months from the old end_date. PIC and tier carry
 *  over — edit afterwards if the contract changed. */
export async function renewVirtualOfficeAction(fd: FormData) {
  const { supabase, actorId } = await requireUser();
  const id = String(fd.get("id") ?? "");
  if (!id) throw new Error("Missing virtual office id.");

  const { data: current, error: fetchError } = await supabase
    .from("virtual_offices")
    .select("company_id, tier, term_months, end_date, pic_name, pic_phone, drive_folder_url, responsible_partner_id")
    .eq("id", id)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  // Successor starts the day the previous tenancy ended so renewals of a
  // still-active row are seamless. If the previous tenancy already expired
  // (end_date in the past), start today instead — otherwise the fresh row
  // would land in the past and immediately auto-expire.
  const todayIso = new Date().toISOString().slice(0, 10);
  const newStart = current.end_date < todayIso ? todayIso : current.end_date;
  const d = new Date(newStart + "T00:00:00");
  d.setMonth(d.getMonth() + current.term_months);
  const newEnd = d.toISOString().slice(0, 10);

  const { error: expireError } = await supabase
    .from("virtual_offices")
    .update({ status: "expired", updated_by: actorId })
    .eq("id", id);
  if (expireError) throw new Error(expireError.message);

  const { error: insertError } = await supabase.from("virtual_offices").insert({
    company_id: current.company_id,
    tier: current.tier,
    term_months: current.term_months,
    start_date: newStart,
    end_date: newEnd,
    pic_name: current.pic_name,
    pic_phone: current.pic_phone,
    drive_folder_url: current.drive_folder_url,
    responsible_partner_id: current.responsible_partner_id,
    status: "active",
    created_by: actorId,
    updated_by: actorId,
  });
  if (insertError) throw new Error(insertError.message);

  revalidatePath(`/companies/${current.company_id}`);
  revalidatePath("/virtual-offices");
}

export async function terminateVirtualOfficeAction(fd: FormData) {
  const { supabase, actorId } = await requireUser();
  const id = String(fd.get("id") ?? "");
  if (!id) throw new Error("Missing virtual office id.");

  const { data: row } = await supabase
    .from("virtual_offices")
    .select("company_id")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("virtual_offices")
    .update({ status: "terminated", updated_by: actorId })
    .eq("id", id);
  if (error) throw new Error(error.message);

  if (row?.company_id) revalidatePath(`/companies/${row.company_id}`);
  revalidatePath("/virtual-offices");
}

export async function archiveVirtualOfficeAction(fd: FormData) {
  const { supabase, actorId } = await requireUser();
  const id = String(fd.get("id") ?? "");
  if (!id) throw new Error("Missing virtual office id.");

  const { data: row } = await supabase
    .from("virtual_offices")
    .select("company_id")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("virtual_offices")
    .update({ deleted_at: new Date().toISOString(), updated_by: actorId })
    .eq("id", id);
  if (error) throw new Error(error.message);

  if (row?.company_id) revalidatePath(`/companies/${row.company_id}`);
  revalidatePath("/virtual-offices");
}
