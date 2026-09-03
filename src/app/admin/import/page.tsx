import { ImportTabs } from "./ImportTabs";

export default function ImportPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-[26px] text-ink">Import from spreadsheet</h1>
        <p className="text-[var(--muted)] mt-1 max-w-2xl">
          Bulk-load companies or clients from an .xlsx or .csv file. Download the
          template, fill it in, upload it back — a preview shows what will be
          created and what will be skipped as a duplicate before anything hits
          the database.
        </p>
      </div>
      <ImportTabs />
    </div>
  );
}
