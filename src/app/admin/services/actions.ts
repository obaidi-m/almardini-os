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

const SCHEDULE_KINDS = ["one_off", "annual_fixed", "quarterly_fixed"] as const;
type ScheduleKind = (typeof SCHEDULE_KINDS)[number];

type ScheduleFields = {
  schedule_kind: ScheduleKind;
  annual_month: number | null;
  annual_day: number | null;
  quarterly_day: number | null;
  quarterly_months: number[] | null;
};

function parseSchedule(fd: FormData): ScheduleFields {
  const rawKind = String(fd.get("schedule_kind") || "one_off");
  if (!SCHEDULE_KINDS.includes(rawKind as ScheduleKind)) {
    throw new Error(`Unknown schedule kind: ${rawKind}`);
  }
  const kind = rawKind as ScheduleKind;

  const zero: ScheduleFields = {
    schedule_kind: kind,
    annual_month: null, annual_day: null,
    quarterly_day: null, quarterly_months: null,
  };

  if (kind === "annual_fixed") {
    const m = Number(fd.get("annual_month"));
    const d = Number(fd.get("annual_day"));
    if (!Number.isInteger(m) || m < 1 || m > 12) throw new Error("Annual month must be 1–12");
    if (!Number.isInteger(d) || d < 1 || d > 31) throw new Error("Annual day must be 1–31");
    return { ...zero, annual_month: m, annual_day: d };
  }
  if (kind === "quarterly_fixed") {
    const d = Number(fd.get("quarterly_day"));
    if (!Number.isInteger(d) || d < 1 || d > 31) throw new Error("Quarterly day must be 1–31");
    const months = fd.getAll("quarterly_months").map((v) => Number(v)).filter((n) => Number.isInteger(n) && n >= 1 && n <= 12);
    const uniq = Array.from(new Set(months)).sort((a, b) => a - b);
    if (uniq.length < 1 || uniq.length > 4) throw new Error("Pick 1–4 anchor months");
    return { ...zero, quarterly_day: d, quarterly_months: uniq };
  }
  return zero;
}

export async function createService(formData: FormData) {
  const { supabase, actorId } = await requireOwner();

  const code = String(formData.get("code") || "").trim().toUpperCase() || null;
  const name = String(formData.get("name") || "").trim();
  const category_id = String(formData.get("category_id") || "");
  const duration = String(formData.get("duration") || "").trim() || null;
  const description = String(formData.get("description") || "").trim() || null;
  const has_deliverable = formData.getAll("has_deliverable").pop() === "true";
  const schedule = parseSchedule(formData);
  const v = parseAmountUnit(formData, "validity_amount", "validity_unit", "Validity duration");
  const validity_amount = v.amount, validity_unit = v.unit;

  if (!name || !category_id) throw new Error("Name and category are required");

  const { data, error } = await supabase
    .from("service_types")
    .insert({ code, name, category_id, duration, description, ...schedule, validity_amount, validity_unit, has_deliverable, created_by: actorId })
    .select("id, name, code")
    .single();
  if (error) throw new Error(error.message);

  await log(actorId, "created", data.id, `Added service ${data.name} (${data.code})`);
  revalidatePath("/admin/services");
}

export async function updateService(formData: FormData) {
  const { supabase, actorId } = await requireOwner();
  const id = String(formData.get("id"));
  const schedule = parseSchedule(formData);
  const v = parseAmountUnit(formData, "validity_amount", "validity_unit", "Validity duration");
  const validity_amount = v.amount, validity_unit = v.unit;
  const patch = {
    code: String(formData.get("code") || "").trim().toUpperCase() || null,
    name: String(formData.get("name") || "").trim(),
    category_id: String(formData.get("category_id") || ""),
    duration: String(formData.get("duration") || "").trim() || null,
    description: String(formData.get("description") || "").trim() || null,
    ...schedule,
    validity_amount,
    validity_unit,
    has_deliverable: formData.getAll("has_deliverable").pop() === "true",
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
