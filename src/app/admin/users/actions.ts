"use server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

async function requireOwner() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data: me } = await supabase.from("users").select("role:roles(code)").eq("id", user.id).single();
  if ((me?.role as { code?: string } | null)?.code !== "owner") throw new Error("Owner only");
  return { supabase, actorId: user.id };
}

/** Uses the Supabase service-role key. Never expose this to the browser. */
function serviceClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function log(actorId: string, action: string, entityId: string | null, summary: string, metadata: Record<string, unknown> = {}) {
  const s = createClient();
  await s.from("activity_log").insert({
    actor_id: actorId,
    action,
    entity_type: "user",
    entity_id: entityId,
    summary,
    metadata,
  });
}

export async function createUserDirect(formData: FormData) {
  const { actorId } = await requireOwner();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const full_name = String(formData.get("full_name") || "").trim();
  const role_id = String(formData.get("role_id") || "");
  const phone = String(formData.get("phone") || "").trim() || null;
  const password = String(formData.get("password") || "");

  if (!email || !full_name || !role_id) throw new Error("Name, email and role are required");
  if (!password || password.length < 8) throw new Error("Password must be at least 8 characters");

  const admin = serviceClient();

  // Create the auth user directly with password + email pre-confirmed (no invite email)
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });
  if (createError) throw new Error(createError.message);
  const authId = created.user!.id;

  const { error: rowError } = await admin.from("users").insert({
    id: authId,
    email,
    full_name,
    role_id,
    phone,
    is_active: true,
    invited_by: actorId,
  });
  if (rowError) {
    // Roll back auth user if profile insert fails, so we don't leave orphans
    await admin.auth.admin.deleteUser(authId);
    throw new Error(rowError.message);
  }

  await log(actorId, "created", authId, `Created user ${full_name} (${email})`, { role_id });
  revalidatePath("/admin/users");
}

export async function resetUserPassword(formData: FormData) {
  const { actorId } = await requireOwner();
  const id = String(formData.get("id"));
  const password = String(formData.get("password") || "");
  if (!password || password.length < 8) throw new Error("Password must be at least 8 characters");

  const admin = serviceClient();
  const { error } = await admin.auth.admin.updateUserById(id, { password });
  if (error) throw new Error(error.message);

  await log(actorId, "password_reset", id, `Reset password for user ${id}`);
  revalidatePath("/admin/users");
}

export async function updateUser(formData: FormData) {
  const { actorId } = await requireOwner();
  const id = String(formData.get("id"));
  const full_name = String(formData.get("full_name") || "").trim();
  const role_id = String(formData.get("role_id") || "");
  const phone = String(formData.get("phone") || "").trim() || null;

  const admin = serviceClient();
  const { error } = await admin.from("users").update({ full_name, role_id, phone }).eq("id", id);
  if (error) throw new Error(error.message);

  await log(actorId, "updated", id, `Updated profile for ${full_name}`);
  revalidatePath("/admin/users");
}

export async function toggleUserActive(formData: FormData) {
  const { actorId } = await requireOwner();
  const id = String(formData.get("id"));
  const next = formData.get("is_active") === "true";

  const admin = serviceClient();
  const { error } = await admin.from("users").update({ is_active: next }).eq("id", id);
  if (error) throw new Error(error.message);

  await log(actorId, next ? "reactivated" : "deactivated", id, `${next ? "Reactivated" : "Deactivated"} user ${id}`);
  revalidatePath("/admin/users");
}

export async function deleteUser(formData: FormData) {
  const { actorId } = await requireOwner();
  const id = String(formData.get("id"));
  if (id === actorId) throw new Error("You cannot delete your own account.");

  const admin = serviceClient();
  const { data: existing } = await admin.from("users").select("full_name, email").eq("id", id).single();

  // Remove profile then the auth user
  const { error: profErr } = await admin.from("users").delete().eq("id", id);
  if (profErr) throw new Error(profErr.message);
  const { error: authErr } = await admin.auth.admin.deleteUser(id);
  if (authErr) throw new Error(authErr.message);

  await log(actorId, "deleted", null, `Deleted user ${existing?.full_name ?? id} (${existing?.email ?? ""})`);
  revalidatePath("/admin/users");
}
