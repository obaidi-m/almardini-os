"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function ResolveButton({ id, resolved }: { id: number; resolved: boolean }) {
  const supabase = createClient();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  async function toggle() {
    setErr(null);
    const { error } = await supabase
      .from("feedback")
      .update({
        resolved: !resolved,
        resolved_at: !resolved ? new Date().toISOString() : null,
      })
      .eq("id", id);
    if (error) {
      setErr(error.message);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={`text-[11px] font-medium px-2 py-1 rounded-md border ${
          resolved
            ? "text-[var(--muted)] border-[var(--border)] hover:bg-white"
            : "text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
        }`}
      >
        {pending ? "…" : resolved ? "Reopen" : "Resolve"}
      </button>
      {err && <div className="text-[10px] text-red-600 max-w-[140px] text-right">{err}</div>}
    </div>
  );
}
