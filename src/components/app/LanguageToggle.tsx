"use client";
import { useTransition } from "react";
import { useLocale } from "@/lib/i18n/client";
import { setLocaleAction } from "@/lib/i18n/actions";

export function LanguageToggle() {
  const current = useLocale();
  const [pending, start] = useTransition();

  function pick(l: "en" | "id") {
    if (l === current || pending) return;
    start(() => setLocaleAction(l));
  }

  return (
    <div className="inline-flex items-center rounded-md border border-[var(--border)] bg-white overflow-hidden text-[11px] font-semibold">
      {(["en", "id"] as const).map((l) => (
        <button
          key={l}
          onClick={() => pick(l)}
          disabled={pending}
          className={`px-2 py-0.5 uppercase tracking-wide transition-colors ${
            current === l ? "bg-ink text-white" : "text-[var(--muted)] hover:text-ink"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
