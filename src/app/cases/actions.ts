"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { CaseStatus, CasePriority } from "@/lib/types";
import { computeNextExpiry, serviceRepeats, type ServiceSchedule } from "@/lib/renewal";

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

const SCHEDULE_SELECT = "schedule_kind, annual_month, annual_day, quarterly_day, quarterly_months, validity_amount, validity_unit";

/** When a case first hits Done, seed its expires_at so the renewal calendar
 *  and the Active Services section on the client/company page can surface it.
 *  The date comes from the service's schedule:
 *    annual_fixed    → next occurrence of (annual_month, annual_day)
 *    quarterly_fixed → next occurrence in (quarterly_day, quarterly_months)
 *    one_off + validity → today + validity (shelf life of the output)
 *    one_off no validity → no date, no reminder
 *  A manually set expires_at is never overwritten. */
async function autoFillExpiresOnDone(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  case_id: string,
): Promise<string | null> {
  const { data: c } = await supabase
    .from("cases")
    .select(`expires_at, service:service_types(${SCHEDULE_SELECT})`)
    .eq("id", case_id)
    .single();
  if (!c || c.expires_at) return null;
  const svc = (Array.isArray(c.service) ? c.service[0] : c.service) as ServiceSchedule;
  const iso = computeNextExpiry(svc);
  if (!iso) return null;

  const { error } = await supabase.from("cases").update({ expires_at: iso }).eq("id", case_id);
  if (error) throw new Error(error.message);
  return iso;
}

/** When a calendar-fixed case is Delivered, open a fresh sibling case for
 *  the next filing period. deadline = the previous case's expires_at
 *  (which was itself computed from the calendar rule on Done). No-op for
 *  one-off services, and skipped if a successor already exists so that a
 *  re-deliver of the same case doesn't double-spawn. */
async function spawnNextRecurringCase(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  actorId: string,
  case_id: string,
): Promise<void> {
  const { data: c } = await supabase
    .from("cases")
    .select(`client_id, company_id, service_type_id, assigned_to, priority, title, expires_at, service:service_types(${SCHEDULE_SELECT})`)
    .eq("id", case_id)
    .single();
  if (!c) return;
  const svc = (Array.isArray(c.service) ? c.service[0] : c.service) as ServiceSchedule;
  if (!serviceRepeats(svc)) return;

  // Successor already opened? (a re-deliver of the same case shouldn't
  // double-spawn.) We consider the newest sibling for the same client/company
  // + service that was created after this one.
  const { data: existing } = await supabase
    .from("cases")
    .select("id")
    .eq("service_type_id", c.service_type_id)
    .eq(c.client_id ? "client_id" : "company_id", (c.client_id ?? c.company_id) as string)
    .neq("id", case_id)
    .is("deleted_at", null)
    .gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
    .limit(1);
  if (existing && existing.length > 0) return;

  const nextDeadline = c.expires_at ?? computeNextExpiry(svc);
  if (!nextDeadline) return;

  const { error } = await supabase.from("cases").insert({
    client_id: c.client_id,
    company_id: c.company_id,
    service_type_id: c.service_type_id,
    assigned_to: c.assigned_to,
    priority: c.priority,
    title: c.title,
    deadline: nextDeadline,
    created_by: actorId,
    updated_by: actorId,
  });
  if (error) throw new Error(error.message);
}
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
    title: str(fd, "title"),
    drive_folder_url: str(fd, "drive_folder_url"),
  };
}

export async function createCaseAction(fd: FormData) {
  const { supabase, actorId } = await requireUser();
  const payload = parseCaseForm(fd);

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

  if (newStatus === "done" && currentStatus !== "done") {
    await autoFillExpiresOnDone(supabase, case_id);
  }
  if (newStatus === "delivered" && currentStatus !== "delivered") {
    await spawnNextRecurringCase(supabase, actorId, case_id);
  }

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

    if (newStatus === "done" && currentStatus !== "done") {
      await autoFillExpiresOnDone(supabase, case_id);
    }
    if (newStatus === "delivered" && currentStatus !== "delivered") {
      await spawnNextRecurringCase(supabase, actorId, case_id);
    }
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

  await spawnNextRecurringCase(supabase, actorId, case_id);

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
    .update({ status: "in_progress", updated_by: actorId })
    .eq("id", case_id);
  if (statusError) throw new Error(statusError.message);

  revalidatePath(`/cases/${case_id}`);
  revalidatePath("/cases");
}

export async function softDeleteCaseAction(fd: FormData) {
  const { supabase, actorId } = await requireUser();
  const id = String(fd.get("id") ?? "");
  if (!id) throw new Error("Missing case id.");

  const { error } = await supabase
    .from("cases")
    .update({ deleted_at: new Date().toISOString(), updated_by: actorId })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/cases");
  redirect("/cases");
}
