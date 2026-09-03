"use client";
import { useState, useTransition } from "react";
import { updateService, toggleService, deleteService } from "./actions";
import type { ServiceCategory, ServiceType } from "@/lib/types";
import { ScheduleFields } from "./ScheduleFields";

export function ServiceRow({ service, categories }: { service: ServiceType; categories: ServiceCategory[] }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();

  if (editing) {
    return (
      <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
        <td colSpan={4} className="px-5 py-4">
          <form
            action={(fd) => start(async () => { await updateService(fd); setEditing(false); })}
            className="grid grid-cols-6 gap-3 items-end"
          >
            <input type="hidden" name="id" value={service.id} />
            <Field label="Code">
              <input name="code" defaultValue={service.code} required
                className="w-full px-2.5 py-1.5 border border-[var(--border)] rounded-md text-sm uppercase" />
            </Field>
            <Field label="Name">
              <input name="name" defaultValue={service.name} required
                className="w-full px-2.5 py-1.5 border border-[var(--border)] rounded-md text-sm" />
            </Field>
            <Field label="Category">
              <select name="category_id" defaultValue={service.category_id}
                className="w-full px-2.5 py-1.5 border border-[var(--border)] rounded-md text-sm bg-[var(--surface)]">
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Duration">
              <input name="duration" defaultValue={service.duration ?? ""}
                className="w-full px-2.5 py-1.5 border border-[var(--border)] rounded-md text-sm" />
            </Field>
            <Field label="Validity">
              <div className="flex gap-2">
                <input name="validity_amount" type="number" min="1" step="1"
                  defaultValue={service.validity_amount ?? ""} placeholder="—"
                  className="w-20 px-2.5 py-1.5 border border-[var(--border)] rounded-md text-sm tabular-nums" />
                <select name="validity_unit" defaultValue={service.validity_unit ?? ""}
                  className="flex-1 px-2.5 py-1.5 border border-[var(--border)] rounded-md text-sm bg-[var(--surface)]">
                  <option value="">— no expiry —</option>
                  <option value="days">days</option>
                  <option value="months">months</option>
                  <option value="years">years</option>
                </select>
              </div>
            </Field>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setEditing(false)}
                className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-md hover:bg-[var(--surface)]">
                Cancel
              </button>
              <button type="submit" disabled={pending}
                className="px-3 py-1.5 text-sm bg-brand text-white rounded-md hover:bg-brand-dark disabled:opacity-50">
                {pending ? "Saving…" : "Save"}
              </button>
            </div>
            <div className="col-span-3 flex items-end gap-4">
              <label className="flex items-center gap-2 text-[13px] cursor-pointer select-none">
                <input type="hidden" name="has_deliverable" value="false" />
                <input type="checkbox" name="has_deliverable" value="true" defaultChecked={service.has_deliverable !== false} className="w-4 h-4" />
                Has deliverable
              </label>
              <span className="text-[11.5px] text-[var(--muted)]">
                (uncheck for services with no hand-off to the client)
              </span>
            </div>
            <div className="col-span-6">
              <ScheduleFields
                initialKind={service.schedule_kind}
                annualMonth={service.annual_month}
                annualDay={service.annual_day}
                quarterlyDay={service.quarterly_day}
                quarterlyMonths={service.quarterly_months}
              />
            </div>
            <div className="col-span-6">
              <Field label="Description (optional)">
                <input name="description" defaultValue={service.description ?? ""}
                  className="w-full px-2.5 py-1.5 border border-[var(--border)] rounded-md text-sm" />
              </Field>
            </div>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-[var(--border)] hover:bg-[var(--surface-muted)]">
      <td className="px-5 py-3 font-mono text-[12px] text-[var(--muted)] tabular-nums">{service.code}</td>
      <td className="px-5 py-3">
        <div className="font-medium text-ink flex items-center gap-1.5">
          {service.name}
          {service.has_deliverable === false && (
            <span className="text-[10px] font-medium text-orange-700 bg-orange-50 border border-orange-200 px-1 py-0 rounded" title="Marks services with no physical/digital hand-off to the client">
              no deliverable
            </span>
          )}
        </div>
        {service.description && <div className="text-[12px] text-[var(--muted)] mt-0.5">{service.description}</div>}
      </td>
      <td className="px-5 py-3">
        {service.is_active ? (
          <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-green-800 bg-green-100 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-green-700" />
            Active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--muted)] bg-[var(--surface-muted)] px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--muted)]" />
            Archived
          </span>
        )}
      </td>
      <td className="px-5 py-3 text-right">
        <button onClick={() => setEditing(true)}
          className="text-[12px] font-medium text-brand hover:underline mr-3">
          Edit
        </button>
        <form action={(fd) => start(async () => { await toggleService(fd); })} className="inline mr-3">
          <input type="hidden" name="id" value={service.id} />
          <input type="hidden" name="is_active" value={String(!service.is_active)} />
          <button type="submit" disabled={pending}
            className="text-[12px] font-medium text-[var(--muted)] hover:text-ink">
            {service.is_active ? "Archive" : "Reactivate"}
          </button>
        </form>
        <form
          action={(fd) => start(async () => { await deleteService(fd); })}
          onSubmit={(e) => { if (!confirm(`Delete "${service.name}" permanently? This cannot be undone.`)) e.preventDefault(); }}
          className="inline"
        >
          <input type="hidden" name="id" value={service.id} />
          <button type="submit" disabled={pending}
            className="text-[12px] font-medium text-red-700 hover:underline">
            Delete
          </button>
        </form>
      </td>
    </tr>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10.5px] font-semibold text-[var(--muted)] uppercase tracking-wide mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
