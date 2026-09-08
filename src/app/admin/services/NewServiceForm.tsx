"use client";
import { useState, useTransition } from "react";
import { createService } from "./actions";
import type { ServiceCategory } from "@/lib/types";
import { RepeatBlock } from "./RepeatBlock";

export function NewServiceForm({ categories }: { categories: ServiceCategory[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  // Bump the form key on success so RepeatBlock's internal state fully resets
  // (uncontrolled hooks don't reset from form.reset()).
  const [formKey, setFormKey] = useState(0);

  return (
    <form
      key={formKey}
      action={(fd) => {
        setError(null);
        setOk(false);
        start(async () => {
          try {
            await createService(fd);
            setOk(true);
            setFormKey((k) => k + 1);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to add service");
          }
        });
      }}
      className="space-y-5"
    >
      {/* Row 1: name + code + category */}
      <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_2fr] gap-4">
        <Field label="Service name">
          <input name="name" required placeholder="Investor KITAS" className={input} />
        </Field>
        <Field label="Code (optional)">
          <input name="code" placeholder="E28A" className={`${input} uppercase`} />
        </Field>
        <Field label="Category">
          <select name="category_id" required className={input}>
            <option value="">Select…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
      </div>

      {/* Row 2: applies_to */}
      <Field label="Who is it for?">
        <div className="inline-flex bg-[var(--bg)] border border-[var(--border)] rounded-lg p-0.5">
          {(["person", "company", "either"] as const).map((v) => (
            <label key={v} className="cursor-pointer">
              <input
                type="radio"
                name="applies_to"
                value={v}
                defaultChecked={v === "either"}
                className="peer sr-only"
              />
              <span className="px-3.5 py-1.5 text-[13px] rounded-md block peer-checked:bg-brand peer-checked:text-white text-[var(--muted)] peer-checked:font-medium capitalize">
                {v}
              </span>
            </label>
          ))}
        </div>
      </Field>

      {/* Row 3: the one control that used to be three */}
      <RepeatBlock />

      {/* Description */}
      <Field label="Description (optional)">
        <input
          name="description"
          placeholder="Short internal description"
          className={input}
        />
      </Field>

      <div className="flex items-center justify-between pt-2">
        <div className="text-[12px] min-h-[18px]">
          {error && <span className="text-red-700">{error}</span>}
          {ok && !error && <span className="text-brand-dark">Service added.</span>}
        </div>
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-brand text-white rounded-md font-medium text-sm hover:bg-brand-dark disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add service"}
        </button>
      </div>
    </form>
  );
}

const input =
  "w-full px-3 py-2 border border-[var(--border)] rounded-md text-sm focus:outline-brand focus:border-brand bg-[var(--surface)]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wide mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}
