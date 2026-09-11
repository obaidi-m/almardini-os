"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { CaseStatus, CasePriority } from "@/lib/types";

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

const STATUSES: CaseStatus[] = ["new", "in_progress", "done", "delivered"];

const PRIORITIES: CasePriority[] = ["low", "normal", "high", "urgent"];

type CasePayload = {
  client_id: string | null;
  company_id: string | null;
  service_type_id: string;
  priority: CasePriority;
  assigned_to: string | null;
  deadline: string | null;
  title: string | null;
  drive_folder_url: string | null;
};

function parseCaseForm(fd: FormData): CasePayload {
  const client_id = str(fd, "client_id");
  const company_id = str(fd, "company_id");
  if (!client_id && !company_id) {
    throw new Error("A case must be attached to a client or a company.");
  }
  const service_type_id = str(fd, "service_type_id");
  if (!service_type_id) throw new Error("Service type is required.");

  const priority = String(fd.get("priority") ?? "normal") as CasePriority;
  if (!PRIORITIES.includes(priority)) throw new Error("Invalid priority.");

  return {
    client_id,
    company_id,
    service_type_id,
    priority,
    assigned_to: str(fd, "assigned_to"),
    deadline: str(fd, "deadline"),
    // For a Company Formation case the operator types the target company's
    // name in a dedicated field; fall back to that when the free-text title
    // is empty so the case surfaces with a useful label everywhere it's
    // rendered (list rows, sidebar, activity log).
    title: str(fd, "title") ?? str(fd, "company_name_to_create"),
    drive_folder_url: str(fd, "drive_folder_url"),
  };
}

export async function createCaseAction(fd: FormData) {
  const { supabase, actorId } = await requireUser();
  const payload = parseCaseForm(fd);

  // Block a second open case for the same service on the same client/company.
  // "Open" = not delivered and not archived. Delivered cases are historical
  // and shouldn't block a new cycle.
  const { data: dup } = await supabase
    .from("cases")
    .select("id, code")
    .eq("service_type_id", payload.service_type_id)
    .eq(payload.client_id ? "client_id" : "company_id", (payload.client_id ?? payload.company_id) as string)
    .is("deleted_at", null)
    .neq("status", "delivered")
    .limit(1);
  if (dup && dup.length > 0) {
    const existing = dup[0] as { code?: string | null };
    throw new Error(
      `An open case for this service already exists${existing.code ? ` (${existing.code})` : ""}. Deliver or archive it before opening a new one.`,
    );
  }

  const { data, error } = await supabase
    .from("cases")
    .insert({ ...payload, created_by: actorId, updated_by: actorId })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/cases");
  redirect(`/cases/${data.id}`);
}

