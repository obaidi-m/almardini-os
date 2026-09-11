"use client";

import { useMemo, useState } from "react";
import { MONTH_LABELS, describeSchedule } from "@/lib/renewal";
import { DEFAULT_QUARTERLY_MONTHS, type ServiceScheduleKind } from "@/lib/types";

// The one control that used to be three: "Type of tracking" + "Schedule" +
// stand-alone Validity. Everything about *how a service repeats* lives here
// so illegal combinations are impossible to express.
//
// User picks one of three modes; sub-fields appear inline under the pick.
// Below the whole block, a live preview line reads the current settings
// back in plain English — if it reads wrong, the settings are wrong.
//
// Wire fields written (matches the server action parser unchanged):
//   schedule_kind, annual_month, annual_day,
//   quarterly_day, quarterly_months (multiple),
//   validity_amount, validity_unit,
//   tracks_expiry, is_ongoing, has_deliverable.
// The last three are DERIVED from the mode + shelf-life choice — the user
// never sees them. is_ongoing is always false now (Continuously was dropped).

type Mode = "one_off" | "calendar_fixed" | "rolling";
type CalendarShape = "monthly" | "quarterly" | "annual";

const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function modeFromKind(k: ServiceScheduleKind | null | undefined): Mode {
  if (k === "annual_fixed" || k === "quarterly_fixed") return "calendar_fixed";
  if (k === "rolling") return "rolling";
  return "one_off";
}

function shapeFromKind(
  k: ServiceScheduleKind | null | undefined,
  quarterlyMonths: number[] | null,
): CalendarShape {
  if (k === "annual_fixed") return "annual";
  if (k === "quarterly_fixed") {
    return (quarterlyMonths?.length ?? 4) === 12 ? "monthly" : "quarterly";
  }
  return "annual";
}

