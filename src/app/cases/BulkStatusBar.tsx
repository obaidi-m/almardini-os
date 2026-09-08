"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bulkSetCaseStatusAction } from "./actions";

// Delivered is deliberately absent — it opens the WhatsApp/email send flow
// per case and must stay a one-at-a-time act.
const BULK_STATUSES = [
  { code: "new",         label: "New" },
  { code: "in_progress", label: "In progress" },
  { code: "done",        label: "Done" },
] as const;

type Result = Awaited<ReturnType<typeof bulkSetCaseStatusAction>>;

// Reads DOM checkboxes tagged data-bulk-check with data-case-id. The row
// checkboxes are rendered by the server component; this widget owns
// selection state and drives the bulk-status action.
export function BulkStatusBar() {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState<string>("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const boxes = () =>
      Array.from(document.querySelectorAll<HTMLInputElement>("input[data-bulk-check]"));

    function onChange(ev: Event) {
      const el = ev.target as HTMLInputElement;
      if (!el.matches("input[data-bulk-check]")) return;
      const id = el.getAttribute("data-case-id");
      if (!id) return;
      setSelected((prev) => {
        const next = new Set(prev);
        if (el.checked) next.add(id);
        else next.delete(id);
        return next;
      });
    }

    document.addEventListener("change", onChange);
    // Any pre-checked boxes (rare) should seed the state.
    const initial = boxes()
      .filter((b) => b.checked)
      .map((b) => b.getAttribute("data-case-id"))
      .filter((v): v is string => !!v);
    if (initial.length) setSelected(new Set(initial));

    return () => document.removeEventListener("change", onChange);
  }, []);

  // On row re-render (route refresh after action) checkboxes are recreated
  // uncontrolled, so wipe selection whenever we finish a bulk write.
  const count = selected.size;

  const summary = useMemo(() => {
    if (!result) return null;
    const parts: string[] = [];
    if (result.updated.length) parts.push(`${result.updated.length} updated`);
    if (result.unchanged.length) parts.push(`${result.unchanged.length} already there`);
    if (result.skipped.length) parts.push(`${result.skipped.length} skipped`);
    return parts.join(" · ");
  }, [result]);

  function clearAll() {
    document
      .querySelectorAll<HTMLInputElement>("input[data-bulk-check]:checked")
      .forEach((el) => (el.checked = false));
    setSelected(new Set());
    setResult(null);
    setError(null);
  }

  function apply() {
    if (!target || count === 0) return;
    const ids = Array.from(selected);
    setError(null);
    startTransition(async () => {
      try {
        const res = await bulkSetCaseStatusAction(ids, target);
        setResult(res);
        // Clear DOM checkboxes; the router refresh below will reset the list.
        document
          .querySelectorAll<HTMLInputElement>("input[data-bulk-check]:checked")
          .forEach((el) => (el.checked = false));
        setSelected(new Set());
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  if (count === 0 && !result) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 rounded-xl border border-[var(--border)] bg-white shadow-2xl px-3 py-2 flex items-center gap-3">
      {count > 0 ? (
        <>
          <div className="text-[13px] font-semibold text-ink">
            {count} selected
          </div>
          <div className="h-5 w-px bg-[var(--border)]" />
          <label className="text-[12px] text-[var(--muted)]">Set status</label>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="text-[13px] rounded-md border border-[var(--border)] px-2 py-1 outline-none focus:border-brand"
          >
            <option value="">Choose…</option>
            {BULK_STATUSES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={apply}
            disabled={!target || pending}
            className="rounded-lg bg-brand text-white text-xs font-semibold px-3 py-1.5 disabled:opacity-50"
          >
            {pending ? "Applying…" : "Apply"}
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="text-[12px] text-[var(--muted)] hover:text-ink px-1"
          >
            Clear
          </button>
        </>
      ) : (
        summary && (
          <>
            <div className="text-[13px] text-ink">{summary}</div>
            <button
              type="button"
              onClick={() => setResult(null)}
              className="text-[12px] text-[var(--muted)] hover:text-ink px-1"
            >
              Dismiss
            </button>
          </>
        )
      )}
      {error && (
        <div className="text-[11px] text-red-600 max-w-[240px]">{error}</div>
      )}
    </div>
  );
}
