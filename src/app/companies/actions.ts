"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";

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
};

async function parseForm(fd: FormData): Promise<CompanyPayload> {
  const name = String(fd.get("name") ?? "").trim();
  if (!name) { const { t } = await getT(); throw new Error(t("err.company_name_required")); }
  return {
    name,
    nib: str(fd, "nib"),
    incorporation_date: str(fd, "incorporation_date"),
    address: str(fd, "address"),
    drive_folder_url: str(fd, "drive_folder_url"),
    notes: str(fd, "notes"),
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
