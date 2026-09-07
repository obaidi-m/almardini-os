"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";

export type ComboOption = {
  id: string;
  label: string;      // primary display text (client name, company name, service name…)
  hint?: string;      // secondary text (code, NIB, passport, category…)
  keywords?: string;  // extra text searched but not shown
};

/** Searchable single-select dropdown. Renders a hidden input with `name` so it
 *  works inside a plain <form> the same way a <select> would. Cap results at 20;
 *  the point of the search box is to make you narrow the list, not scroll it. */
export function Combobox({
  name,
  options,
  defaultValue,
  placeholder = "Select…",
  emptyLabel = "— none —",
  allowEmpty = false,
  required = false,
  disabled = false,
  onChange,
}: {
  name: string;
  options: ComboOption[];
  defaultValue?: string | null;
  placeholder?: string;
  emptyLabel?: string;
  allowEmpty?: boolean;      // show a "— none —" row at the top
  required?: boolean;
  disabled?: boolean;
  onChange?: (id: string) => void;
}) {
  const { t } = useT();
  const [value, setValue] = useState<string>(defaultValue ?? "");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => options.find((o) => o.id === value) ?? null,
    [options, value],
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return options.slice(0, 20);
    const hits = options.filter((o) => {
      const hay = `${o.label} ${o.hint ?? ""} ${o.keywords ?? ""}`.toLowerCase();
      return hay.includes(term);
    });
    return hits.slice(0, 20);
  }, [q, options]);

  // Close on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Focus the search input as soon as the panel opens
  useEffect(() => {
    if (open) {
      const h = setTimeout(() => inputRef.current?.focus(), 10);
      return () => clearTimeout(h);
    }
  }, [open]);

  function pick(id: string) {
    setValue(id);
    onChange?.(id);
    setOpen(false);
    setQ("");
    setActiveIdx(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const total = filtered.length + (allowEmpty ? 1 : 0);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(total - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(-1, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx < 0) return;
      if (allowEmpty && activeIdx === 0) return pick("");
      const opt = filtered[allowEmpty ? activeIdx - 1 : activeIdx];
      if (opt) pick(opt.id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <input type="hidden" name={name} value={value} />

      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`w-full px-2.5 py-1.5 text-left bg-transparent border border-transparent rounded-md text-[13.5px] hover:border-[var(--border)] focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 flex items-center gap-2 ${
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
        } ${selected ? "text-ink" : "text-[var(--muted)]"}`}
      >
        <span className="flex-1 truncate">
          {selected ? (
            <>
              {selected.label}
              {selected.hint && (
                <span className="text-[var(--muted)] ml-1.5 font-mono text-[11.5px]">
                  {selected.hint}
                </span>
              )}
            </>
          ) : (
            placeholder
          )}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-50 shrink-0">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-40 mt-1 bg-white border border-[var(--border)] rounded-md shadow-lg overflow-hidden">
          <div className="p-2 border-b border-[var(--border)]">
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => { setQ(e.target.value); setActiveIdx(-1); }}
              onKeyDown={onKeyDown}
              placeholder={t("combobox.search_placeholder")}
              className="w-full px-2 py-1.5 text-[13px] bg-[var(--surface-2)] rounded border-0 focus:outline-none focus:bg-white focus:ring-1 focus:ring-brand/30"
            />
          </div>

          <div className="max-h-72 overflow-y-auto">
            {allowEmpty && (
              <OptionRow
                label={emptyLabel}
                muted
                active={activeIdx === 0}
                onClick={() => pick("")}
                onMouseEnter={() => setActiveIdx(0)}
              />
            )}
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-[12.5px] text-[var(--muted)]">{t("combobox.no_matches")}</div>
            ) : (
              filtered.map((opt, i) => {
                const idx = allowEmpty ? i + 1 : i;
                return (
                  <OptionRow
                    key={opt.id}
                    label={opt.label}
                    hint={opt.hint}
                    active={activeIdx === idx || opt.id === value}
                    onClick={() => pick(opt.id)}
                    onMouseEnter={() => setActiveIdx(idx)}
                  />
                );
              })
            )}
            {options.length > 20 && q.trim() === "" && (
              <div className="px-3 py-2 text-[11.5px] text-[var(--muted)] border-t border-[var(--border)]">
                Showing first 20 · type to filter {options.length} total.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Native validation hint: browsers won't validate a hidden input;
          form-side validation is done in the server action. `required` here
          is a documentation prop only. */}
      {required && !value && <span className="sr-only">required</span>}
    </div>
  );
}

function OptionRow({
  label, hint, muted, active, onClick, onMouseEnter,
}: {
  label: string;
  hint?: string;
  muted?: boolean;
  active?: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`w-full text-left px-3 py-1.5 text-[13px] flex items-baseline gap-2 ${
        active ? "bg-[var(--surface-muted)]" : "hover:bg-[var(--surface-muted)]"
      } ${muted ? "text-[var(--muted)]" : "text-ink"}`}
    >
      <span className="flex-1 truncate">{label}</span>
      {hint && <span className="text-[11.5px] text-[var(--muted)] font-mono shrink-0">{hint}</span>}
    </button>
  );
}
