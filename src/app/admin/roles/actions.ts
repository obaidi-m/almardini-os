"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { SYSTEM_ROLE_CODES } from "@/lib/permissions";

async function requireOwner() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data: me } = await supabase.from("users").select("role:roles(code)").eq("id", user.id).single();
  if ((me?.role as { code?: string } | null)?.code !== "owner") throw new Error("Owner only");
  return { supabase, actorId: user.id };
}

async function log(actorId: string, action: string, entityId: string | null, summary: string, metadata: Record<string, unknown> = {}) {
  const s = createClient();
  await s.from("activity_log").insert({
    actor_id: actorId,
    action,
    entity_type: "role",
    entity_id: entityId,
    summary,
    metadata,
  });
}

/** Normalise a role code to lower_snake_case */
function normaliseCode(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export async function createRole(formData: FormData) {
  const { supabase, actorId } = await requireOwner();
  const name = String(formData.get("name") || "").trim();
  const code = normaliseCode(String(formData.get("code") || name));
  const description = String(formData.get("description") || "").trim() || null;

  if (!name) throw new Error("Name is required");
  if (!code) throw new Error("Code is required");

  const { data, error } = await supabase
    .from("roles")
    .insert({ name, code, description, permissions: [], is_system: false })
    .select("id, name, code")
    .single();
  if (error) throw new Error(error.message);

  await log(actorId, "created", data.id, `Created role "${data.name}"`);
  revalidatePath("/admin/roles");
}

export async function updateRoleMeta(formData: FormData) {
  const { supabase, actorId } = await requireOwner();
  const id = String(formData.get("id"));
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  if (!name) throw new Error("Name is required");

  const { data: existing } = await supabase.from("roles").select("code").eq("id", id).single();
  const patch: Record<string, unknown> = { name, description };
  // System roles keep their code; only allow renaming for others
  if (existing && !SYSTEM_ROLE_CODES.includes(existing.code)) {
    const code = String(formData.get("code") || "");
    if (code) patch.code = normaliseCode(code);
  }

  const { error } = await supabase.from("roles").update(patch).eq("id", id);
  if (error) throw new Error(error.message);

  await log(actorId, "updated", id, `Updated role metadata for ${name}`, patch);
  revalidatePath("/admin/roles");
}

export async function updateRolePermissions(formData: FormData) {
  const { supabase, actorId } = await requireOwner();
  const id = String(formData.get("id"));
  const permsRaw = String(formData.get("permissions") || "[]");
  let perms: string[];
  try {
    perms = JSON.parse(permsRaw);
  } catch {
    throw new Error("Invalid permissions payload");
  }

  const { data: existing } = await supabase.from("roles").select("code").eq("id", id).single();
  if (existing?.code === "owner") {
    // Owner is always full-access; do not let anyone change it
    throw new Error("Owner role permissions cannot be edited");
  }

  const { error } = await supabase.from("roles").update({ permissions: perms }).eq("id", id);
  if (error) throw new Error(error.message);

  await log(actorId, "permissions_changed", id, `Updated permissions for role ${existing?.code}`, { permissions: perms });
  revalidatePath("/admin/roles");
}

export async function deleteRole(formData: FormData) {
  const { supabase, actorId } = await requireOwner();
  const id = String(formData.get("id"));

  const { data: role } = await supabase.from("roles").select("id, code, name, is_system").eq("id", id).single();
  if (!role) throw new Error("Role not found");
  if (role.is_system || SYSTEM_ROLE_CODES.includes(role.code)) {
    throw new Error(`"${role.name}" is a system role and cannot be deleted.`);
  }

  const { count } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("role_id", id);
  if ((count ?? 0) > 0) {
    throw new Error(`Reassign the ${count} user${count === 1 ? "" : "s"} on this role before deleting it.`);
  }

  const { error } = await supabase.from("roles").delete().eq("id", id);
  if (error) throw new Error(error.message);

  await log(actorId, "deleted", id, `Deleted role "${role.name}"`);
  revalidatePath("/admin/roles");
}
