"use client";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Notion-style date input:
 * - User types / sees dd/mm/yyyy (locale-independent)
 * - Small calendar button opens the native OS picker
 * - Submits ISO (yyyy-mm-dd) via a hidden input under `name`
 */
export function DateInput({
  name,
  defaultValue,
  value,
  onChange,
  placeholder = "dd/mm/yyyy",
}: {
  name: string;
  defaultValue?: string | null;
  /** Controlled ISO value (yyyy-mm-dd). When provided, parent owns state
   *  and the field updates whenever `value` changes (used e.g. to auto-fill
   *  an End date after a Start date is picked). */
  value?: string | null;
  /** Fires with the ISO value whenever it becomes a valid date, or with ""
   *  when the field is cleared. Not fired for half-typed inputs. */
  onChange?: (iso: string) => void;
  placeholder?: string;
}) {
  const initial = useMemo(
    () => isoToDisplay((value ?? defaultValue) ?? ""),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [display, setDisplay] = useState<string>(initial);
  const [iso, setIso] = useState<string>((value ?? defaultValue) ?? "");
  const [error, setError] = useState<string | null>(null);
  const pickerRef = useRef<HTMLInputElement>(null);

  // Sync from a controlled `value` (parent set it programmatically).
  useEffect(() => {
    if (value === undefined) return;
    const next = value ?? "";
    if (next === iso) return;
    setIso(next);
    setDisplay(isoToDisplay(next));
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (display === "") {
      if (iso !== "") { setIso(""); onChange?.(""); }
      setError(null);
      return;
    }
    const parsed = parseDisplayToIso(display);
    if (parsed) {
      if (parsed !== iso) { setIso(parsed); onChange?.(parsed); }
      setError(null);
    } else if (display.length === 10) {
      setError("Invalid date");
    } else {
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [display]);

  function openPicker() {
    const el = pickerRef.current;
    if (!el) return;
    // Chromium: showPicker(); other browsers: fall back to click/focus.
    if (typeof el.showPicker === "function") {
      try { el.showPicker(); return; } catch { /* fall through */ }
    }
    el.focus();
    el.click();
  }

  function onPickerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value; // yyyy-mm-dd from native picker
    if (!v) return;
    setDisplay(isoToDisplay(v));
  }

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        value={display}
        onChange={(e) => setDisplay(maskDisplay(e.target.value))}
        placeholder={placeholder}
        maxLength={10}
        className="w-full pr-8 pl-2.5 py-1.5 bg-transparent border border-transparent rounded-md text-[13.5px] text-ink hover:border-[var(--border)] focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 placeholder:text-[var(--muted)]"
        aria-invalid={error ? "true" : undefined}
      />
      <button
        type="button"
        onClick={openPicker}
        tabIndex={-1}
        aria-label="Open calendar"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-[var(--muted)] hover:text-ink rounded"
      >
        <CalendarIcon />
      </button>
      {/* Hidden native picker — off-screen, opened via showPicker() */}
      <input
        ref={pickerRef}
        type="date"
        value={iso}
        onChange={onPickerChange}
        tabIndex={-1}
        aria-hidden="true"
        className="absolute opacity-0 pointer-events-none w-0 h-0"
      />
      <input type="hidden" name={name} value={iso} />
      {error && <div className="text-[11px] text-red-700 mt-0.5">{error}</div>}
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </svg>
  );
}

function maskDisplay(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 8);
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  if (digits.length <= 2) return dd;
  if (digits.length <= 4) return `${dd}/${mm}`;
  return `${dd}/${mm}/${yyyy}`;
}

function parseDisplayToIso(display: string): string | null {
  const m = display.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`);
  if (isNaN(d.getTime())) return null;
  const iso = `${yyyy}-${mm}-${dd}`;
  if (d.toISOString().slice(0, 10) !== iso) return null;
  return iso;
}

function isoToDisplay(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}