export function RepeatBlock({
  initialKind = "one_off",
  annualMonth = null,
  annualDay = null,
  quarterlyDay = 10,
  quarterlyMonths = null,
  validityAmount = null,
  validityUnit = null,
}: {
  initialKind?: ServiceScheduleKind | null;
  annualMonth?: number | null;
  annualDay?: number | null;
  quarterlyDay?: number | null;
  quarterlyMonths?: number[] | null;
  validityAmount?: number | null;
  validityUnit?: string | null;
}) {
  const [mode, setMode] = useState<Mode>(modeFromKind(initialKind));
  const [shape, setShape] = useState<CalendarShape>(shapeFromKind(initialKind, quarterlyMonths ?? null));
  const [hasShelfLife, setHasShelfLife] = useState<boolean>(
    initialKind === "one_off" && !!validityAmount && !!validityUnit,
  );

  // Editable state for the sub-fields so the preview line stays live.
  const [aMonth, setAMonth] = useState<number>(annualMonth ?? 3);
  const [aDay, setADay] = useState<number>(annualDay ?? 31);
  const [qDay, setQDay] = useState<number>(quarterlyDay ?? 10);
  const [qMonths, setQMonths] = useState<Set<number>>(
    new Set(quarterlyMonths ?? DEFAULT_QUARTERLY_MONTHS),
  );
  const [vAmount, setVAmount] = useState<string>(
    validityAmount != null ? String(validityAmount) : "",
  );
  const [vUnit, setVUnit] = useState<string>(validityUnit ?? "months");

  // Compute the wire schedule_kind + which validity to emit. Monthly and
  // Quarterly are both stored as quarterly_fixed — monthly = all 12 anchor
  // months. That way we don't invent a new kind for what is structurally
  // the same shape (day-of-month × N anchors).
  const scheduleKind: ServiceScheduleKind =
    mode === "rolling"
      ? "rolling"
      : mode === "calendar_fixed"
      ? shape === "annual"
        ? "annual_fixed"
        : "quarterly_fixed"
      : "one_off";

  // What months get written when calendar-fixed. Monthly = all 12; Quarterly
  // = whatever the user ticked (defaulted to Jan/Apr/Jul/Oct); Annual = none.
  const emittedQuarterlyMonths =
    mode === "calendar_fixed" && shape === "monthly"
      ? ALL_MONTHS
      : mode === "calendar_fixed" && shape === "quarterly"
      ? Array.from(qMonths)
      : [];

  // For preview + wire: only rolling emits validity globally. One-off
  // shelf life is per-instance — set on the permit when it's created.
  const emitValidity = mode === "rolling";
  const validityForWire = emitValidity && vAmount ? Number(vAmount) : null;
  const validityUnitForWire = emitValidity && vAmount ? vUnit : "";

  // Derived flags — user never sees these.
  const tracksExpiry =
    mode === "rolling" ||
    mode === "calendar_fixed" ||
    (mode === "one_off" && hasShelfLife);
  const isOngoing = false; // Continuously was dropped.
  const hasDeliverable = true; // Kept as safe default; old design, being retired.

  const preview = useMemo(
    () =>
      describeSchedule({
        schedule_kind: scheduleKind,
        annual_month: mode === "calendar_fixed" && shape === "annual" ? aMonth : null,
        annual_day:   mode === "calendar_fixed" && shape === "annual" ? aDay : null,
        quarterly_day:    mode === "calendar_fixed" && shape !== "annual" ? qDay : null,
        quarterly_months: mode === "calendar_fixed" && shape !== "annual"
          ? emittedQuarterlyMonths
          : null,
        validity_amount: validityForWire,
        validity_unit: validityUnitForWire || null,
      }),
    [scheduleKind, mode, shape, aMonth, aDay, qDay, qMonths, validityForWire, validityUnitForWire],
  );

  return (
    <div>
      <label className="block text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wide mb-2">
        How does this repeat?
      </label>

      <div className="space-y-2">
        <ModeCard
          selected={mode === "one_off"}
          onSelect={() => setMode("one_off")}
          title="Never (one-off)"
          hint="A single delivered job. KITAS, PT PMA formation."
        >
          <label className="flex items-center gap-2 text-[12.5px] cursor-pointer select-none mt-2">
            <input
              type="checkbox"
              checked={hasShelfLife}
              onChange={(e) => setHasShelfLife(e.target.checked)}
              className="w-3.5 h-3.5 accent-brand"
            />
            Output has a shelf life
            <span className="text-[var(--muted)] text-[11.5px]">(end date set per permit)</span>
          </label>
        </ModeCard>

        <ModeCard
          selected={mode === "calendar_fixed"}
          onSelect={() => setMode("calendar_fixed")}
          title="On a fixed calendar date"
          hint="Same day every year for everyone. RUPS, annual tax, LKPM."
        >
          <div className="mt-2 space-y-2">
            <div className="inline-flex bg-[var(--bg)] border border-[var(--border)] rounded-lg p-0.5">
              <ShapeToggle value="monthly"   label="Monthly"   current={shape} onSelect={setShape} />
              <ShapeToggle value="quarterly" label="Quarterly" current={shape} onSelect={setShape} />
              <ShapeToggle value="annual"    label="Annual"    current={shape} onSelect={setShape} />
            </div>

            {shape === "annual" && (
              <div className="flex items-center gap-2 text-[12.5px]">
                <span className="text-[var(--muted)]">Every year on</span>
                <select
                  value={aMonth}
                  onChange={(e) => setAMonth(Number(e.target.value))}
                  className="px-2 py-1 border border-[var(--border)] rounded-md text-sm bg-[var(--surface)]"
                >
                  {MONTH_LABELS.map((m, i) => (
                    <option key={i} value={i + 1}>{m}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={aDay}
                  onChange={(e) => setADay(Number(e.target.value))}
                  className="w-16 px-2 py-1 border border-[var(--border)] rounded-md text-sm tabular-nums"
                />
              </div>
            )}

            {shape === "monthly" && (
              <div className="flex items-center gap-2 text-[12.5px]">
                <span className="text-[var(--muted)]">Every month on day</span>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={qDay}
                  onChange={(e) => setQDay(Number(e.target.value))}
                  className="w-16 px-2 py-1 border border-[var(--border)] rounded-md text-sm tabular-nums"
                />
              </div>
            )}

            {shape === "quarterly" && (
              <div className="text-[12.5px] space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--muted)]">On day</span>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={qDay}
                    onChange={(e) => setQDay(Number(e.target.value))}
                    className="w-16 px-2 py-1 border border-[var(--border)] rounded-md text-sm tabular-nums"
                  />
                  <span className="text-[var(--muted)]">of these months:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {MONTH_LABELS.map((m, i) => {
                    const value = i + 1;
                    const checked = qMonths.has(value);
                    return (
                      <label
                        key={value}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[12px] cursor-pointer ${
                          checked
                            ? "bg-brand-softer border-brand text-brand-dark"
                            : "border-[var(--border)] text-ink hover:bg-[var(--surface)]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = new Set(qMonths);
                            if (e.target.checked) next.add(value); else next.delete(value);
                            setQMonths(next);
                          }}
                          className="w-3.5 h-3.5 accent-brand"
                        />
                        {m}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </ModeCard>

        <ModeCard
          selected={mode === "rolling"}
          onSelect={() => setMode("rolling")}
          title="On a rolling term from purchase"
          hint="Each customer's cycle starts from their own date. Virtual office."
        >
          <div className="mt-2 flex items-center gap-2 text-[12.5px]">
            <span className="text-[var(--muted)]">Renews every</span>
            <input
              type="number"
              min={1}
              step={1}
              value={vAmount}
              onChange={(e) => setVAmount(e.target.value)}
              placeholder="12"
              className="w-16 px-2 py-1 border border-[var(--border)] rounded-md text-sm tabular-nums"
              required={mode === "rolling"}
            />
            <select
              value={vUnit}
              onChange={(e) => setVUnit(e.target.value)}
              className="px-2 py-1 border border-[var(--border)] rounded-md text-sm bg-[var(--surface)]"
            >
              <option value="days">days</option>
              <option value="months">months</option>
              <option value="years">years</option>
            </select>
          </div>
        </ModeCard>
      </div>

      <div className="mt-3 flex items-start gap-2 text-[12px] text-ink bg-brand-softer/50 border border-brand-softer rounded-md px-3 py-2">
        <span className="text-brand-dark">📖</span>
        <span>{preview}</span>
      </div>

      {/* Hidden wire fields for the server action. Everything above is UI. */}
      <input type="hidden" name="schedule_kind" value={scheduleKind} />

      {mode === "calendar_fixed" && shape === "annual" && (
        <>
          <input type="hidden" name="annual_month" value={aMonth} />
          <input type="hidden" name="annual_day" value={aDay} />
        </>
      )}

      {mode === "calendar_fixed" && shape !== "annual" && (
        <>
          <input type="hidden" name="quarterly_day" value={qDay} />
          {emittedQuarterlyMonths.map((m) => (
            <input key={m} type="hidden" name="quarterly_months" value={m} />
          ))}
        </>
      )}

      <input type="hidden" name="validity_amount" value={validityForWire ?? ""} />
      <input type="hidden" name="validity_unit"   value={validityUnitForWire} />

      <input type="hidden" name="tracks_expiry"   value={tracksExpiry ? "true" : "false"} />
      <input type="hidden" name="is_ongoing"      value={isOngoing ? "true" : "false"} />
      <input type="hidden" name="has_deliverable" value={hasDeliverable ? "true" : "false"} />
    </div>
  );
}

function ModeCard({
  selected, onSelect, title, hint, children,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  hint: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      onClick={onSelect}
      className={`rounded-lg border p-3 cursor-pointer transition-colors ${
        selected
          ? "border-brand bg-brand/5"
          : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--muted)]"
      }`}
    >
      <div className="flex items-start gap-2">
        <input
          type="radio"
          checked={selected}
          onChange={onSelect}
          className="mt-1 w-3.5 h-3.5 accent-brand shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className={`text-[13px] font-medium ${selected ? "text-brand-dark" : "text-ink"}`}>
            {title}
          </div>
          <div className="text-[11.5px] text-[var(--muted)] mt-0.5">{hint}</div>
          {selected && <div onClick={(e) => e.stopPropagation()}>{children}</div>}
        </div>
      </div>
    </div>
  );
}

function ShapeToggle({
  value, label, current, onSelect,
}: {
  value: CalendarShape;
  label: string;
  current: CalendarShape;
  onSelect: (v: CalendarShape) => void;
}) {
  const active = current === value;
  return (
    <label className="cursor-pointer">
      <input
        type="radio"
        checked={active}
        onChange={() => onSelect(value)}
        className="peer sr-only"
      />
      <span
        className={`px-3 py-1 text-[12.5px] rounded-md block ${
          active ? "bg-brand text-white font-medium" : "text-[var(--muted)]"
        }`}
      >
        {label}
      </span>
    </label>
  );
}
