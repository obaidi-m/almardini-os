"use client";
import { useMemo, useState, useTransition } from "react";
import * as XLSX from "xlsx";
import {
  bulkImportCompanies,
  bulkImportClients,
  bulkOpenCases,
  type CompanyImportRow,
  type ClientImportRow,
  type ImportSummary,
} from "./actions";
import type { CasePriority } from "@/lib/types";

type Mode = "companies" | "clients" | "open_cases";

type Service = { id: string; code: string; name: string };
type Company = { id: string; code: string; name: string };
type Client  = { id: string; code: string; full_name: string };
type User    = { id: string; full_name: string };

const COMPANY_COLS: (keyof CompanyImportRow)[] = [
  "name", "nib", "incorporation_date", "address", "drive_folder_url", "notes",
];

const CLIENT_COLS: (keyof ClientImportRow)[] = [
  "full_name", "nationality", "passport_no", "date_of_birth", "place_of_birth",
  "phone", "email", "preferred_channel", "notes",
  // Optional company link — either code or name is enough. Role defaults
  // to "director" (the common case); add a `role` column only when a
  // different role is needed. Unknown company becomes a soft warning; the
  // client itself still imports.
  "company_code", "company_name",
];

/** Column hints shown on the template — populate one example row so users
 *  can see the expected shape (dates as YYYY-MM-DD, preferred_channel as
 *  whatsapp/email) rather than guessing. */
const COMPANY_EXAMPLE: Record<string, string> = {
  name: "PT Example Group",
  nib: "1234567890123",
  incorporation_date: "2023-05-14",
  address: "Jl. Sudirman No. 1, Jakarta",
  drive_folder_url: "https://drive.google.com/…",
  notes: "Anything worth remembering",
};
const CLIENT_EXAMPLE: Record<string, string> = {
  full_name: "Jane Doe",
  nationality: "American",
  passport_no: "A12345678",
  date_of_birth: "1990-01-01",
  place_of_birth: "New York",
  phone: "+62812xxxxxxx",
  email: "jane@example.com",
  preferred_channel: "whatsapp",
  notes: "Anything worth remembering",
  company_code: "CMP-0105",
  company_name: "PT Example Group",
};

