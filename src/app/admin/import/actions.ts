"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { CasePriority } from "@/lib/types";

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
  // Optional company link: either company_code (preferred, unambiguous) or
  // company_name (case-insensitive match). role must exist in company_roles.
  company_code?: string | null;
  company_name?: string | null;
  role?: string | null;
};

export async function bulkImportClients(rows: ClientImportRow[]): Promise<ImportSummary> {
  const { supabase } = await requireOwner();

  const [{ data: existing }, { data: companyList }, { data: roleList }] = await Promise.all([
    supabase.from("clients").select("id, full_name, passport_no").is("deleted_at", null),
    supabase.from("companies").select("id, code, name").is("deleted_at", null),
    supabase.from("company_roles").select("code"),
  ]);

  // Passport is the reliable dedup key when present — someone's full name
  // often has spelling variants. Full name is used only when there's no
  // passport, or when both rows lack one.
  const existingPassports = new Set<string>((existing ?? []).map((r) => r.passport_no).filter(Boolean) as string[]);
  const existingNames = new Set<string>((existing ?? []).map((r) => normName(r.full_name)));

  // Lookup maps for the optional company link. Code match is exact
  // (uppercase); name match is case-insensitive and skipped when ambiguous
  // (two live companies with the same name) so we don't guess.
  const companiesByCode = new Map<string, string>();
  const companyNameHits = new Map<string, string[]>();
  for (const c of (companyList ?? []) as Array<{ id: string; code: string; name: string }>) {
    companiesByCode.set(c.code.toUpperCase(), c.id);
    const k = normName(c.name);
    const arr = companyNameHits.get(k) ?? [];
    arr.push(c.id);
    companyNameHits.set(k, arr);
  }
  const validRoles = new Set<string>((roleList ?? []).map((r) => r.code));

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
    const { data: created, error } = await supabase.from("clients").insert(payload).select("id").single();
    if (error) {
      results.push({ row, outcome: "error", reason: error.message, label: full_name });
      continue;
    }
    if (passport_no) seenPassports.add(passport_no);
    else seenNames.add(normName(full_name));

    // Optional company link — success or "created but link failed" both
    // still count the client as created, since the client itself is in.
    const linkNote = await tryLinkCompany({
      supabase, clientId: created.id, raw,
      companiesByCode, companyNameHits, validRoles,
    });
    results.push({ row, outcome: "created", label: linkNote ? `${full_name} — ${linkNote}` : full_name });
  }

  revalidatePath("/clients");
  return summarize(results);
}

/** Try to link the freshly-inserted client to a company named in the sheet.
 *  Returns a human string describing what happened (or nothing when the
 *  sheet didn't ask for a link at all). Never throws — a bad link is a
 *  soft failure the operator can fix by hand later. */
