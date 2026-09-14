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

function normalizePassport(v: string | null): string | null {
  return v ? v.replace(/\s+/g, "").toUpperCase() : null;
}

type ClientPayload = {
  full_name: string;
  nationality: string | null;
  passport_no: string | null;
  date_of_birth: string | null;
  place_of_birth: string | null;
  phone: string | null;
  email: string | null;
  preferred_channel: "whatsapp" | "email";
  introduced_by_partner_id: string | null;
  drive_folder_url: string | null;
  notes: string | null;
};

async function parseForm(fd: FormData): Promise<ClientPayload> {
  const { t } = await getT();
  const full_name = String(fd.get("full_name") ?? "").trim();
  if (!full_name) throw new Error(t("err.full_name_required"));
  const preferred = String(fd.get("preferred_channel") ?? "whatsapp");
  if (preferred !== "whatsapp" && preferred !== "email") {
    throw new Error(t("err.channel_invalid"));
  }
  return {
    full_name,
    nationality: str(fd, "nationality"),
    passport_no: normalizePassport(str(fd, "passport_no")),
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

async function humanizeSupabaseError(msg: string): Promise<string> {
  if (msg.includes("clients_passport_unique")) {
    const { t } = await getT();
    return t("err.passport_duplicate");
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

// Return { error } instead of throwing so the browser sees the real
// message. Next.js Server Actions strip thrown error messages in
// production ("digest: '...'"), which reduces every failure to a generic
// red box — bad for validation errors the operator can actually fix.
export async function createClientAction(fd: FormData): Promise<{ error?: string } | void> {
  let newClientId: string | null = null;
  try {
    const { supabase, actorId } = await requireUser();
    const payload = await parseForm(fd);
    const companies = parseCompanies(fd);

    if (payload.full_name) {
      const { data: dupe } = await supabase
        .from("clients")
        .select("code, full_name")
        .ilike("full_name", payload.full_name.trim())
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle();
      if (dupe) return { error: `A client named "${dupe.full_name}" already exists (${dupe.code}).` };
    }

    const { data: client, error } = await supabase
      .from("clients")
      .insert({ ...payload, created_by: actorId, updated_by: actorId })
      .select("id")
      .single();
    if (error) return { error: await humanizeSupabaseError(error.message) };
    newClientId = client.id;

    const links: Array<{ client_id: string; company_id: string; role: string }> = [];
    try {
      for (const co of companies) {
        let companyId: string;
        if (co.kind === "existing") {
          companyId = co.company_id;
        } else {
          const canonicalName = ensurePtPrefix(co.name);
          const { data: dupeCo } = await supabase
            .from("companies")
            .select("id, code, name")
            .ilike("name", canonicalName)
            .is("deleted_at", null)
            .limit(1)
            .maybeSingle();
          if (dupeCo) throw new Error(`A company named "${dupeCo.name}" already exists (${dupeCo.code}). Pick it from the existing list instead.`);
          const { data: newCompany, error: coErr } = await supabase
            .from("companies")
            .insert({ name: canonicalName, created_by: actorId, updated_by: actorId })
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
      newClientId = null;
      return { error: e instanceof Error ? e.message : "Failed to link companies." };
    }

    revalidatePath("/clients");
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
  // Redirect must run outside try/catch — Next signals it by throwing.
  if (newClientId) redirect(`/clients/${newClientId}`);
}

export async function updateClientAction(fd: FormData): Promise<{ error?: string } | void> {
  try {
    const { supabase, actorId } = await requireUser();
    const id = String(fd.get("id") ?? "");
    if (!id) { const { t } = await getT(); return { error: t("err.missing_id") }; }
    const payload = await parseForm(fd);

    if (payload.full_name) {
      const { data: dupe } = await supabase
        .from("clients")
        .select("code, full_name")
        .ilike("full_name", payload.full_name.trim())
        .is("deleted_at", null)
        .neq("id", id)
        .limit(1)
        .maybeSingle();
      if (dupe) return { error: `A client named "${dupe.full_name}" already exists (${dupe.code}).` };
    }

    const { error } = await supabase
      .from("clients")
      .update({ ...payload, updated_by: actorId })
      .eq("id", id);
    if (error) return { error: await humanizeSupabaseError(error.message) };

    revalidatePath("/clients");
    revalidatePath(`/clients/${id}`);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function softDeleteClientAction(fd: FormData) {
  const { supabase, actorId } = await requireUser();
  const id = String(fd.get("id") ?? "");
  if (!id) { const { t } = await getT(); throw new Error(t("err.missing_id")); }

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
  if (!id) { const { t } = await getT(); throw new Error(t("err.missing_id")); }

  const { error } = await supabase
    .from("clients")
    .update({ deleted_at: null, updated_by: actorId })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
}

/** Quick-create used by other pages (e.g. New case) that need to add a
 *  client mid-flow without leaving. Returns the row for the caller to
 *  splice into its own dropdown state — no revalidate + redirect. */
export async function createClientQuickAction(fd: FormData): Promise<{ id: string; code: string; full_name: string } | { error: string }> {
  try {
    const { supabase, actorId } = await requireUser();
    const full_name = String(fd.get("full_name") ?? "").trim();
    const passport_no = normalizePassport(String(fd.get("passport_no") ?? "").trim() || null);
    const nationality = str(fd, "nationality");
    if (!full_name) return { error: "Full name is required." };

    const { data: dupe } = await supabase
      .from("clients")
      .select("code, full_name")
      .ilike("full_name", full_name)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    if (dupe) return { error: `A client named "${dupe.full_name}" already exists (${dupe.code}). Pick them from the list instead.` };

    const { data: client, error } = await supabase
      .from("clients")
      .insert({
        full_name, passport_no, nationality,
        preferred_channel: "whatsapp",
        created_by: actorId,
        updated_by: actorId,
      })
      .select("id, code, full_name")
      .single();
    if (error) return { error: await humanizeSupabaseError(error.message) };

    revalidatePath("/clients");
    return client as { id: string; code: string; full_name: string };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
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
