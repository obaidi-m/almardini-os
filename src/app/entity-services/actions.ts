"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function requireUser() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  return { supabase, actorId: user.id };
}

function s(fd: FormData, k: string): string | null {
  const v = String(fd.get(k) ?? "").trim();
  return v ? v : null;
}
function d(fd: FormData, k: string): string | null {
  const v = s(fd, k);
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}
function n(fd: FormData, k: string): number | null {
  const v = s(fd, k);
  if (!v) return null;
  const num = Number(v);
  return Number.isFinite(num) ? Math.trunc(num) : null;
}

const STATUSES = ["active", "expired", "terminated", "paused"] as const;
type Status = (typeof STATUSES)[number];
function status(fd: FormData): Status {
  const v = s(fd, "status") ?? "active";
  return (STATUSES as readonly string[]).includes(v) ? (v as Status) : "active";
}

export async function createEntityServiceAction(fd: FormData) {
  const { supabase, actorId } = await requireUser();

  const service_id = s(fd, "service_id");
  const client_id  = s(fd, "client_id");
  const company_id = s(fd, "company_id");
  if (!service_id) throw new Error("Pick a service.");
  if (!!client_id === !!company_id) {
    throw new Error("A subscription must belong to exactly one client or one company.");
  }

  const payload = {
    service_id,
    client_id,
    company_id,
    status: status(fd),
    started_date: d(fd, "started_date"),
    issued_date:  d(fd, "issued_date"),
    expires_date: d(fd, "expires_date"),
    tier:         s(fd, "tier"),
    term_months:  n(fd, "term_months"),
    sponsor_company_id:     s(fd, "sponsor_company_id"),
    responsible_partner_id: s(fd, "responsible_partner_id"),
    drive_folder_url: s(fd, "drive_folder_url"),
    notes: s(fd, "notes"),
    created_by: actorId,
  };

  const { error } = await supabase.from("entity_services").insert(payload);
  if (error) throw new Error(error.message);

  if (client_id)  revalidatePath(`/clients/${client_id}`);
  if (company_id) revalidatePath(`/companies/${company_id}`);
}

export async function updateEntityServiceAction(fd: FormData) {
  const { supabase } = await requireUser();
  const id = s(fd, "id");
  if (!id) throw new Error("Missing id.");

  const patch = {
    status: status(fd),
    started_date: d(fd, "started_date"),
    issued_date:  d(fd, "issued_date"),
    expires_date: d(fd, "expires_date"),
    tier:         s(fd, "tier"),
    term_months:  n(fd, "term_months"),
    sponsor_company_id:     s(fd, "sponsor_company_id"),
    responsible_partner_id: s(fd, "responsible_partner_id"),
    drive_folder_url: s(fd, "drive_folder_url"),
    notes: s(fd, "notes"),
  };

  const { data, error } = await supabase
    .from("entity_services")
    .update(patch)
    .eq("id", id)
    .select("client_id, company_id")
    .maybeSingle();
  if (error) throw new Error(error.message);

  if (data?.client_id)  revalidatePath(`/clients/${data.client_id}`);
  if (data?.company_id) revalidatePath(`/companies/${data.company_id}`);
}

export async function deleteEntityServiceAction(fd: FormData) {
  const { supabase } = await requireUser();
  const id = s(fd, "id");
  if (!id) throw new Error("Missing id.");

  const { data, error } = await supabase
    .from("entity_services")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .select("client_id, company_id")
    .maybeSingle();
  if (error) throw new Error(error.message);

  if (data?.client_id)  revalidatePath(`/clients/${data.client_id}`);
  if (data?.company_id) revalidatePath(`/companies/${data.company_id}`);
}
