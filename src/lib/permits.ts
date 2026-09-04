import type { SupabaseClient } from "@supabase/supabase-js";

/** Common Indonesian permit kinds. The DB column is free text so operators
 *  can enter anything unusual; this list just powers the form dropdown. */
export const COMMON_PERMIT_KINDS = [
  "KITAS",
  "ITAS",
  "KITAP",
  "ITAP",
  "IMTA",
  "Business Visa",
  "Work Permit",
  "Passport",
  "Driver License",
  "Other",
] as const;

/** Flip any active permit whose expires_date has passed to 'expired'.
 *  Same pattern as expireOverdueVirtualOffices — called at the top of
 *  every read path so users never see a stale "active" pill. */
export async function expireOverduePermits(supabase: SupabaseClient): Promise<void> {
  try {
    await supabase
      .from("permits")
      .update({ status: "expired" })
      .is("deleted_at", null)
      .eq("status", "active")
      .lt("expires_date", new Date().toISOString().slice(0, 10));
  } catch {
    // Non-fatal — the page still renders with whatever the read returns.
  }
}