export async function updateCaseMetaAction(fd: FormData) {
  const { supabase, actorId } = await requireUser();
  const id = String(fd.get("id") ?? "");
  if (!id) throw new Error("Missing case id.");
  const payload = parseCaseForm(fd);

  const { error } = await supabase
    .from("cases")
    .update({ ...payload, updated_by: actorId })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/cases/${id}`);
  revalidatePath("/cases");
}

/** Tap-to-change status. Writes a status-only case_update row and updates
 *  cases.status. No text required — the user just tapped a pill. */
export async function setCaseStatusAction(fd: FormData) {
  const { supabase, actorId } = await requireUser();
  const case_id = String(fd.get("case_id") ?? "");
  const rawStatus = String(fd.get("status") ?? "");
  if (!case_id) throw new Error("Missing case.");
  if (!STATUSES.includes(rawStatus as CaseStatus)) throw new Error("Invalid status.");
  const newStatus = rawStatus as CaseStatus;

  const { data: existing, error: fetchError } = await supabase
    .from("cases")
    .select("status")
    .eq("id", case_id)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const currentStatus = existing.status as CaseStatus;
  if (currentStatus === newStatus) {
    // No-op — nothing to write.
    revalidatePath(`/cases/${case_id}`);
    return;
  }

  // Delivered is gated to owner + ops lead. Also block reopen from delivered
  // through this path — the reopen modal handles that case with a required reason.
  if (newStatus === "delivered" || currentStatus === "delivered") {
    const { data: me } = await supabase.from("users").select("role:roles(code)").eq("id", actorId).single();
    const roleCode = (me?.role as { code?: string } | { code?: string }[] | null);
    const code = Array.isArray(roleCode) ? roleCode[0]?.code : roleCode?.code;
    if (code !== "owner" && code !== "ops_lead") {
      throw new Error("Only Owner or Ops Lead can deliver or reopen a case.");
    }
  }

  const { error: insertError } = await supabase.from("case_updates").insert({
    case_id,
    author_id: actorId,
    text: null,
    status_before: currentStatus,
    status_after: newStatus,
  });
  if (insertError) throw new Error(insertError.message);

  const { error: statusError } = await supabase
    .from("cases")
    .update({ status: newStatus, updated_by: actorId })
    .eq("id", case_id);
  if (statusError) throw new Error(statusError.message);

  revalidatePath(`/cases/${case_id}`);
  revalidatePath("/cases");
  revalidatePath("/renewals");
}

/** Add a case update — the immutable work log entry.
 *  Text is required here (the tap-to-change flow uses setCaseStatusAction for
 *  status-only rows). May optionally include a status change in the same write. */
export async function addCaseUpdateAction(fd: FormData) {
  const { supabase, actorId } = await requireUser();
  const case_id = String(fd.get("case_id") ?? "");
  const text = String(fd.get("text") ?? "").trim();
  const newStatus = str(fd, "new_status");

  if (!case_id) throw new Error("Missing case.");
  if (!text) throw new Error("Note text is required.");

  const { data: existing, error: fetchError } = await supabase
    .from("cases")
    .select("status")
    .eq("id", case_id)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const currentStatus = existing.status as CaseStatus;
  const willChange = newStatus && newStatus !== currentStatus && STATUSES.includes(newStatus as CaseStatus);

  const { error: insertError } = await supabase.from("case_updates").insert({
    case_id,
    author_id: actorId,
    text,
    status_before: willChange ? currentStatus : null,
    status_after: willChange ? (newStatus as CaseStatus) : null,
  });
  if (insertError) throw new Error(insertError.message);

  if (willChange) {
    const { error: statusError } = await supabase
      .from("cases")
      .update({ status: newStatus, updated_by: actorId })
      .eq("id", case_id);
    if (statusError) throw new Error(statusError.message);
  }

  revalidatePath(`/cases/${case_id}`);
  revalidatePath("/cases");
  revalidatePath("/renewals");
}

/** Deliver: mark the case as ✅ delivered + open WhatsApp/email flow. */
export async function deliverCaseAction(fd: FormData) {
  const { supabase, actorId } = await requireUser();
  const case_id = String(fd.get("case_id") ?? "");
  if (!case_id) throw new Error("Missing case.");

  const { data: me } = await supabase.from("users").select("role:roles(code)").eq("id", actorId).single();
  const roleCode = (me?.role as { code?: string } | null)?.code;
  if (roleCode !== "owner" && roleCode !== "ops_lead") {
    throw new Error("Only Owner or Ops Lead can mark a case as delivered.");
  }

  const { error: insertError } = await supabase.from("case_updates").insert({
    case_id,
    author_id: actorId,
    text: "Delivered to client.",
    status_before: "done",
    status_after: "delivered",
  });
  if (insertError) throw new Error(insertError.message);

  const { error: statusError } = await supabase
    .from("cases")
    .update({ status: "delivered", updated_by: actorId })
    .eq("id", case_id);
  if (statusError) throw new Error(statusError.message);

  revalidatePath(`/cases/${case_id}`);
  revalidatePath("/cases");
  revalidatePath("/renewals");
}

export async function reopenCaseAction(fd: FormData) {
  const { supabase, actorId } = await requireUser();
  const case_id = String(fd.get("case_id") ?? "");
  const reason = String(fd.get("reason") ?? "").trim();
  if (!case_id) throw new Error("Missing case.");
  if (!reason) throw new Error("A reason is required to reopen a delivered case.");

  const { data: me } = await supabase.from("users").select("role:roles(code)").eq("id", actorId).single();
  const roleCode = (me?.role as { code?: string } | null)?.code;
  if (roleCode !== "owner" && roleCode !== "ops_lead") {
    throw new Error("Only Owner or Ops Lead can reopen a delivered case.");
  }

  const { error: insertError } = await supabase.from("case_updates").insert({
    case_id,
    author_id: actorId,
    text: `Reopened. Reason: ${reason}`,
    status_before: "delivered",
    status_after: "in_progress",
  });
  if (insertError) throw new Error(insertError.message);

  const { error: statusError } = await supabase
    .from("cases")
    .update({ status: "in_progress", expires_at: null, updated_by: actorId })
    .eq("id", case_id);
  if (statusError) throw new Error(statusError.message);

  revalidatePath(`/cases/${case_id}`);
  revalidatePath("/cases");
  revalidatePath("/renewals");
}

/** Manually clear a case's expires_at. Useful when a test click or a wrong
 *  Done stamped a stale expiry — the Active Services / Renewals views hide
 *  the case afterwards, and the next real Done will auto-fill it again. */
export async function clearCaseExpiryAction(fd: FormData) {
  const { supabase, actorId } = await requireUser();
  const case_id = String(fd.get("case_id") ?? "");
  if (!case_id) throw new Error("Missing case.");

  const { error } = await supabase
    .from("cases")
    .update({ expires_at: null, updated_by: actorId })
    .eq("id", case_id);
  if (error) throw new Error(error.message);

  revalidatePath(`/cases/${case_id}`);
  revalidatePath("/cases");
  revalidatePath("/renewals");
}

/** Bulk-set the status of many cases in one action. Delivered is intentionally
 *  excluded — that transition opens the WhatsApp/email send flow per case and
 *  must stay a deliberate one-at-a-time act. Same is true for anything moving
 *  out of Delivered (use reopenCaseAction with a reason).
 *
 *  Per case: no-op if already at target, otherwise write a status-only
 *  case_updates row and update cases.status. Auto-fills expires_at on the
 *  New/In-progress → Done edge, same as the single-case path.
 *
 *  Returns per-case results so the UI can show "3 updated, 1 skipped, 1
 *  already at target". RLS still applies — if a row is not visible/writable
 *  to this user it comes back as skipped with the DB's own error. */
export async function bulkSetCaseStatusAction(
  ids: string[],
  rawStatus: string,
): Promise<{
  updated: string[];
  unchanged: string[];
  skipped: { id: string; reason: string }[];
}> {
  const { supabase, actorId } = await requireUser();

  if (!STATUSES.includes(rawStatus as CaseStatus)) {
    throw new Error("Invalid status.");
  }
  const newStatus = rawStatus as CaseStatus;
  if (newStatus === "delivered") {
    throw new Error("Delivered is set per case, not in bulk.");
  }
  if (!Array.isArray(ids) || ids.length === 0) {
    return { updated: [], unchanged: [], skipped: [] };
  }
  const cleaned = Array.from(new Set(ids.filter((v) => typeof v === "string" && v.length > 0)));

  const { data: rows, error: fetchError } = await supabase
    .from("cases")
    .select("id, status")
    .in("id", cleaned);
  if (fetchError) throw new Error(fetchError.message);

  const found = new Map<string, CaseStatus>();
  for (const r of (rows ?? []) as { id: string; status: CaseStatus }[]) {
    found.set(r.id, r.status);
  }

  const updated: string[] = [];
  const unchanged: string[] = [];
  const skipped: { id: string; reason: string }[] = [];

  for (const id of cleaned) {
    const current = found.get(id);
    if (!current) {
      skipped.push({ id, reason: "not visible" });
      continue;
    }
    if (current === newStatus) {
      unchanged.push(id);
      continue;
    }
    if (current === "delivered") {
      skipped.push({ id, reason: "delivered — use reopen with a reason" });
      continue;
    }

    const { error: insertError } = await supabase.from("case_updates").insert({
      case_id: id,
      author_id: actorId,
      text: null,
      status_before: current,
      status_after: newStatus,
    });
    if (insertError) {
      skipped.push({ id, reason: insertError.message });
      continue;
    }

    const { error: statusError } = await supabase
      .from("cases")
      .update({ status: newStatus, updated_by: actorId })
      .eq("id", id);
    if (statusError) {
      skipped.push({ id, reason: statusError.message });
      continue;
    }

    updated.push(id);
  }

  revalidatePath("/cases");
  revalidatePath("/renewals");
  return { updated, unchanged, skipped };
}

export async function softDeleteCaseAction(fd: FormData) {
  const { supabase } = await requireUser();
  const id = String(fd.get("id") ?? "");
  if (!id) throw new Error("Missing case id.");

  // Goes through the SECURITY DEFINER RPC (migration 026) so the archive
  // still works when the row-level cases_update WITH CHECK rejects the
  // direct update. The RPC itself gates on is_owner / cases.delete.
  const { error } = await supabase.rpc("soft_delete_case", { target_case_id: id });
  if (error) throw new Error(error.message);

  revalidatePath("/cases");
  redirect("/cases");
}

export async function restoreCaseAction(fd: FormData) {
  const { supabase } = await requireUser();
  const id = String(fd.get("id") ?? "");
  if (!id) throw new Error("Missing case id.");

  const { error } = await supabase.rpc("restore_case", { target_case_id: id });
  if (error) throw new Error(error.message);

  revalidatePath("/cases");
  revalidatePath(`/cases/${id}`);
}
