"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { ensurePtPrefix } from "@/lib/companyName";

async function requireUser() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const { t } = await getT();
    throw new Error(t("err.not_signed_in"));
  }
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
  drive_folder_url: string | null;
  notes: string | null;
  introduced_by_partner_id: string | null;
};

async function parseForm(fd: FormData): Promise<CompanyPayload> {
  const raw = String(fd.get("name") ?? "").trim();
  if (!raw) { const { t } = await getT(); throw new Error(t("err.company_name_required")); }
  const name = ensurePtPrefix(raw);
  return {
    name,
    nib: str(fd, "nib"),
    incorporation_date: str(fd, "incorporation_date"),
    address: str(fd, "address"),
    drive_folder_url: str(fd, "drive_folder_url"),
    notes: str(fd, "notes"),
    introduced_by_partner_id: str(fd, "introduced_by_partner_id"),
  };
}

function normalizePassport(v: string | null): string | null {
  return v ? v.replace(/\s+/g, "").toUpperCase() : null;
}

type PeopleRow =
  | { kind: "existing"; client_id: string; role: string }
  | { kind: "new"; full_name: string; passport_no: string; nationality: string | null; role: string };

function parsePeople(fd: FormData): PeopleRow[] {
  const raw = String(fd.get("people_json") ?? "").trim();
  if (!raw) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error("Could not read the people list."); }
  if (!Array.isArray(parsed)) return [];
  const out: PeopleRow[] = [];
  for (const [i, r] of parsed.entries()) {
    if (!r || typeof r !== "object") continue;
    const row = r as Record<string, unknown>;
    const role = String(row.role ?? "").trim();
    if (!role) throw new Error(`Person #${i + 1}: role is required.`);
    if (row.kind === "existing") {
      const client_id = String(row.client_id ?? "").trim();
      if (!client_id) throw new Error(`Person #${i + 1}: pick a client.`);
      out.push({ kind: "existing", client_id, role });
    } else {
      const full_name = String(row.full_name ?? "").trim();
      const passport_no = normalizePassport(String(row.passport_no ?? "").trim() || null) ?? "";
      if (!full_name) throw new Error(`Person #${i + 1}: full name is required.`);
      if (!passport_no) throw new Error(`Person #${i + 1}: passport number is required.`);
      const nationality = String(row.nationality ?? "").trim() || null;
      out.push({ kind: "new", full_name, passport_no, nationality, role });
    }
  }
  return out;
}

async function humanizePeopleError(msg: string): Promise<string> {
  if (msg.includes("clients_passport_unique")) {
    const { t } = await getT();
    return t("err.person_passport_duplicate");
  }
  return msg;
}

export async function createCompanyAction(fd: FormData) {
  const { supabase, actorId } = await requireUser();
  const payload = await parseForm(fd);
  const people = parsePeople(fd);

  if (payload.name) {
    const { data: dupe } = await supabase
      .from("companies")
      .select("code, name")
      .ilike("name", payload.name.trim())
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    if (dupe) throw new Error(`A company named "${dupe.name}" already exists (${dupe.code}).`);
  }

  const { data: company, error: companyErr } = await supabase
    .from("companies")
    .insert({ ...payload, created_by: actorId, updated_by: actorId })
    .select("id")
    .single();
  if (companyErr) throw new Error(companyErr.message);

  // Create any new clients, then link everyone to the company with their role.
  // If any step fails, delete the company we just created so we don't leave orphans.
  const links: Array<{ client_id: string; company_id: string; role: string }> = [];

  try {
    for (const p of people) {
      let clientId: string;
      if (p.kind === "existing") {
        clientId = p.client_id;
      } else {
        const { data: dupeCli } = await supabase
          .from("clients")
          .select("id, code, full_name")
          .ilike("full_name", p.full_name.trim())
          .is("deleted_at", null)
          .limit(1)
          .maybeSingle();
        if (dupeCli) throw new Error(`A client named "${dupeCli.full_name}" already exists (${dupeCli.code}). Pick them from the existing list instead.`);
        const { data: newClient, error: clientErr } = await supabase
          .from("clients")
          .insert({
            full_name: p.full_name,
            passport_no: p.passport_no,
            nationality: p.nationality,
            preferred_channel: "whatsapp",
            introduced_by_partner_id: null,
            created_by: actorId,
            updated_by: actorId,
          })
          .select("id")
          .single();
        if (clientErr) throw new Error(await humanizePeopleError(clientErr.message));
        clientId = newClient.id;
      }
      links.push({ client_id: clientId, company_id: company.id, role: p.role });
    }

    if (links.length > 0) {
      const { error: linkErr } = await supabase.from("client_companies").insert(links);
      if (linkErr) throw new Error(linkErr.message);
    }
  } catch (e) {
    await supabase.from("companies").delete().eq("id", company.id);
    throw e;
  }

  revalidatePath("/companies");
  redirect(`/companies/${company.id}`);
}

