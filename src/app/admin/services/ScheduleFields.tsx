"use client";
import { useState } from "react";
import { DEFAULT_QUARTERLY_MONTHS, type ServiceScheduleKind } from "@/lib/types";
import { MONTH_LABELS } from "@/lib/renewal";

/** Schedule editor used by both the New Service form and the edit row in
 *  the admin service catalog. Kept in one place so the wire format (the
 *  fields the server action parses) can't drift between create and edit. */
export function ScheduleFields({
  initialKind = "one_off",
  annualMonth  = null,
  annualDay    = null,
  quarterlyDay = 10,
  quarterlyMonths = null,
}: {
  initialKind?: ServiceScheduleKind;
  annualMonth?: number | null;
  annualDay?: number | null;
  quarterlyDay?: number | null;
  quarterlyMonths?: number[] | null;
}) {
  const [kind, setKind] = useState<ServiceScheduleKind>(initialKind);
  const qMonths = new Set<number>(quarterlyMonths ?? DEFAULT_QUARTERLY_MONTHS);

  return (
    <div>
      <label className="block text-[10.5px] font-semibold text-[var(--muted)] uppercase tracking-wide mb-1.5">
        Schedule
      </label>
      <div className="flex flex-wrap gap-3 mb-2 text-[12.5px]">
        <ModeOption value="one_off"         label="One-off"    kind={kind} onSelect={setKind} />
        <ModeOption value="annual_fixed"    label="Annual (fixed date)"    kind={kind} onSelect={setKind} />
        <ModeOption value="quarterly_fixed" label="Quarterly (fixed dates)" kind={kind} onSelect={setKind} />
      </div>
      <input type="hidden" name="schedule_kind" value={kind} />

      {kind === "annual_fixed" && (
        <div className="flex items-center gap-2 mt-2 p-3 rounded-md border border-[var(--border)] bg-[var(--bg)]">
          <label className="text-[12px] text-[var(--muted)]">Every year on</label>
          <select name="annual_month" defaultValue={String(annualMonth ?? 3)}
            className="px-2 py-1 border border-[var(--border)] rounded-md text-sm bg-[var(--surface)]">
            {MONTH_LABELS.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
          <input name="annual_day" type="number" min={1} max={31} defaultValue={annualDay ?? 31}
            className="w-16 px-2 py-1 border border-[var(--border)] rounded-md text-sm tabular-nums" />
          <span className="text-[11.5px] text-[var(--muted)]">
            e.g. Sep 30 for RUPS, Mar 31 for annual tax
          </span>
        </div>
      )}

      {kind === "quarterly_fixed" && (
        <div className="mt-2 p-3 rounded-md border border-[var(--border)] bg-[var(--bg)]">
          <div className="flex items-center gap-2 mb-2">
            <label className="text-[12px] text-[var(--muted)]">Day of month</label>
            <input name="quarterly_day" type="number" min={1} max={31} defaultValue={quarterlyDay ?? 10}
              className="w-16 px-2 py-1 border border-[var(--border)] rounded-md text-sm tabular-nums" />
            <span className="text-[11.5px] text-[var(--muted)]">e.g. 10 for LKPM</span>
          </div>
          <div>
            <div className="text-[11px] text-[var(--muted)] mb-1">Anchor months</div>
            <div className="flex flex-wrap gap-1.5">
              {MONTH_LABELS.map((m, i) => {
                const value = i + 1;
                const checked = qMonths.has(value);
                return (
                  <label key={value} className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[12px] cursor-pointer ${
                    checked ? "bg-brand-softer border-brand text-brand-dark" : "border-[var(--border)] text-ink hover:bg-[var(--surface)]"
                  }`}>
                    <input type="checkbox" name="quarterly_months" value={value} defaultChecked={checked}
                      className="w-3.5 h-3.5 accent-brand" />
                    {m}
                  </label>
                );
              })}
            </div>
            <p className="text-[11px] text-[var(--muted)] mt-1.5">Pick 1–4. Default Jan/Apr/Jul/Oct = LKPM.</p>
          </div>
        </div>
      )}

      {kind === "one_off" && (
        <p className="text-[11.5px] text-[var(--muted)] mt-1">
          No recurrence. Set Validity below if the output has a shelf life (visa, KITAS).
        </p>
      )}
    </div>
  );
}

function ModeOption({
  value, label, kind, onSelect,
}: {
  value: ServiceScheduleKind;
  label: string;
  kind: ServiceScheduleKind;
  onSelect: (v: ServiceScheduleKind) => void;
}) {
  const active = kind === value;
  return (
    <label className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border cursor-pointer ${
      active ? "bg-brand-softer border-brand text-brand-dark font-medium" : "border-[var(--border)] text-ink hover:bg-[var(--surface)]"
    }`}>
      <input type="radio" name="_schedule_kind_ui" value={value} checked={active}
        onChange={() => onSelect(value)} className="w-3.5 h-3.5 accent-brand" />
      {label}
    </label>
  );
}
