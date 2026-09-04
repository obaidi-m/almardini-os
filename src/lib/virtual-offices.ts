import type { SupabaseClient } from "@supabase/supabase-js";

/** Flip any active VO whose end_date has passed to 'expired'. Called at the
 *  top of every page that reads virtual_offices so users never see an
 *  "active" pill on a row that has actually expired.
 *
 *  Safe to call frequently — the WHERE clause matches only rows that need
 *  the flip; on a quiet day it's a fast no-op. Errors are swallowed so a
 *  transient DB hiccup can't take down a whole page. */
export async function expireOverdueVirtualOffices(supabase: SupabaseClient): Promise<void> {
  try {
    await supabase
      .from("virtual_offices")
      .update({ status: "expired" })
      .is("deleted_at", null)
      .eq("status", "active")
      .lt("end_date", new Date().toISOString().slice(0, 10));
  } catch {
    // Non-fatal — the page still renders with whatever the read returns.
  }
}
