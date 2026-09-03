"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Option = { id: string; name: string };

/** Per-user, per-browser saved service filter for the cases list.
 *
 *  Persistence rule: when the user lands on /cases without any query
 *  params (a fresh navigation from the sidebar, or an app relaunch), we
 *  restore the last saved selection. Any URL that already carries filter
 *  params — status, mine, sort, or an explicit service list — is treated
 *  as a deliberate choice and left alone.
 *
 *  Storage key is namespaced by user id so two people sharing a browser
 *  don't overwrite each other, and so "Any service" resets are per-user. */
const STORAGE_PREFIX = "almardini:cases:service:";
function storageKey(userId: string | null): string | null {
  return userId ? STORAGE_PREFIX + userId : null;
}

export function ServiceFilter({
  userId,
  options,
  selectedIds,
  selectedNames,
  baseHref,
  otherParams,
  clearLabel,
}: {
  userId: string | null;
  options: Option[];
  selectedIds: string[];
  selectedNames: string[];
  baseHref: string;
  otherParams: Record<string, string | undefined>;
  clearLabel: string;
}) {
  function buildHrefForIds(ids: string[]): string {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(otherParams)) if (v) p.set(k, v);
    if (ids.length > 0) p.set("service", ids.join(","));
    const s = p.toString();
    return s ? `/cases?${s}` : "/cases";
  }
  const router = useRouter();
  const params = useSearchParams();
  const [draft, setDraft] = useState<Set<string>>(new Set(selectedIds));
  const restoredRef = useRef(false);

  // Auto-restore on a bare /cases visit only. If any query is present the
  // user has already chosen something (including deliberately clearing).
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const key = storageKey(userId);
    if (!key) return;
    if (params.toString().length > 0) return;
    let saved: string[] = [];
    try {
      const raw = localStorage.getItem(key);
      if (raw) saved = JSON.parse(raw);
    } catch {
      return;
    }
    if (!Array.isArray(saved) || saved.length === 0) return;
    const valid = saved.filter((id) => options.some((o) => o.id === id));
    if (valid.length === 0) return;
    router.replace(buildHrefForIds(valid));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirror the URL's current selection to storage so a later fresh visit
  // brings the same filter back. An empty selection is remembered as such,
  // so "Any service" also survives a re-login.
  useEffect(() => {
    const key = storageKey(userId);
    if (!key) return;
    try { localStorage.setItem(key, JSON.stringify(selectedIds)); } catch { /* ignore */ }
  }, [userId, selectedIds]);

  // Sync the working draft to whatever the URL actually reflects whenever
  // we open the panel, so it can't drift out of sync after browser back.
  function onOpen(e: React.SyntheticEvent<HTMLDetailsElement>) {
    if ((e.currentTarget as HTMLDetailsElement).open) {
      setDraft(new Set(selectedIds));
    }
  }

  function toggle(id: string) {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function apply() {
    router.push(buildHrefForIds([...draft]));
  }

  function selectAll() { setDraft(new Set(options.map((o) => o.id))); }
  function clearAll()  { setDraft(new Set()); }

  const count = selectedIds.length;
  const label = count === 0
    ? "Service"
    : count === 1
      ? `Service: ${selectedNames[0]}`
      : `Service: ${count} selected`;

  return (
    <details className="relative" onToggle={onOpen}>
      <summary className="inline-flex items-center gap-1 text-[var(--muted)] hover:text-ink px-2 py-1 rounded hover:bg-white/50 cursor-pointer list-none">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 3H2l8 9v7l4 2v-9l8-9z"/></svg>
        <span>{label}</span>
        {count > 0 && (
          <span className="ml-1 bg-brand text-white text-[10px] font-semibold rounded-full px-1.5 py-0.5 leading-none min-w-[16px] text-center">
            {count}
          </span>
        )}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-60"><path d="M6 9l6 6 6-6"/></svg>
      </summary>
      <div className="absolute z-20 mt-1 left-0 w-[260px] bg-white rounded-lg shadow-lg border border-[var(--border)]">
        <div className="flex items-center justify-between px-3 pt-3 pb-2">
          <div className="text-[10.5px] uppercase tracking-wider font-semibold text-[var(--muted)]">
            Service type
          </div>
          <div className="flex gap-2 text-[11px]">
            <button type="button" onClick={selectAll} className="text-brand hover:underline">All</button>
            <button type="button" onClick={clearAll} className="text-[var(--muted)] hover:text-ink">None</button>
          </div>
        </div>
        <div className="max-h-[45vh] overflow-y-auto px-2">
          {options.map((s) => {
            const on = draft.has(s.id);
            return (
              <label key={s.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded text-[12.5px] hover:bg-[var(--surface-2)] cursor-pointer">
                <input type="checkbox" checked={on} onChange={() => toggle(s.id)} className="w-3.5 h-3.5" />
                <span className={on ? "text-brand-dark font-medium" : "text-ink"}>{s.name}</span>
              </label>
            );
          })}
          {options.length === 0 && (
            <div className="px-2 py-4 text-[12px] text-[var(--muted)]">No active services.</div>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-[var(--border)]">
          <Link href={baseHref} className="text-[11.5px] text-[var(--muted)] hover:text-ink">
            {clearLabel}
          </Link>
          <button type="button" onClick={apply}
            className="px-3 py-1 bg-brand text-white rounded-md text-[12px] font-medium hover:bg-brand-dark">
            Apply
          </button>
        </div>
      </div>
    </details>
  );
}
