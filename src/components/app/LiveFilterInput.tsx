"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * List-page filter input: debounces user input and pushes ?q=… into the URL
 * so the server component re-runs the query. No Enter needed — results
 * appear as you type. Other query params (status, mine, show) are preserved.
 */
export function LiveFilterInput({
  placeholder,
  paramName = "q",
  debounceMs = 200,
}: {
  placeholder: string;
  paramName?: string;
  debounceMs?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const initial = params.get(paramName) ?? "";
  const [value, setValue] = useState(initial);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPushed = useRef(initial);

  // Keep local state in sync when URL changes via other means (back button, filter chips).
  useEffect(() => {
    setValue(initial);
    lastPushed.current = initial;
  }, [initial]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const trimmed = value.trim();
      if (trimmed === lastPushed.current) return;
      lastPushed.current = trimmed;
      const next = new URLSearchParams(params.toString());
      if (trimmed) next.set(paramName, trimmed); else next.delete(paramName);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, debounceMs);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [value, params, pathname, router, paramName, debounceMs]);

  return (
    <div className="relative flex-1">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
      </span>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-3 py-1.5 text-[13.5px] bg-transparent border border-[var(--border)] rounded-md hover:bg-white focus:bg-white focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
      />
    </div>
  );
}