async function tryLinkCompany({
  supabase, clientId, raw, companiesByCode, companyNameHits, validRoles,
}: {
  supabase: Awaited<ReturnType<typeof requireOwner>>["supabase"];
  clientId: string;
  raw: ClientImportRow;
  companiesByCode: Map<string, string>;
  companyNameHits: Map<string, string[]>;
  validRoles: Set<string>;
}): Promise<string | null> {
  const codeCell = raw.company_code?.trim();
  const nameCell = raw.company_name?.trim();
  // Default to "director" when the sheet doesn't say — that's the common
  // case and matches what the user asked for. Only validated against
  // company_roles if the sheet supplied an explicit value.
  const roleCell = raw.role?.trim() || "director";
  if (!codeCell && !nameCell) return null;
  if (raw.role?.trim() && !validRoles.has(roleCell)) return `unknown role "${roleCell}" — link skipped`;
  if (!raw.role?.trim() && !validRoles.has(roleCell)) {
    return `default role "director" not defined in company_roles — link skipped`;
  }

  let companyId: string | null = null;
  if (codeCell) {
    companyId = companiesByCode.get(codeCell.toUpperCase()) ?? null;
    if (!companyId) return `company code "${codeCell}" not found — link skipped`;
  } else if (nameCell) {
    const hits = companyNameHits.get(normName(nameCell)) ?? [];
    if (hits.length === 0) return `company "${nameCell}" not found — link skipped`;
    if (hits.length > 1)  return `company "${nameCell}" is ambiguous (${hits.length} matches) — use company_code`;
    companyId = hits[0];
  }
  if (!companyId) return null;

  const { error } = await supabase
    .from("client_companies")
    .insert({ client_id: clientId, company_id: companyId, role: roleCell });
  if (error) {
    // Unique-constraint violation on (client_id, company_id, role) means
    // the link already exists (from a previous import). Treat as success.
    if (error.code === "23505") return "already linked";
    return `link failed: ${error.message}`;
  }
  return `linked to company as ${roleCell}`;
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

/* ---------------- Bulk open cases ---------------- */

/** Bulk-open one case per selected company or client for a single service.
 *  Nothing else — no per-row title override, no per-row deadline — because
 *  the common shape here is "we're kicking off the same service for N
 *  entities in one sitting" (e.g. 70 virtual office renewals) and any
 *  per-row detail belongs on the case itself after creation.
 *
 *  Duplicate protection: for each target, if a non-deleted case already
 *  exists for the same (target, service) that isn't yet Delivered, we
 *  skip — otherwise a slip of the mouse would open a second live case
 *  for the same filing. */
export type BulkOpenCasesInput = {
  service_type_id: string;
  target: "companies" | "clients";
  target_ids: string[];
  assigned_to?: string | null;
  priority?: CasePriority;
  title?: string | null;
  deadline?: string | null;   // ISO YYYY-MM-DD, optional
};

export async function bulkOpenCases(input: BulkOpenCasesInput): Promise<ImportSummary> {
  const { supabase, actorId } = await requireOwner();
  const priority: CasePriority = input.priority ?? "normal";

  if (!input.service_type_id) throw new Error("Pick a service");
  if (input.target_ids.length === 0) throw new Error("Pick at least one target");

  // Resolve display labels so the result table isn't just a wall of ids.
  const { data: labelRows } = input.target === "companies"
    ? await supabase.from("companies").select("id, code, name").in("id", input.target_ids)
    : await supabase.from("clients").select("id, code, full_name").in("id", input.target_ids);
  const labelById = new Map<string, string>();
  for (const r of (labelRows ?? []) as Array<{ id: string; code: string; name?: string; full_name?: string }>) {
    labelById.set(r.id, `${r.code} — ${r.name ?? r.full_name ?? ""}`);
  }

  // Guard against re-opening a case for a target that already has an open
  // one on the same service. Uses !=delivered so a delivered case (which
  // is the "closed and archived" state) doesn't block a new cycle.
  const targetCol = input.target === "companies" ? "company_id" : "client_id";
  const { data: existingCases } = await supabase
    .from("cases")
    .select(`id, ${targetCol}`)
    .eq("service_type_id", input.service_type_id)
    .in(targetCol, input.target_ids)
    .neq("status", "delivered")
    .is("deleted_at", null);
  const alreadyOpen = new Set<string>(
    ((existingCases ?? []) as Array<Record<string, string>>).map((r) => r[targetCol]),
  );

  const results: ImportResult[] = [];
  let rowNum = 0;
  for (const id of input.target_ids) {
    rowNum++;
    const label = labelById.get(id) ?? id;
    if (alreadyOpen.has(id)) {
      results.push({ row: rowNum, outcome: "skipped_duplicate", reason: "already has an open case for this service", label });
      continue;
    }
    const payload = {
      client_id:       input.target === "clients"   ? id : null,
      company_id:      input.target === "companies" ? id : null,
      service_type_id: input.service_type_id,
      priority,
      assigned_to:     input.assigned_to || null,
      deadline:        input.deadline || null,
      title:           input.title?.trim() || null,
      created_by:      actorId,
      updated_by:      actorId,
    };
    const { error } = await supabase.from("cases").insert(payload);
    if (error) {
      results.push({ row: rowNum, outcome: "error", reason: error.message, label });
      continue;
    }
    results.push({ row: rowNum, outcome: "created", label });
  }

  revalidatePath("/cases");
  return summarize(results);
}

/* ---------------- Virtual offices ---------------- */

export type VirtualOfficeImportRow = {
  company_name: string;
  tier?: string | null;
  term_months?: string | null;
  start_date?: string | null;
  end_date: string;
  status?: string | null;
  responsible_partner_name?: string | null;
  notes?: string | null;
};

const VO_TIERS = new Set(["bronze", "silver", "gold", "platinum"]);
const VO_STATUSES = new Set(["active", "expired", "terminated"]);

export async function bulkImportVirtualOffices(rows: VirtualOfficeImportRow[]): Promise<ImportSummary> {
  const { supabase, actorId } = await requireOwner();

  const [{ data: companyList }, { data: existingVOs }, { data: partnerList }] = await Promise.all([
    supabase.from("companies").select("id, name").is("deleted_at", null),
    supabase.from("virtual_offices").select("id, company_id, end_date, tier, responsible_partner_id").is("deleted_at", null),
    supabase.from("partners").select("id, name").is("deleted_at", null),
  ]);

  // Map: normalized name -> company_id (if unambiguous). Duplicates get flagged
  // per row so we don't guess which one the sheet meant.
  const companyIdsByName = new Map<string, string[]>();
  for (const c of (companyList ?? []) as Array<{ id: string; name: string }>) {
    const k = normName(c.name);
    const arr = companyIdsByName.get(k) ?? [];
    arr.push(c.id);
    companyIdsByName.set(k, arr);
  }
  // Dup key = (company_id, tier, end_date). Same tenancy shouldn't import
  // twice — but if it exists AND the existing row has no
  // responsible_partner_id yet, we still resolve the partner from the sheet
  // and back-fill it. Lets a second run finish setting up rows that were
  // imported before the PJ column existed.
  const existingByKey = new Map<string, { id: string; responsible_partner_id: string | null }>();
  for (const v of (existingVOs ?? []) as Array<{ id: string; company_id: string; end_date: string; tier: string; responsible_partner_id: string | null }>) {
    existingByKey.set(`${v.company_id}|${v.tier}|${v.end_date}`, { id: v.id, responsible_partner_id: v.responsible_partner_id });
  }
  const seenKeys = new Set<string>();

  // Partner lookup: normalized name -> ids. Ambiguous names (two partners
  // with the same name) surface as a warning per row and are left empty
  // rather than guessed.
  const partnerIdsByName = new Map<string, string[]>();
  for (const p of (partnerList ?? []) as Array<{ id: string; name: string }>) {
    const k = normName(p.name);
    const arr = partnerIdsByName.get(k) ?? [];
    arr.push(p.id);
    partnerIdsByName.set(k, arr);
  }

  const results: ImportResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const rowNum = i + 1;
    const name = (raw.company_name ?? "").trim();
    if (!name) {
      results.push({ row: rowNum, outcome: "error", reason: "company_name is required", label: "(blank)" });
      continue;
    }
    const end_date = normDate(raw.end_date);
    if (!end_date) {
      results.push({ row: rowNum, outcome: "error", reason: "end_date is required", label: name });
      continue;
    }

    // Resolve the company. Auto-create if not on file (this xlsx is the
    // source of truth for many of them). Ambiguous name = flag and skip so
    // the operator picks by hand.
    let company_id: string;
    const nk = normName(name);
    const hits = companyIdsByName.get(nk) ?? [];
    if (hits.length > 1) {
      results.push({ row: rowNum, outcome: "error", reason: `multiple companies named "${name}" — pick one manually`, label: name });
      continue;
    }
    if (hits.length === 1) {
      company_id = hits[0];
    } else {
      const { data: created, error: cErr } = await supabase
        .from("companies")
        .insert({ name })
        .select("id")
        .single();
      if (cErr || !created) {
        results.push({ row: rowNum, outcome: "error", reason: cErr?.message ?? "failed to create company", label: name });
        continue;
      }
      company_id = created.id;
      companyIdsByName.set(nk, [company_id]); // subsequent rows reuse it
    }

    const tier = (raw.tier ?? "silver").toLowerCase().trim();
    if (!VO_TIERS.has(tier)) {
      results.push({ row: rowNum, outcome: "error", reason: `invalid tier "${tier}"`, label: name });
      continue;
    }
    const status = (raw.status ?? "active").toLowerCase().trim();
    if (!VO_STATUSES.has(status)) {
      results.push({ row: rowNum, outcome: "error", reason: `invalid status "${status}"`, label: name });
      continue;
    }
    const term_months = Number(raw.term_months);
    const term = Number.isFinite(term_months) && term_months > 0 ? Math.floor(term_months) : 12;

    // Responsible partner: optional. Match by name; auto-create if the
    // partner isn't on file (defaults to type='referrer', which fits a PJ);
    // leave empty only when the name is ambiguous (two live partners same
    // name) so we don't silently guess the wrong one. Runs BEFORE the dup
    // check so we can back-fill a partner onto a VO that already exists.
    let responsible_partner_id: string | null = null;
    const respName = (raw.responsible_partner_name ?? "").trim();
    if (respName) {
      const pk = normName(respName);
      const hits = partnerIdsByName.get(pk) ?? [];
      if (hits.length > 1) {
        // ambiguous — leave empty, user resolves it later
      } else if (hits.length === 1) {
        responsible_partner_id = hits[0];
      } else {
        const { data: created, error: pErr } = await supabase
          .from("partners")
          .insert({ name: respName, type: "referrer" })
          .select("id")
          .single();
        if (!pErr && created) {
          responsible_partner_id = created.id;
          partnerIdsByName.set(pk, [created.id]); // subsequent rows reuse it
        }
        // On error, silently leave empty — the VO row still imports.
      }
    }

    const dupKey = `${company_id}|${tier}|${end_date}`;
    const dup = existingByKey.get(dupKey);
    if (dup || seenKeys.has(dupKey)) {
      // Back-fill the partner on an existing VO row if we resolved one and
      // the row didn't have one yet. Otherwise it's a plain duplicate.
      if (dup && responsible_partner_id && !dup.responsible_partner_id) {
        const { error: upErr } = await supabase
          .from("virtual_offices")
          .update({ responsible_partner_id, updated_by: actorId })
          .eq("id", dup.id);
        if (upErr) {
          results.push({ row: rowNum, outcome: "error", reason: `couldn't set PJ: ${upErr.message}`, label: name });
        } else {
          results.push({ row: rowNum, outcome: "created", reason: "PJ back-filled on existing row", label: name });
          dup.responsible_partner_id = responsible_partner_id;
        }
      } else {
        results.push({ row: rowNum, outcome: "skipped_duplicate", reason: `${tier} ending ${end_date} already exists`, label: name });
      }
      continue;
    }

    const { error } = await supabase.from("virtual_offices").insert({
      company_id,
      tier,
      term_months: term,
      start_date: normDate(raw.start_date),
      end_date,
      status,
      notes: raw.notes?.trim() || null,
      responsible_partner_id,
      created_by: actorId,
      updated_by: actorId,
    });
    if (error) {
      results.push({ row: rowNum, outcome: "error", reason: error.message, label: name });
      continue;
    }
    seenKeys.add(dupKey);
    results.push({ row: rowNum, outcome: "created", label: name });
  }

  revalidatePath("/virtual-offices");
  revalidatePath("/companies");
  return summarize(results);
}

