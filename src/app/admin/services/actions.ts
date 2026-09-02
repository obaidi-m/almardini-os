"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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
    entity_type: "service_type",
    entity_id: entityId,
    summary,
    metadata,
  });
}

const VALID_UNITS = ["days", "months", "years"] as const;
type Unit = (typeof VALID_UNITS)[number];

function parseAmountUnit(fd: FormData, amountKey: string, unitKey: string, label: string): { amount: number | null; unit: Unit | null } {
  const rawAmt = String(fd.get(amountKey) || "").trim();
  const rawUnit = String(fd.get(unitKey) || "").trim();
  if (!rawAmt) return { amount: null, unit: null };
  const amount = Number(rawAmt);
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) {
    throw new Error(`${label} must be a positive whole number`);
  }
  if (!VALID_UNITS.includes(rawUnit as Unit)) {
    throw new Error(`${label} unit is required (days, months, or years)`);
  }
  return { amount, unit: rawUnit as Unit };
}

export async function createService(formData: FormData) {
  const { supabase, actorId } = await requireOwner();

  const code = String(formData.get("code") || "").trim().toUpperCase();
  const name = String(formData.get("name") || "").trim();
  const category_id = String(formData.get("category_id") || "");
  const duration = String(formData.get("duration") || "").trim() || null;
  const description = String(formData.get("description") || "").trim() || null;
  const name_id = String(formData.get("name_id") || "").trim() || null;
  const description_id = String(formData.get("description_id") || "").trim() || null;
  const has_deliverable = formData.getAll("has_deliverable").pop() === "true";
  const delivery_template_en = String(formData.get("delivery_template_en") || "").trim() || null;
  const delivery_template_id = String(formData.get("delivery_template_id") || "").trim() || null;
  const v = parseAmountUnit(formData, "validity_amount", "validity_unit", "Validity");
  const r = parseAmountUnit(formData, "recurring_amount", "recurring_unit", "Recurring interval");
  const validity_amount = v.amount, validity_unit = v.unit;
  const recurring_amount = r.amount, recurring_unit = r.unit;

  if (!code || !name || !category_id) throw new Error("Code, name and category are required");

  const { data, error } = await supabase
    .from("service_types")
    .insert({ code, name, name_id, category_id, duration, description, description_id, validity_amount, validity_unit, recurring_amount, recurring_unit, has_deliverable, delivery_template_en, delivery_template_id, created_by: actorId })
    .select("id, name, code")
    .single();
  if (error) throw new Error(error.message);

  await log(actorId, "created", data.id, `Added service ${data.name} (${data.code})`);
  revalidatePath("/admin/services");
}

export async function updateService(formData: FormData) {
  const { supabase, actorId } = await requireOwner();
  const id = String(formData.get("id"));
  const v = parseAmountUnit(formData, "validity_amount", "validity_unit", "Validity");
  const r = parseAmountUnit(formData, "recurring_amount", "recurring_unit", "Recurring interval");
  const validity_amount = v.amount, validity_unit = v.unit;
  const recurring_amount = r.amount, recurring_unit = r.unit;
  const patch = {
    code: String(formData.get("code") || "").trim().toUpperCase(),
    name: String(formData.get("name") || "").trim(),
    name_id: String(formData.get("name_id") || "").trim() || null,
    category_id: String(formData.get("category_id") || ""),
    duration: String(formData.get("duration") || "").trim() || null,
    description: String(formData.get("description") || "").trim() || null,
    description_id: String(formData.get("description_id") || "").trim() || null,
    validity_amount,
    validity_unit,
    recurring_amount,
    recurring_unit,
    has_deliverable: formData.getAll("has_deliverable").pop() === "true",
    delivery_template_en: String(formData.get("delivery_template_en") || "").trim() || null,
    delivery_template_id: String(formData.get("delivery_template_id") || "").trim() || null,
  };
  const { error } = await supabase.from("service_types").update(patch).eq("id", id);
  if (error) throw new Error(error.message);

  await log(actorId, "updated", id, `Updated service ${patch.name}`, patch);
  revalidatePath("/admin/services");
}

export async function toggleService(formData: FormData) {
  const { supabase, actorId } = await requireOwner();
  const id = String(formData.get("id"));
  const next = formData.get("is_active") === "true";
  const { error } = await supabase.from("service_types").update({ is_active: next }).eq("id", id);
  if (error) throw new Error(error.message);
  await log(actorId, next ? "activated" : "archived", id, `${next ? "Activated" : "Archived"} service ${id}`);
  revalidatePath("/admin/services");
}

/* ---------- Category management ---------- */

function normaliseCode(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export async function createCategory(formData: FormData) {
  const { supabase, actorId } = await requireOwner();
  const name = String(formData.get("name") || "").trim();
  const code = normaliseCode(String(formData.get("code") || name));
  if (!name) throw new Error("Name is required");
  if (!code) throw new Error("Code is required");

  const { data: existing } = await supabase
    .from("service_categories")
    .select("id, sort_order")
    .order("sort_order", { ascending: false })
    .limit(1);
  const next_sort = (existing?.[0]?.sort_order ?? 0) + 10;

  const { data, error } = await supabase
    .from("service_categories")
    .insert({ name, code, sort_order: next_sort })
    .select("id, name, code")
    .single();
  if (error) throw new Error(error.message);

  const s = createClient();
  await s.from("activity_log").insert({
    actor_id: actorId,
    action: "created",
    entity_type: "service_category",
    entity_id: data.id,
    summary: `Created category "${data.name}"`,
  });
  revalidatePath("/admin/services");
}

export async function updateCategory(formData: FormData) {
  const { supabase, actorId } = await requireOwner();
  const id = String(formData.get("id"));
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Name is required");
  const { error } = await supabase.from("service_categories").update({ name }).eq("id", id);
  if (error) throw new Error(error.message);

  const s = createClient();
  await s.from("activity_log").insert({
    actor_id: actorId,
    action: "updated",
    entity_type: "service_category",
    entity_id: id,
    summary: `Renamed category to "${name}"`,
  });
  revalidatePath("/admin/services");
}

export async function deleteCategory(formData: FormData) {
  const { supabase, actorId } = await requireOwner();
  const id = String(formData.get("id"));

  const { count } = await supabase
    .from("service_types")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id);
  if ((count ?? 0) > 0) {
    throw new Error(`Move or delete the ${count} service${count === 1 ? "" : "s"} in this category first.`);
  }

  const { data: existing } = await supabase.from("service_categories").select("name").eq("id", id).single();
  const { error } = await supabase.from("service_categories").delete().eq("id", id);
  if (error) throw new Error(error.message);

  const s = createClient();
  await s.from("activity_log").insert({
    actor_id: actorId,
    action: "deleted",
    entity_type: "service_category",
    entity_id: null,
    summary: `Deleted category "${existing?.name ?? id}"`,
  });
  revalidatePath("/admin/services");
}

export async function deleteService(formData: FormData) {
  const { supabase, actorId } = await requireOwner();
  const id = String(formData.get("id"));

  const { data: existing } = await supabase
    .from("service_types")
    .select("id, name, code")
    .eq("id", id)
    .single();
  if (!existing) throw new Error("Service not found");

  const { error } = await supabase.from("service_types").delete().eq("id", id);
  if (error) throw new Error(error.message);

  await log(actorId, "deleted", null, `Deleted service "${existing.name}" (${existing.code})`, {
    deleted_id: existing.id,
    code: existing.code,
  });
  revalidatePath("/admin/services");
}