export async function updateCompanyAction(fd: FormData) {
  const { supabase, actorId } = await requireUser();
  const id = String(fd.get("id") ?? "");
  if (!id) { const { t } = await getT(); throw new Error(t("err.missing_id")); }
  const payload = await parseForm(fd);

  if (payload.name) {
    const { data: dupe } = await supabase
      .from("companies")
      .select("code, name")
      .ilike("name", payload.name.trim())
      .is("deleted_at", null)
      .neq("id", id)
      .limit(1)
      .maybeSingle();
    if (dupe) throw new Error(`A company named "${dupe.name}" already exists (${dupe.code}).`);
  }

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
  if (!id) { const { t } = await getT(); throw new Error(t("err.missing_id")); }

  const { error } = await supabase
    .from("companies")
    .update({ deleted_at: new Date().toISOString(), updated_by: actorId })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/companies");
  redirect("/companies");
}

/**
 * Nuke an archived company from the DB, along with its client links, its
 * (soft-deleted) subscriptions, and any (soft-deleted) cases. Refuses if
 * the row isn't already archived (soft-delete first as a safety gate), or
 * if it still has live cases / subscriptions attached — those need to be
 * archived on their own before the parent can go.
 */
export async function hardDeleteCompanyAction(fd: FormData) {
  const { supabase } = await requireUser();
  const id = String(fd.get("id") ?? "");
  if (!id) { const { t } = await getT(); throw new Error(t("err.missing_id")); }

  const { data: company, error: readErr } = await supabase
    .from("companies")
    .select("id, name, deleted_at")
    .eq("id", id)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);
  if (!company) throw new Error("Company not found.");
  if (!company.deleted_at) throw new Error("Archive the company first, then delete permanently.");

  // Block if there is still any live (non-soft-deleted) child data hanging
  // off it — permanent delete should only clean up after archive, not act
  // as a shortcut past archived-state safety.
  const { count: liveSubs } = await supabase
    .from("entity_services")
    .select("id", { count: "exact", head: true })
    .eq("company_id", id)
    .is("deleted_at", null);
  if ((liveSubs ?? 0) > 0) throw new Error("This company still has active subscriptions — archive or delete those first.");

  const { count: liveCases } = await supabase
    .from("cases")
    .select("id", { count: "exact", head: true })
    .eq("company_id", id)
    .is("deleted_at", null);
  if ((liveCases ?? 0) > 0) throw new Error("This company still has active cases — archive or delete those first.");

  // Sweep the leftovers: client-company links, historical soft-deleted
  // subscriptions, and soft-deleted cases. Do them in dependent order so
  // no FK check catches a still-referenced row.
  await supabase.from("client_companies").delete().eq("company_id", id);
  await supabase.from("entity_services").delete().eq("company_id", id);
  await supabase.from("cases").delete().eq("company_id", id);

  const { error: delErr } = await supabase.from("companies").delete().eq("id", id);
  if (delErr) throw new Error(delErr.message);

  revalidatePath("/companies");
  redirect("/companies");
}

export async function restoreCompanyAction(fd: FormData) {
  const { supabase, actorId } = await requireUser();
  const id = String(fd.get("id") ?? "");
  if (!id) { const { t } = await getT(); throw new Error(t("err.missing_id")); }

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
