"use client";
import { useState, useTransition } from "react";
import { createService } from "./actions";
import type { ServiceCategory } from "@/lib/types";

export function NewServiceForm({ categories }: { categories: ServiceCategory[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  return (
    <form
      action={(fd) => {
        setError(null);
        setOk(false);
        start(async () => {
          try {
            await createService(fd);
            setOk(true);
            (document.getElementById("new-service-form") as HTMLFormElement)?.reset();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to add service");
          }
        });
      }}
      id="new-service-form"
      className="grid grid-cols-3 gap-3"
    >
      <Field label="Code">
        <input name="code" required placeholder="E28A"
          className="w-full px-3 py-2 border border-[var(--border)] rounded-md text-sm uppercase focus:outline-brand focus:border-brand" />
      </Field>
      <Field label="Service name">
        <input name="name" required placeholder="Investor KITAS"
          className="w-full px-3 py-2 border border-[var(--border)] rounded-md text-sm focus:outline-brand focus:border-brand" />
      </Field>
      <Field label="Category">
        <select name="category_id" required
          className="w-full px-3 py-2 border border-[var(--border)] rounded-md text-sm bg-[var(--surface)] focus:outline-brand focus:border-brand">
          <option value="">Select…</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="Duration (optional)">
        <input name="duration" placeholder="2 years, or leave blank"
          className="w-full px-3 py-2 border border-[var(--border)] rounded-md text-sm focus:outline-brand focus:border-brand" />
      </Field>
      <Field label="Validity (auto-sets renewal date)">
        <div className="flex gap-2">
          <input name="validity_amount" type="number" min="1" step="1" placeholder="e.g. 2"
            className="w-24 px-3 py-2 border border-[var(--border)] rounded-md text-sm tabular-nums focus:outline-brand focus:border-brand" />
          <select name="validity_unit" defaultValue=""
            className="flex-1 px-3 py-2 border border-[var(--border)] rounded-md text-sm bg-[var(--surface)] focus:outline-brand focus:border-brand">
            <option value="">— none —</option>
            <option value="days">days</option>
            <option value="months">months</option>
            <option value="years">years</option>
          </select>
        </div>
      </Field>
      <Field label="Recurring (leave blank if one-off)">
        <div className="flex gap-2">
          <input name="recurring_amount" type="number" min="1" step="1" placeholder="e.g. 3"
            className="w-24 px-3 py-2 border border-[var(--border)] rounded-md text-sm tabular-nums focus:outline-brand focus:border-brand" />
          <select name="recurring_unit" defaultValue=""
            className="flex-1 px-3 py-2 border border-[var(--border)] rounded-md text-sm bg-[var(--surface)] focus:outline-brand focus:border-brand">
            <option value="">— one-off —</option>
            <option value="days">days</option>
            <option value="months">months</option>
            <option value="years">years</option>
          </select>
        </div>
      </Field>
      <Field label="Description (English, optional)">
        <input name="description" placeholder="Short internal description"
          className="w-full px-3 py-2 border border-[var(--border)] rounded-md text-sm focus:outline-brand focus:border-brand" />
      </Field>
      <Field label="Name (Indonesian, optional)">
        <input name="name_id" placeholder="Same as English if blank"
          className="w-full px-3 py-2 border border-[var(--border)] rounded-md text-sm focus:outline-brand focus:border-brand" />
      </Field>
      <Field label="Description (Indonesian, optional)">
        <input name="description_id"
          className="w-full px-3 py-2 border border-[var(--border)] rounded-md text-sm focus:outline-brand focus:border-brand" />
      </Field>
      <div className="flex items-end">
        <label className="flex items-center gap-2 text-[13px] cursor-pointer select-none pb-1.5">
          <input type="hidden" name="has_deliverable" value="false" />
          <input type="checkbox" name="has_deliverable" value="true" defaultChecked className="w-4 h-4" />
          Has deliverable
        </label>
      </div>
      <Field label="Delivery template (English, optional)">
        <textarea name="delivery_template_en" rows={2}
          placeholder="Hi {{client_name}}, your {{service}} is ready."
          className="w-full px-3 py-2 border border-[var(--border)] rounded-md text-sm focus:outline-brand focus:border-brand resize-y" />
      </Field>
      <Field label="Delivery template (Indonesian, optional)">
        <textarea name="delivery_template_id" rows={2}
          placeholder="Halo {{client_name}}, {{service}} Anda sudah siap."
          className="w-full px-3 py-2 border border-[var(--border)] rounded-md text-sm focus:outline-brand focus:border-brand resize-y" />
      </Field>

      <div className="col-span-3 flex items-center justify-between mt-1">
        <div className="text-[12px] min-h-[18px]">
          {error && <span className="text-red-700">{error}</span>}
          {ok && !error && <span className="text-brand-dark">Service added.</span>}
        </div>
        <button type="submit" disabled={pending}
          className="px-4 py-2 bg-brand text-white rounded-md font-medium text-sm hover:bg-brand-dark disabled:opacity-50">
          {pending ? "Adding…" : "Add service"}
        </button>
      </div>
    </form>
  );
}

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
