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

/** Roll a subscription or permit into its next cycle. Two writes in order:
 *  the old row is marked `expired` (kept as historical record), and a fresh
 *  row is inserted with `active` status carrying the new dates. The service
 *  itself, tier, sponsor, responsible partner, folder link are all copied so
 *  the operator only types what changed (the new expiry) and optionally a
 *  cycle-specific note.
 *
 *  Payload:
 *    id            — the old row (required)
 *    started_date  — when the new cycle begins (defaults to old expiry)
 *    expires_date  — when the new cycle ends (required)
 *    notes         — optional, for the new cycle only. Not copied. */
export async function renewEntityServiceAction(fd: FormData) {
  const { supabase, actorId } = await requireUser();
  const id = s(fd, "id");
  if (!id) throw new Error("Missing id.");
  const newExpiry = d(fd, "expires_date");
  if (!newExpiry) throw new Error("New expiry date is required.");

  const { data: old, error: fetchError } = await supabase
    .from("entity_services")
    .select(
      "id, service_id, client_id, company_id, tier, term_months, sponsor_company_id, responsible_partner_id, drive_folder_url, expires_date, status",
    )
    .eq("id", id)
    .single();
  if (fetchError) throw new Error(fetchError.message);
  if (!old) throw new Error("Row not found.");
  if (old.status !== "active") {
    throw new Error("Only active rows can be renewed.");
  }

  const newStart = d(fd, "started_date") ?? old.expires_date ?? new Date().toISOString().slice(0, 10);

  const { error: expireError } = await supabase
    .from("entity_services")
    .update({ status: "expired" as const })
    .eq("id", id);
  if (expireError) throw new Error(expireError.message);

  const { error: insertError } = await supabase.from("entity_services").insert({
    service_id: old.service_id,
    client_id:  old.client_id,
    company_id: old.company_id,
    status: "active" as const,
    started_date: newStart,
    expires_date: newExpiry,
    tier: old.tier,
    term_months: old.term_months,
    sponsor_company_id: old.sponsor_company_id,
    responsible_partner_id: old.responsible_partner_id,
    drive_folder_url: old.drive_folder_url,
    notes: s(fd, "notes"),
    created_by: actorId,
  });
  if (insertError) {
    // Try to roll the old row back so we don't strand it as `expired` with
    // no successor. Best-effort — if this fails too the operator will see a
    // stale expired row they can fix manually.
    await supabase
      .from("entity_services")
      .update({ status: "active" as const })
      .eq("id", id);
    throw new Error(insertError.message);
  }

  if (old.client_id)  revalidatePath(`/clients/${old.client_id}`);
  if (old.company_id) revalidatePath(`/companies/${old.company_id}`);
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
