"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/** Bulk-import server actions for the /admin/import page.
 *
 *  We parse the spreadsheet client-side (SheetJS) and post a JSON array of
 *  already-shaped rows to these actions. Duplicate detection happens here
 *  server-side against live DB state so two imports from two people can't
 *  both slip a duplicate through. Each successful insert flows through the
 *  existing per-table trigger which writes an activity_log entry with the
 *  actor id — so the whole batch shows up in the audit log too. */

async function requireOwner() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data: me } = await supabase.from("users").select("role:roles(code)").eq("id", user.id).single();
  if ((me?.role as { code?: string } | null)?.code !== "owner") throw new Error("Owner only");
  return { supabase, actorId: user.id };
}

export type ImportOutcome = "created" | "skipped_duplicate" | "error";
export type ImportResult = {
  row: number;                  // 1-based index in the uploaded sheet
  outcome: ImportOutcome;
  reason?: string;              // populated for skipped_duplicate / error
  label: string;                // the row's identifying value (name / full_name)
};
export type ImportSummary = {
  imported: number;
  skipped: number;
  errored: number;
  results: ImportResult[];
};

/* ---------------- Companies ---------------- */

export type CompanyImportRow = {
  name: string;
  nib?: string | null;
  incorporation_date?: string | null;   // ISO YYYY-MM-DD
  address?: string | null;
  drive_folder_url?: string | null;
  notes?: string | null;
};

export async function bulkImportCompanies(rows: CompanyImportRow[]): Promise<ImportSummary> {
  const { supabase } = await requireOwner();

  // Existing state for duplicate detection: name is case-insensitive, nib
  // is unique when present. Load once, compare in-process — cheaper than
  // one round-trip per row.
  const { data: existing } = await supabase
    .from("companies")
    .select("name, nib")
    .is("deleted_at", null);
  const existingNames = new Set<string>((existing ?? []).map((r) => normName(r.name)));
  const existingNibs  = new Set<string>((existing ?? []).map((r) => r.nib).filter(Boolean) as string[]);

  // Also guard against the sheet duplicating itself.
  const seenNames = new Set<string>();
  const seenNibs = new Set<string>();

  const results: ImportResult[] = [];
  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const row = i + 1;
    const name = (raw.name ?? "").trim();
    if (!name) {
      results.push({ row, outcome: "error", reason: "name is required", label: "(blank)" });
      continue;
    }
    const nib = raw.nib?.trim() || null;
    const key = normName(name);
    if (existingNames.has(key) || seenNames.has(key)) {
      results.push({ row, outcome: "skipped_duplicate", reason: "same name already exists", label: name });
      continue;
    }
    if (nib && (existingNibs.has(nib) || seenNibs.has(nib))) {
      results.push({ row, outcome: "skipped_duplicate", reason: `NIB ${nib} already exists`, label: name });
      continue;
    }
    const payload = {
      name,
      nib,
      incorporation_date: normDate(raw.incorporation_date),
      address: raw.address?.trim() || null,
      drive_folder_url: raw.drive_folder_url?.trim() || null,
      notes: raw.notes?.trim() || null,
    };
    const { error } = await supabase.from("companies").insert(payload);
    if (error) {
      results.push({ row, outcome: "error", reason: error.message, label: name });
      continue;
    }
    seenNames.add(key);
    if (nib) seenNibs.add(nib);
    results.push({ row, outcome: "created", label: name });
  }

  revalidatePath("/companies");
  return summarize(results);
}

/* ---------------- Clients ---------------- */

export type ClientImportRow = {
  full_name: string;
  nationality?: string | null;
  passport_no?: string | null;
  date_of_birth?: string | null;
  place_of_birth?: string | null;
  phone?: string | null;
  email?: string | null;
  preferred_channel?: string | null;
  notes?: string | null;
};

export async function bulkImportClients(rows: ClientImportRow[]): Promise<ImportSummary> {
  const { supabase } = await requireOwner();

  const { data: existing } = await supabase
    .from("clients")
    .select("full_name, passport_no")
    .is("deleted_at", null);
  // Passport is the reliable dedup key when present — someone's full name
  // often has spelling variants. Full name is used only when there's no
  // passport, or when both rows lack one.
  const existingPassports = new Set<string>((existing ?? []).map((r) => r.passport_no).filter(Boolean) as string[]);
  const existingNames = new Set<string>((existing ?? []).map((r) => normName(r.full_name)));

  const seenPassports = new Set<string>();
  const seenNames = new Set<string>();

  const results: ImportResult[] = [];
  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const row = i + 1;
    const full_name = (raw.full_name ?? "").trim();
    if (!full_name) {
      results.push({ row, outcome: "error", reason: "full_name is required", label: "(blank)" });
      continue;
    }
    const passport_no = raw.passport_no ? raw.passport_no.replace(/\s+/g, "").toUpperCase() : null;
    if (passport_no && (existingPassports.has(passport_no) || seenPassports.has(passport_no))) {
      results.push({ row, outcome: "skipped_duplicate", reason: `passport ${passport_no} already exists`, label: full_name });
      continue;
    }
    if (!passport_no) {
      const key = normName(full_name);
      if (existingNames.has(key) || seenNames.has(key)) {
        results.push({ row, outcome: "skipped_duplicate", reason: "same name (and no passport to disambiguate)", label: full_name });
        continue;
      }
    }
    const channel = normChannel(raw.preferred_channel);
    const payload = {
      full_name,
      nationality: raw.nationality?.trim() || null,
      passport_no,
      date_of_birth: normDate(raw.date_of_birth),
      place_of_birth: raw.place_of_birth?.trim() || null,
      phone: raw.phone?.trim() || null,
      email: raw.email?.trim().toLowerCase() || null,
      preferred_channel: channel,
      notes: raw.notes?.trim() || null,
    };
    const { error } = await supabase.from("clients").insert(payload);
    if (error) {
      results.push({ row, outcome: "error", reason: error.message, label: full_name });
      continue;
    }
    if (passport_no) seenPassports.add(passport_no);
    else seenNames.add(normName(full_name));
    results.push({ row, outcome: "created", label: full_name });
  }

  revalidatePath("/clients");
  return summarize(results);
}

/* ---------------- helpers ---------------- */

function normName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Accept either an ISO string (YYYY-MM-DD) or a JS-style date the client
 *  might send. Reject anything that doesn't parse — returning null just
 *  drops the field silently, which is what we want for optional dates. */
function normDate(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** DB has a check constraint on preferred_channel — default to whatsapp
 *  when the sheet's value is blank or unrecognized, so the import doesn't
 *  fail an entire row over one weird cell. */
function normChannel(v: string | null | undefined): "whatsapp" | "email" {
  const s = (v ?? "").toLowerCase().trim();
  if (s === "email" || s === "e-mail" || s === "mail") return "email";
  return "whatsapp";
}

function summarize(results: ImportResult[]): ImportSummary {
  return {
    imported: results.filter((r) => r.outcome === "created").length,
    skipped:  results.filter((r) => r.outcome === "skipped_duplicate").length,
    errored:  results.filter((r) => r.outcome === "error").length,
    results,
  };
}
