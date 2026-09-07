"use client";
import { useEffect, useRef, useState } from "react";

/** Drag-to-resize column widths for the div-based grid tables used by the
 *  list pages (/permits, /virtual-offices, /renewals, …). Widths persist
 *  per viewer in localStorage under `storageKey`.
 *
 *  Rows keep being server-rendered as `<div className="grid gap-3 …"
 *  style={{ gridTemplateColumns: "var(--rt-cols)" }}>` — only this wrapper
 *  needs to be a client component, since it owns the header and the drag
 *  handles. The CSS variable propagates to every descendant row so the
 *  columns line up. */

export type ColumnDef = {
  /** Header cell content. String or JSX. */
  header: React.ReactNode;
  /** Starting width in pixels. */
  defaultWidth: number;
  /** Minimum width in pixels. Defaults to 60. */
  minWidth?: number;
  /** True for the row-select checkbox column (no drag handle, no resize). */
  fixed?: boolean;
};

const MIN_WIDTH_FALLBACK = 60;

export function ResizableTable({
  storageKey, columns, children,
}: {
  storageKey: string;
  columns: ColumnDef[];
  children: React.ReactNode;
}) {
  const defaults = columns.map((c) => c.defaultWidth);
  const [widths, setWidths] = useState<number[]>(defaults);
  const dragRef = useRef<{ index: number; startX: number; startWidth: number } | null>(null);

  // Hydrate saved widths on mount. If the shape changed (columns added or
  // removed since the last visit), fall back to defaults rather than
  // showing a broken layout.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length === defaults.length && parsed.every((n) => typeof n === "number")) {
        setWidths(parsed);
      }
    } catch { /* localStorage blocked or malformed — just use defaults */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    function onMove(ev: MouseEvent) {
      const d = dragRef.current;
      if (!d) return;
      const min = columns[d.index].minWidth ?? MIN_WIDTH_FALLBACK;
      const next = Math.max(min, d.startWidth + (ev.clientX - d.startX));
      setWidths((prev) => {
        const out = [...prev];
        out[d.index] = next;
        return out;
      });
    }
    function onUp() {
      if (!dragRef.current) return;
      dragRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      try {
        // Grab the latest widths off the setter to persist.
        setWidths((current) => {
          try { localStorage.setItem(storageKey, JSON.stringify(current)); } catch { /* ignore */ }
          return current;
        });
      } catch { /* ignore */ }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [columns, storageKey]);

  function startDrag(index: number, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { index, startX: e.clientX, startWidth: widths[index] };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  const gridCols = widths.map((w) => `${w}px`).join(" ");

  return (
    <div
      className="border-y border-[var(--border-strong)]"
      style={{ ["--rt-cols" as string]: gridCols } as React.CSSProperties}
    >
      <div
        className="grid gap-3 px-3 py-2 text-[11px] uppercase tracking-[0.06em] text-[var(--muted)] font-semibold border-b border-[var(--border-strong)] bg-white/30"
        style={{ gridTemplateColumns: "var(--rt-cols)" }}
      >
        {columns.map((c, i) => (
          <div key={i} className="relative">
            {c.header}
            {i < columns.length - 1 && !c.fixed && (
              <span
                onMouseDown={(e) => startDrag(i, e)}
                className="absolute top-1/2 -translate-y-1/2 -right-[8px] h-5 w-3 cursor-col-resize z-10 flex items-center justify-center group"
                aria-hidden
              >
                <span className="w-px h-4 bg-[var(--border-strong)] group-hover:bg-brand group-hover:w-[2px] transition-all" />
              </span>
            )}
          </div>
        ))}
      </div>
      {children}
    </div>
  );
}
