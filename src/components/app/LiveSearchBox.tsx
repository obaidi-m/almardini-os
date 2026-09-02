"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { buildIlikeOr, escapeIlike } from "@/lib/search";
import { CASE_STATUS_LABELS } from "@/lib/types";
import type { CaseStatus } from "@/lib/types";

type Result = {
  kind: "client" | "company" | "case" | "partner" | "update";
  id: string;
  href: string;
  code: string;
  title: string;
  hint?: string;
  badge?: string;
};

const KIND_LABELS: Record<Result["kind"], string> = {
  client: "Client",
  company: "Company",
  case: "Case",
  partner: "Partner",
  update: "Note",
};

const STATUS_COLORS: Record<CaseStatus, string> = {
  new: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-blue-100 text-blue-800",
  done: "bg-green-100 text-green-800",
  delivered: "bg-neutral-200 text-neutral-700",
};

export function LiveSearchBox({
  size = "compact",
  placeholder = "Search…",
  autoFocus = false,
  variant = "default",
}: {
  size?: "compact" | "large";
  placeholder?: string;
  autoFocus?: boolean;
  variant?: "default" | "onBrand";
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Debounced query
  useEffect(() => {
    const term = q.trim();
    if (!term) { setResults([]); setLoading(false); return; }

    setLoading(true);
    const handle = setTimeout(async () => {
      const [c, co, cs, p, u] = await Promise.all([
        supabase.from("clients")
          .select("id, code, full_name, passport_no")
          .is("deleted_at", null)
          .or(buildIlikeOr(["full_name", "passport_no", "phone", "email", "code"], term))
          .limit(5),
        supabase.from("companies")
          .select("id, code, name, nib")
          .is("deleted_at", null)
          .or(buildIlikeOr(["name", "nib", "code"], term))
          .limit(5),
        supabase.from("cases")
          .select("id, code, title, status, client:clients(id, full_name), service:service_types(id, name)")
          .is("deleted_at", null)
          .or(buildIlikeOr(["code", "title"], term))
          .limit(5),
        supabase.from("partners")
          .select("id, code, name, contact_person")
          .is("deleted_at", null)
          .or(buildIlikeOr(["name", "contact_person", "phone", "email", "code"], term))
          .limit(5),
        supabase.from("case_updates")
          .select("id, text, case:cases!inner(id, code, title, client:clients(id, full_name))")
          .ilike("text", `%${escapeIlike(term)}%`)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      const unwrap = <T,>(v: T | T[] | null | undefined): T | null => Array.isArray(v) ? v[0] ?? null : v ?? null;

      const rows: Result[] = [];
      for (const r of (c.data ?? []) as Array<{ id: string; code: string; full_name: string; passport_no: string | null }>) {
        rows.push({ kind: "client", id: r.id, href: `/clients/${r.id}`, code: r.code, title: r.full_name, hint: r.passport_no ?? undefined });
      }
      for (const r of (co.data ?? []) as Array<{ id: string; code: string; name: string; nib: string | null }>) {
        rows.push({ kind: "company", id: r.id, href: `/companies/${r.id}`, code: r.code, title: r.name, hint: r.nib ? `NIB ${r.nib}` : undefined });
      }
      for (const r of (cs.data ?? []) as unknown[]) {
        const rr = r as { id: string; code: string; title: string | null; status: CaseStatus; client: { full_name: string }[] | { full_name: string } | null; service: { name: string }[] | { name: string } | null };
        const cli = unwrap(rr.client); const svc = unwrap(rr.service);
        rows.push({
          kind: "case", id: rr.id, href: `/cases/${rr.id}`, code: rr.code,
          title: rr.title || svc?.name || "Case",
          hint: cli?.full_name, badge: rr.status,
        });
      }
      for (const r of (p.data ?? []) as Array<{ id: string; code: string; name: string; contact_person: string | null }>) {
        rows.push({ kind: "partner", id: r.id, href: `/partners/${r.id}`, code: r.code, title: r.name, hint: r.contact_person ?? undefined });
      }
      for (const r of (u.data ?? []) as unknown[]) {
        const rr = r as { id: string; text: string; case: { id: string; code: string; title: string | null; client: { full_name: string }[] | { full_name: string } | null }[] | { id: string; code: string; title: string | null; client: { full_name: string }[] | { full_name: string } | null } | null };
        const cse = unwrap(rr.case);
        if (!cse) continue;
        const cli = unwrap(cse.client);
        rows.push({
          kind: "update", id: rr.id, href: `/cases/${cse.id}`, code: cse.code,
          title: rr.text.length > 90 ? rr.text.slice(0, 90) + "…" : rr.text,
          hint: cli?.full_name,
        });
      }

      setResults(rows);
      setLoading(false);
      setActiveIdx(-1);
    }, 180);

    return () => clearTimeout(handle);
  }, [q, supabase]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(-1, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx >= 0 && results[activeIdx]) {
        router.push(results[activeIdx].href);
        setOpen(false);
      } else if (q.trim()) {
        router.push(`/search?q=${encodeURIComponent(q.trim())}`);
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      (e.target as HTMLInputElement).blur();
    }
  }

  const inputClass = variant === "onBrand"
    ? "w-full pl-10 pr-3 py-2 text-[13.5px] bg-white/15 hover:bg-white/25 focus:bg-white text-white placeholder-white/70 focus:text-ink focus:placeholder-[var(--muted)] border border-white/25 focus:border-white rounded-full focus:outline-none transition-colors"
    : size === "large"
    ? "w-full pl-10 pr-3 py-2.5 text-[14px] bg-white border border-[var(--border)] rounded-md focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
    : "w-full pl-8 pr-2 py-1.5 text-[12.5px] bg-white border border-[var(--border)] rounded-md focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30";
  const iconSize = variant === "onBrand" ? 15 : size === "large" ? 16 : 13;
  const iconLeft = variant === "onBrand" ? "left-3.5" : size === "large" ? "left-3" : "left-2.5";
  const iconColorClass = variant === "onBrand" ? "text-white/80 peer-focus:text-[var(--muted)]" : "text-[var(--muted)]";

  return (
    <div ref={wrapRef} className="relative">
      <span className={`absolute ${iconLeft} top-1/2 -translate-y-1/2 ${iconColorClass} pointer-events-none z-10`}>
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
      </span>
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={inputClass}
      />

      {open && q.trim() && (
        <div className="absolute left-0 right-0 mt-1 bg-white border border-[var(--border)] rounded-md shadow-lg z-40 max-h-[70vh] overflow-y-auto">
          {loading && results.length === 0 && (
            <div className="px-3 py-2.5 text-[12.5px] text-[var(--muted)]">Searching…</div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-3 py-2.5 text-[12.5px] text-[var(--muted)]">No matches.</div>
          )}
          {results.map((r, i) => (
            <Link
              key={`${r.kind}-${r.id}`}
              href={r.href}
              onClick={() => setOpen(false)}
              className={`grid grid-cols-[64px_1fr_auto] gap-2 px-3 py-2 border-b border-[var(--border)] last:border-0 ${
                activeIdx === i ? "bg-[var(--surface-muted)]" : "hover:bg-[var(--surface-muted)]"
              }`}
              onMouseEnter={() => setActiveIdx(i)}
            >
              <span className="text-[10.5px] uppercase tracking-wide text-[var(--muted)] font-medium mt-0.5">
                {KIND_LABELS[r.kind]}
              </span>
              <span className="min-w-0">
                <span className="text-[13px] text-ink font-medium truncate block">{r.title}</span>
                <span className="text-[11.5px] text-[var(--muted)] truncate block">
                  <span className="font-mono">{r.code}</span>
                  {r.hint && <span> · {r.hint}</span>}
                </span>
              </span>
              {r.badge && (
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded self-center ${STATUS_COLORS[r.badge as CaseStatus] ?? ""}`}>
                  {CASE_STATUS_LABELS[r.badge as CaseStatus] ?? r.badge}
                </span>
              )}
            </Link>
          ))}
          {q.trim() && (
            <Link
              href={`/search?q=${encodeURIComponent(q.trim())}`}
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-[12px] text-brand hover:bg-[var(--surface-muted)] border-t border-[var(--border)]"
            >
              See all results for &quot;{q.trim()}&quot; →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
