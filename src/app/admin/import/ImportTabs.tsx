"use client";
import { useState, useTransition } from "react";
import * as XLSX from "xlsx";
import {
  bulkImportCompanies,
  bulkImportClients,
  type CompanyImportRow,
  type ClientImportRow,
  type ImportSummary,
} from "./actions";

type Mode = "companies" | "clients";

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

export function ImportTabs() {
  const [mode, setMode] = useState<Mode>("companies");
  return (
    <div>
      <div className="flex gap-1 mb-4 border-b border-[var(--border)]">
        <TabButton active={mode === "companies"} onClick={() => setMode("companies")}>Companies</TabButton>
        <TabButton active={mode === "clients"}   onClick={() => setMode("clients")}>Clients</TabButton>
      </div>
      {mode === "companies" ? <CompaniesImport /> : <ClientsImport />}
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
