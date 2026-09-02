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

type CompanyLinkRow =
  | { kind: "existing"; company_id: string; role: string }
  | { kind: "new"; name: string; role: string };

function parseCompanies(fd: FormData): CompanyLinkRow[] {
  const raw = String(fd.get("companies_json") ?? "").trim();
  if (!raw) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error("Could not read the companies list."); }
  if (!Array.isArray(parsed)) return [];
  const out: CompanyLinkRow[] = [];
  for (const [i, r] of parsed.entries()) {
    if (!r || typeof r !== "object") continue;
    const row = r as Record<string, unknown>;
    const role = String(row.role ?? "").trim();
    if (!role) throw new Error(`Company #${i + 1}: role is required.`);
    if (row.kind === "existing") {
      const company_id = String(row.company_id ?? "").trim();
      if (!company_id) throw new Error(`Company #${i + 1}: pick a company.`);
      out.push({ kind: "existing", company_id, role });
    } else {
      const name = String(row.name ?? "").trim();
      if (!name) throw new Error(`Company #${i + 1}: company name is required.`);
      out.push({ kind: "new", name, role });
    }
  }
  return out;
}

export async function createClientAction(fd: FormData) {
  const { supabase, actorId } = await requireUser();
  const payload = parseForm(fd);
  if (!payload.passport_no) throw new Error("Passport number is required.");
  const companies = parseCompanies(fd);

  const { data: client, error } = await supabase
    .from("clients")
    .insert({ ...payload, created_by: actorId, updated_by: actorId })
    .select("id")
    .single();
  if (error) throw new Error(humanizeSupabaseError(error.message));

  const links: Array<{ client_id: string; company_id: string; role: string }> = [];
  try {
    for (const co of companies) {
      let companyId: string;
      if (co.kind === "existing") {
        companyId = co.company_id;
      } else {
        const { data: newCompany, error: coErr } = await supabase
          .from("companies")
          .insert({ name: co.name, created_by: actorId, updated_by: actorId })
          .select("id")
          .single();
        if (coErr) throw new Error(coErr.message);
        companyId = newCompany.id;
      }
      links.push({ client_id: client.id, company_id: companyId, role: co.role });
    }
    if (links.length > 0) {
      const { error: linkErr } = await supabase.from("client_companies").insert(links);
      if (linkErr) throw new Error(linkErr.message);
    }
  } catch (e) {
    await supabase.from("clients").delete().eq("id", client.id);
    throw e;
  }

  revalidatePath("/clients");
  redirect(`/clients/${client.id}`);
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
