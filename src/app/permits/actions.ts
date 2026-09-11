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
function normalizePassport(v: string | null): string | null {
  return v ? v.replace(/\s+/g, "").toUpperCase() : null;
}

/**
 * Create a person-owned permit in one round-trip. Either link to an
 * existing client (client_id set) or create a new client from the form
 * fields (full_name + passport_no required). If the permit insert fails
 * after a new client was inserted, roll the client back so we don't leave
 * an orphaned person row behind.
 */
export async function createPermitWithClientAction(fd: FormData): Promise<{ clientId: string }> {
  const { supabase, actorId } = await requireUser();

  const service_id = s(fd, "service_id");
  if (!service_id) throw new Error("Pick a service.");
  const expires_date = d(fd, "expires_date");
  if (!expires_date) throw new Error("Set the end date.");

  let clientId = s(fd, "client_id");
  let createdClient = false;

  if (!clientId) {
    const full_name = s(fd, "full_name");
    const passport_no = normalizePassport(s(fd, "passport_no"));
    const nationality = s(fd, "nationality");
    if (!full_name) throw new Error("Type the person's full name or pick an existing client.");

    // Dupe check mirrors the standalone client-create action so operators
    // can't slip a duplicate person in through this shortcut.
    const { data: dupe } = await supabase
      .from("clients")
      .select("code, full_name")
      .ilike("full_name", full_name)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    if (dupe) throw new Error(`A client named "${dupe.full_name}" already exists (${dupe.code}). Pick them from the list instead.`);

    const { data: newClient, error: clientErr } = await supabase
      .from("clients")
      .insert({
        full_name,
        passport_no,
        nationality,
        preferred_channel: "whatsapp",
        created_by: actorId,
        updated_by: actorId,
      })
      .select("id")
      .single();
    if (clientErr) {
      if (clientErr.message.includes("clients_passport_unique")) {
        throw new Error("A client with this passport number already exists.");
      }
      throw new Error(clientErr.message);
    }
    clientId = newClient.id;
    createdClient = true;
  }

  const { error: permitErr } = await supabase.from("entity_services").insert({
    service_id,
    client_id: clientId,
    company_id: null,
    status: "active",
    issued_date: d(fd, "issued_date"),
    expires_date,
    responsible_partner_id: s(fd, "responsible_partner_id"),
    notes: s(fd, "notes"),
    created_by: actorId,
  });

  if (permitErr) {
    if (createdClient && clientId) {
      // Undo the client insert so we never leave a permit-less orphan.
      await supabase.from("clients").delete().eq("id", clientId);
    }
    throw new Error(permitErr.message);
  }

  revalidatePath("/permits");
  revalidatePath("/renewals");
  revalidatePath(`/clients/${clientId}`);
  return { clientId: clientId! };
}