export function ImportTabs({
  services, companies, clients, users,
}: {
  services: Service[]; companies: Company[]; clients: Client[]; users: User[];
}) {
  const [mode, setMode] = useState<Mode>("companies");
  return (
    <div>
      <div className="flex gap-1 mb-4 border-b border-[var(--border)]">
        <TabButton active={mode === "companies"}  onClick={() => setMode("companies")}>Import companies</TabButton>
        <TabButton active={mode === "clients"}    onClick={() => setMode("clients")}>Import clients</TabButton>
        <TabButton active={mode === "open_cases"} onClick={() => setMode("open_cases")}>Bulk open cases</TabButton>
      </div>
      {mode === "companies"       && <CompaniesImport />}
      {mode === "clients"         && <ClientsImport />}
      {mode === "open_cases"      && <BulkOpenCases services={services} companies={companies} clients={clients} users={users} />}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 text-[13.5px] font-medium border-b-2 -mb-px ${
        active ? "border-brand text-ink" : "border-transparent text-[var(--muted)] hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

/* ---------------- Companies ---------------- */

function CompaniesImport() {
  return (
    <ImportPanel<CompanyImportRow>
      columns={COMPANY_COLS as string[]}
      example={COMPANY_EXAMPLE}
      requiredCol="name"
      templateName="companies-template.xlsx"
      previewLabel={(r) => r.name || "(missing name)"}
      submit={bulkImportCompanies}
    />
  );
}

function ClientsImport() {
  return (
    <ImportPanel<ClientImportRow>
      columns={CLIENT_COLS as string[]}
      example={CLIENT_EXAMPLE}
      requiredCol="full_name"
      templateName="clients-template.xlsx"
      previewLabel={(r) => r.full_name || "(missing full_name)"}
      submit={bulkImportClients}
    />
  );
}

/* ---------------- Shared panel ---------------- */

function ImportPanel<T extends Record<string, unknown>>({
  columns, example, requiredCol, templateName, previewLabel, submit,
}: {
  columns: string[];
  example: Record<string, string>;
  requiredCol: string;
  templateName: string;
  previewLabel: (r: T) => string;
  submit: (rows: T[]) => Promise<ImportSummary>;
}) {
  const [parsed, setParsed] = useState<T[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [pending, start] = useTransition();

  function downloadTemplate() {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([example], { header: columns });
    XLSX.utils.book_append_sheet(wb, ws, "template");
    XLSX.writeFile(wb, templateName);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setSummary(null);
    setParseError(null);
    setFileName(f.name);
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const first = wb.SheetNames[0];
      if (!first) throw new Error("Workbook has no sheets");
      const ws = wb.Sheets[first];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null, raw: false });
      // Keep only known columns; string-coerce values so date cells (which
      // SheetJS returns as JS Date objects when cellDates:true) reach the
      // server as ISO strings we can normalize.
      const shaped: T[] = rows.map((r) => {
        const out: Record<string, unknown> = {};
        for (const c of columns) {
          const v = r[c];
          if (v == null || v === "") { out[c] = null; continue; }
          if (v instanceof Date) {
            const y = v.getFullYear();
            const m = String(v.getMonth() + 1).padStart(2, "0");
            const d = String(v.getDate()).padStart(2, "0");
            out[c] = `${y}-${m}-${d}`;
          } else {
            out[c] = String(v);
          }
        }
        return out as T;
      });
      setParsed(shaped);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Could not read file");
      setParsed(null);
    }
  }

  function reset() {
    setParsed(null); setFileName(null); setParseError(null); setSummary(null);
  }

  function commit() {
    if (!parsed || parsed.length === 0) return;
    start(async () => {
      try {
        const s = await submit(parsed);
        setSummary(s);
      } catch (err) {
        setParseError(err instanceof Error ? err.message : "Import failed");
      }
    });
  }

  const missingRequired = parsed?.filter((r) => !r[requiredCol as keyof T]).length ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 p-4 bg-[var(--surface)] border border-[var(--border)] rounded-[10px]">
        <button
          type="button"
          onClick={downloadTemplate}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand hover:text-brand-dark"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          Download template
        </button>
        <div className="w-px h-5 bg-[var(--border)]" />
        <label className="inline-flex items-center gap-2 text-[13px] cursor-pointer">
          <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile}
            className="text-[12.5px] file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:text-[13px] file:font-medium file:bg-brand file:text-white hover:file:bg-brand-dark file:cursor-pointer" />
        </label>
        {fileName && (
          <button type="button" onClick={reset} className="text-[12px] text-[var(--muted)] hover:text-ink ml-auto">
            Clear
          </button>
        )}
      </div>

      {parseError && (
        <div className="text-[13px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {parseError}
        </div>
      )}

      {parsed && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between gap-3 flex-wrap">
            <div className="text-[13px] text-ink">
              <span className="font-semibold">{parsed.length}</span> rows read from{" "}
              <span className="font-mono text-[12px]">{fileName}</span>
              {missingRequired > 0 && (
                <span className="ml-2 text-[12px] text-red-700">
                  · {missingRequired} rows missing “{requiredCol}” will error
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={commit}
              disabled={pending || parsed.length === 0}
              className="px-4 py-1.5 bg-brand text-white rounded-md text-[13px] font-medium hover:bg-brand-dark disabled:opacity-50"
            >
              {pending ? "Importing…" : `Import ${parsed.length} rows`}
            </button>
          </div>
          <PreviewTable rows={parsed} columns={columns} previewLabel={previewLabel} summary={summary} />
        </div>
      )}

      {summary && (
        <div className="p-4 bg-[var(--surface)] border border-[var(--border)] rounded-[10px]">
          <div className="text-[13px] font-medium text-ink">
            Done — {summary.imported} imported · {summary.skipped} skipped as duplicate · {summary.errored} errors
          </div>
          {(summary.skipped > 0 || summary.errored > 0) && (
            <details className="mt-2">
              <summary className="cursor-pointer text-[12.5px] text-[var(--muted)] hover:text-ink">
                Show details
              </summary>
              <ul className="mt-2 space-y-0.5 text-[12px]">
                {summary.results.filter((r) => r.outcome !== "created").map((r) => (
                  <li key={r.row} className={r.outcome === "error" ? "text-red-700" : "text-[#8A6919]"}>
                    Row {r.row} — {r.label}: {r.reason ?? r.outcome}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function PreviewTable<T extends Record<string, unknown>>({
  rows, columns, previewLabel, summary,
}: {
  rows: T[];
  columns: string[];
  previewLabel: (r: T) => string;
  summary: ImportSummary | null;
}) {
  const outcomeByRow = new Map<number, string>();
  if (summary) {
    for (const r of summary.results) outcomeByRow.set(r.row - 1, r.outcome);
  }

  const maxPreview = 100;
  const shown = rows.slice(0, maxPreview);

  return (
    <div className="overflow-x-auto max-h-[60vh]">
      <table className="w-full text-[12.5px]">
        <thead className="sticky top-0 bg-[var(--bg)]">
          <tr className="text-left uppercase tracking-wider text-[10.5px] text-[var(--muted)] font-semibold border-b border-[var(--border)]">
            <th className="px-3 py-2 w-[40px]">#</th>
            <th className="px-3 py-2 w-[220px]">Preview</th>
            {columns.map((c) => (
              <th key={c} className="px-3 py-2 whitespace-nowrap">{c}</th>
            ))}
            {summary && <th className="px-3 py-2">Result</th>}
          </tr>
        </thead>
        <tbody>
          {shown.map((r, i) => {
            const outcome = outcomeByRow.get(i);
            return (
              <tr key={i} className={`border-b border-[var(--border)] last:border-0 ${
                outcome === "error" ? "bg-red-50" :
                outcome === "skipped_duplicate" ? "bg-amber-50" :
                outcome === "created" ? "bg-green-50" : ""
              }`}>
                <td className="px-3 py-1.5 text-[var(--muted)] font-mono text-[11px]">{i + 1}</td>
                <td className="px-3 py-1.5 text-ink font-medium truncate">{previewLabel(r)}</td>
                {columns.map((c) => (
                  <td key={c} className="px-3 py-1.5 text-[var(--muted)] truncate max-w-[180px]">
                    {String(r[c] ?? "")}
                  </td>
                ))}
                {summary && (
                  <td className="px-3 py-1.5 text-[11px] font-medium">
                    {outcome === "created" ? "✓ created"
                      : outcome === "skipped_duplicate" ? "— skipped"
                      : outcome === "error" ? "× error"
                      : "—"}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length > maxPreview && (
        <div className="px-3 py-2 text-[11.5px] text-[var(--muted)] border-t border-[var(--border)]">
          Showing first {maxPreview} of {rows.length}. All rows will be processed on import.
        </div>
      )}
    </div>
  );
}

/* ---------------- Bulk open cases ---------------- */

function BulkOpenCases({
  services, companies, clients, users,
}: {
  services: Service[]; companies: Company[]; clients: Client[]; users: User[];
}) {
  const [serviceId, setServiceId] = useState<string>("");
  const [target, setTarget] = useState<"companies" | "clients">("companies");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [priority, setPriority] = useState<CasePriority>("normal");
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Rebuilding the list on every filter keystroke is fine at 1000 rows;
  // if this ever hurts, useDeferredValue is the drop-in.
  const list = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (target === "companies") {
      return companies
        .filter((c) => !q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
        .map((c) => ({ id: c.id, label: c.name, code: c.code }));
    }
    return clients
      .filter((c) => !q || c.full_name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
      .map((c) => ({ id: c.id, label: c.full_name, code: c.code }));
  }, [target, filter, companies, clients]);

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function selectAllVisible() { setPicked((prev) => { const n = new Set(prev); for (const x of list) n.add(x.id); return n; }); }
  function clearAll() { setPicked(new Set()); }

  function submit() {
    setError(null); setSummary(null);
    if (!serviceId) { setError("Pick a service"); return; }
    if (picked.size === 0) { setError("Pick at least one target"); return; }
    start(async () => {
      try {
        const s = await bulkOpenCases({
          service_type_id: serviceId,
          target,
          target_ids: [...picked],
          assigned_to: assignedTo || null,
          priority,
          title: title || null,
          deadline: deadline || null,
        });
        setSummary(s);
        setPicked(new Set());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to open cases");
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">
        <div className="space-y-3 p-4 bg-[var(--surface)] border border-[var(--border)] rounded-[10px]">
          <FieldLabel>Service</FieldLabel>
          <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}
            className="w-full px-2.5 py-1.5 border border-[var(--border)] rounded-md text-sm bg-[var(--surface)]">
            <option value="">— pick a service —</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
          </select>

          <FieldLabel>Open cases for</FieldLabel>
          <div className="flex gap-2">
            <SegmentBtn active={target === "companies"} onClick={() => { setTarget("companies"); setPicked(new Set()); }}>Companies</SegmentBtn>
            <SegmentBtn active={target === "clients"}   onClick={() => { setTarget("clients");   setPicked(new Set()); }}>Clients</SegmentBtn>
          </div>

          <FieldLabel>Assign to (optional)</FieldLabel>
          <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}
            className="w-full px-2.5 py-1.5 border border-[var(--border)] rounded-md text-sm bg-[var(--surface)]">
            <option value="">— unassigned —</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <FieldLabel>Priority</FieldLabel>
              <select value={priority} onChange={(e) => setPriority(e.target.value as CasePriority)}
                className="w-full px-2.5 py-1.5 border border-[var(--border)] rounded-md text-sm bg-[var(--surface)]">
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <FieldLabel>Deadline (optional)</FieldLabel>
              <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-[var(--border)] rounded-md text-sm" />
            </div>
          </div>

          <FieldLabel>Case title (optional, same on all)</FieldLabel>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Virtual office renewal 2027"
            className="w-full px-2.5 py-1.5 border border-[var(--border)] rounded-md text-sm" />

          <button type="button" onClick={submit} disabled={pending}
            className="w-full mt-2 px-4 py-2 bg-brand text-white rounded-md text-[13px] font-medium hover:bg-brand-dark disabled:opacity-50">
            {pending ? "Opening…" : `Open ${picked.size || "N"} case${picked.size === 1 ? "" : "s"}`}
          </button>
          {error && <div className="text-[12px] text-red-700">{error}</div>}
        </div>

        <div className="p-4 bg-[var(--surface)] border border-[var(--border)] rounded-[10px]">
          <div className="flex items-center gap-2 mb-2">
            <input value={filter} onChange={(e) => setFilter(e.target.value)}
              placeholder={`Search ${target}…`}
              className="flex-1 px-2.5 py-1.5 border border-[var(--border)] rounded-md text-sm" />
            <button type="button" onClick={selectAllVisible} className="text-[12px] text-brand hover:underline">Select all shown</button>
            <button type="button" onClick={clearAll} className="text-[12px] text-[var(--muted)] hover:text-ink">Clear ({picked.size})</button>
          </div>
          <div className="max-h-[55vh] overflow-y-auto border border-[var(--border)] rounded-md divide-y divide-[var(--border)]">
            {list.length === 0 ? (
              <div className="px-3 py-6 text-center text-[12.5px] text-[var(--muted)]">No matches.</div>
            ) : list.map((row) => {
              const on = picked.has(row.id);
              return (
                <label key={row.id}
                  className={`flex items-center gap-3 px-3 py-1.5 text-[13px] cursor-pointer ${on ? "bg-brand-softer" : "hover:bg-[var(--surface-muted)]"}`}>
                  <input type="checkbox" checked={on} onChange={() => toggle(row.id)} className="w-3.5 h-3.5" />
                  <span className="font-mono text-[11px] text-[var(--muted)] w-[80px] shrink-0">{row.code}</span>
                  <span className="text-ink truncate">{row.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      {summary && (
        <div className="p-4 bg-[var(--surface)] border border-[var(--border)] rounded-[10px]">
          <div className="text-[13px] font-medium text-ink">
            Done — {summary.imported} opened · {summary.skipped} skipped · {summary.errored} errors
          </div>
          {(summary.skipped > 0 || summary.errored > 0) && (
            <ul className="mt-2 space-y-0.5 text-[12px]">
              {summary.results.filter((r) => r.outcome !== "created").map((r) => (
                <li key={r.row} className={r.outcome === "error" ? "text-red-700" : "text-[#8A6919]"}>
                  {r.label}: {r.reason ?? r.outcome}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10.5px] font-semibold text-[var(--muted)] uppercase tracking-wide mb-1">
      {children}
    </label>
  );
}

function SegmentBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex-1 px-3 py-1.5 rounded-md border text-[13px] ${
        active ? "bg-brand-softer border-brand text-brand-dark font-medium" : "border-[var(--border)] text-ink hover:bg-[var(--surface-muted)]"
      }`}>
      {children}
    </button>
  );
}