/* ---------------- Permits ---------------- */

export type PermitImportRow = {
  client_code?: string | null;         // preferred — unique
  client_name?: string | null;         // fallback — case-insensitive match
  kind: string;
  reference_no?: string | null;
  issued_date?: string | null;
  expires_date: string;
  status?: string | null;
  sponsor_company_name?: string | null;
  responsible_partner_name?: string | null;
  notes?: string | null;
};

const PERMIT_STATUSES = new Set(["active", "expired", "terminated"]);

export async function bulkImportPermits(rows: PermitImportRow[]): Promise<ImportSummary> {
  const { supabase, actorId } = await requireOwner();

  const [{ data: clientList }, { data: companyList }, { data: partnerList }, { data: existingPermits }] = await Promise.all([
    supabase.from("clients").select("id, code, full_name").is("deleted_at", null),
    supabase.from("companies").select("id, name").is("deleted_at", null),
    supabase.from("partners").select("id, name").is("deleted_at", null),
    supabase.from("permits").select("id, client_id, kind, expires_date, responsible_partner_id").is("deleted_at", null),
  ]);

  // Client lookup: exact code (uppercase) OR case-insensitive name.
  const clientsByCode = new Map<string, string>();
  const clientIdsByName = new Map<string, string[]>();
  for (const c of (clientList ?? []) as Array<{ id: string; code: string; full_name: string }>) {
    clientsByCode.set(c.code.toUpperCase(), c.id);
    const k = normName(c.full_name);
    const arr = clientIdsByName.get(k) ?? [];
    arr.push(c.id);
    clientIdsByName.set(k, arr);
  }
  // Company lookup for sponsor: match-only (don't auto-create — permit
  // import shouldn't spawn companies the operator didn't set up).
  const companyIdsByName = new Map<string, string[]>();
  for (const c of (companyList ?? []) as Array<{ id: string; name: string }>) {
    const k = normName(c.name);
    const arr = companyIdsByName.get(k) ?? [];
    arr.push(c.id);
    companyIdsByName.set(k, arr);
  }
  // Partner lookup for PJ: auto-create (same as VO importer).
  const partnerIdsByName = new Map<string, string[]>();
  for (const p of (partnerList ?? []) as Array<{ id: string; name: string }>) {
    const k = normName(p.name);
    const arr = partnerIdsByName.get(k) ?? [];
    arr.push(p.id);
    partnerIdsByName.set(k, arr);
  }
  // Dup key = (client_id, kind, expires_date). Back-fills PJ on existing.
  const existingByKey = new Map<string, { id: string; responsible_partner_id: string | null }>();
  for (const p of (existingPermits ?? []) as Array<{ id: string; client_id: string; kind: string; expires_date: string; responsible_partner_id: string | null }>) {
    existingByKey.set(`${p.client_id}|${p.kind.toLowerCase()}|${p.expires_date}`, { id: p.id, responsible_partner_id: p.responsible_partner_id });
  }
  const seenKeys = new Set<string>();

  const results: ImportResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const rowNum = i + 1;
    const kind = (raw.kind ?? "").trim();
    if (!kind) {
      results.push({ row: rowNum, outcome: "error", reason: "kind is required", label: "(blank)" });
      continue;
    }
    const expires_date = normDate(raw.expires_date);
    if (!expires_date) {
      results.push({ row: rowNum, outcome: "error", reason: "expires_date is required", label: kind });
      continue;
    }

    // Resolve client. Code first (unambiguous), then name.
    let client_id: string | null = null;
    let holderLabel = "";
    const code = (raw.client_code ?? "").trim().toUpperCase();
    const nameStr = (raw.client_name ?? "").trim();
    if (code) {
      client_id = clientsByCode.get(code) ?? null;
      holderLabel = code;
      if (!client_id) {
        results.push({ row: rowNum, outcome: "error", reason: `no client with code ${code}`, label: `${code} · ${kind}` });
        continue;
      }
    } else if (nameStr) {
      const hits = clientIdsByName.get(normName(nameStr)) ?? [];
      holderLabel = nameStr;
      if (hits.length === 0) {
        results.push({ row: rowNum, outcome: "error", reason: `no client named "${nameStr}"`, label: `${nameStr} · ${kind}` });
        continue;
      }
      if (hits.length > 1) {
        results.push({ row: rowNum, outcome: "error", reason: `multiple clients named "${nameStr}" — use client_code instead`, label: `${nameStr} · ${kind}` });
        continue;
      }
      client_id = hits[0];
    } else {
      results.push({ row: rowNum, outcome: "error", reason: "one of client_code or client_name is required", label: kind });
      continue;
    }

    const status = (raw.status ?? "active").toLowerCase().trim();
    if (!PERMIT_STATUSES.has(status)) {
      results.push({ row: rowNum, outcome: "error", reason: `invalid status "${status}"`, label: `${holderLabel} · ${kind}` });
      continue;
    }

    // Sponsor: match-only.
    let sponsor_company_id: string | null = null;
    const sponsorName = (raw.sponsor_company_name ?? "").trim();
    if (sponsorName) {
      const hits = companyIdsByName.get(normName(sponsorName)) ?? [];
      if (hits.length === 1) sponsor_company_id = hits[0];
      // 0 or >1 → leave empty; ambiguous or unknown sponsors don't block the row.
    }

    // Responsible partner: match; auto-create when missing (same rule as VO importer).
    let responsible_partner_id: string | null = null;
    const respName = (raw.responsible_partner_name ?? "").trim();
    if (respName) {
      const pk = normName(respName);
      const hits = partnerIdsByName.get(pk) ?? [];
      if (hits.length > 1) {
        // ambiguous — leave empty
      } else if (hits.length === 1) {
        responsible_partner_id = hits[0];
      } else {
        const { data: created, error: pErr } = await supabase
          .from("partners")
          .insert({ name: respName, type: "referrer" })
          .select("id")
          .single();
        if (!pErr && created) {
          responsible_partner_id = created.id;
          partnerIdsByName.set(pk, [created.id]);
        }
      }
    }

    const dupKey = `${client_id}|${kind.toLowerCase()}|${expires_date}`;
    const dup = existingByKey.get(dupKey);
    if (dup || seenKeys.has(dupKey)) {
      if (dup && responsible_partner_id && !dup.responsible_partner_id) {
        const { error: upErr } = await supabase
          .from("permits")
          .update({ responsible_partner_id, updated_by: actorId })
          .eq("id", dup.id);
        if (upErr) {
          results.push({ row: rowNum, outcome: "error", reason: `couldn't set PJ: ${upErr.message}`, label: `${holderLabel} · ${kind}` });
        } else {
          results.push({ row: rowNum, outcome: "created", reason: "PJ back-filled on existing permit", label: `${holderLabel} · ${kind}` });
          dup.responsible_partner_id = responsible_partner_id;
        }
      } else {
        results.push({ row: rowNum, outcome: "skipped_duplicate", reason: `${kind} expiring ${expires_date} already exists for this client`, label: `${holderLabel} · ${kind}` });
      }
      continue;
    }

    const { error } = await supabase.from("permits").insert({
      client_id,
      kind,
      reference_no: raw.reference_no?.trim() || null,
      issued_date: normDate(raw.issued_date),
      expires_date,
      status,
      sponsor_company_id,
      responsible_partner_id,
      notes: raw.notes?.trim() || null,
      created_by: actorId,
      updated_by: actorId,
    });
    if (error) {
      results.push({ row: rowNum, outcome: "error", reason: error.message, label: `${holderLabel} · ${kind}` });
      continue;
    }
    seenKeys.add(dupKey);
    results.push({ row: rowNum, outcome: "created", label: `${holderLabel} · ${kind}` });
  }

  revalidatePath("/permits");
  revalidatePath("/clients");
  return summarize(results);
}

function summarize(results: ImportResult[]): ImportSummary {
  return {
    imported: results.filter((r) => r.outcome === "created").length,
    skipped:  results.filter((r) => r.outcome === "skipped_duplicate").length,
    errored:  results.filter((r) => r.outcome === "error").length,
    results,
  };
}
