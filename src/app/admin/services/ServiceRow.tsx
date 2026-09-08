"use client";
import { useState, useTransition } from "react";
import { updateService, toggleService, deleteService, checkServiceDeletable } from "./actions";
import type { ServiceCategory, ServiceType } from "@/lib/types";
import { RepeatBlock } from "./RepeatBlock";
import { describeSchedule } from "@/lib/renewal";
import { useConfirm } from "@/components/ui/ConfirmProvider";

export function ServiceRow({ service, categories }: { service: ServiceType; categories: ServiceCategory[] }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [appliesTo, setAppliesTo] = useState<"person" | "company" | "either">(service.applies_to ?? "either");
  const confirm = useConfirm();

  if (editing) {
    return (
      <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
        <td colSpan={4} className="px-5 py-4">
          <form
            action={(fd) => start(async () => { await updateService(fd); setEditing(false); })}
            className="space-y-4"
          >
            <input type="hidden" name="id" value={service.id} />
            <input type="hidden" name="applies_to" value={appliesTo} />

            <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_2fr] gap-3">
              <Field label="Name">
                <input name="name" defaultValue={service.name} required
                  className="w-full px-2.5 py-1.5 border border-[var(--border)] rounded-md text-sm" />
              </Field>
              <Field label="Code (optional)">
                <input name="code" defaultValue={service.code ?? ""}
                  className="w-full px-2.5 py-1.5 border border-[var(--border)] rounded-md text-sm uppercase" />
              </Field>
              <Field label="Category">
                <select name="category_id" defaultValue={service.category_id}
                  className="w-full px-2.5 py-1.5 border border-[var(--border)] rounded-md text-sm bg-[var(--surface)]">
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Who is it for?">
              <div className="inline-flex bg-[var(--bg)] border border-[var(--border)] rounded-lg p-0.5">
                {(["person", "company", "either"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setAppliesTo(v)}
                    className={`px-3 py-1 text-[12.5px] rounded-md capitalize ${
                      appliesTo === v ? "bg-brand text-white font-medium" : "text-[var(--muted)] hover:text-ink"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </Field>

            <RepeatBlock
              initialKind={service.schedule_kind}
              annualMonth={service.annual_month}
              annualDay={service.annual_day}
              quarterlyDay={service.quarterly_day}
              quarterlyMonths={service.quarterly_months}
              validityAmount={service.validity_amount}
              validityUnit={service.validity_unit}
            />

            <Field label="Description (optional)">
              <input name="description" defaultValue={service.description ?? ""}
                className="w-full px-2.5 py-1.5 border border-[var(--border)] rounded-md text-sm" />
            </Field>

            <div className="flex gap-2 justify-end pt-1">
              <button type="button" onClick={() => setEditing(false)}
                className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-md hover:bg-[var(--surface)]">
                Cancel
              </button>
              <button type="submit" disabled={pending}
                className="px-3 py-1.5 text-sm bg-brand text-white rounded-md hover:bg-brand-dark disabled:opacity-50">
                {pending ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-[var(--border)] hover:bg-[var(--surface-muted)]">
      <td className="px-5 py-3 font-mono text-[12px] text-[var(--muted)] tabular-nums align-top">{service.code}</td>
      <td className="px-5 py-3 align-top">
        <div className="font-medium text-ink flex items-center gap-1.5 flex-wrap">
          {service.name}
          {service.applies_to && service.applies_to !== "either" && (
            <span className="text-[10px] font-medium text-[var(--muted)] bg-[var(--surface-muted)] border border-[var(--border)] px-1 py-0 rounded capitalize">
              {service.applies_to}
            </span>
          )}
        </div>
        <div className="text-[12px] text-[var(--muted)] mt-0.5">
          {describeSchedule(service)}
        </div>
        {service.description && (
          <div className="text-[11.5px] text-[var(--muted)] italic mt-0.5">{service.description}</div>
        )}
      </td>
      <td className="px-5 py-3 align-top">
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
      <td className="px-5 py-3 text-right align-top">
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
        <button
          type="button"
          disabled={pending}
          onClick={async () => {
            const check = await checkServiceDeletable(service.id);

            if (check.ok) {
              const ok = await confirm({
                title: "Delete service",
                message: `Delete "${service.name}" permanently? This cannot be undone.`,
                confirmLabel: "Delete",
                tone: "danger",
              });
              if (!ok) return;
              const fd = new FormData();
              fd.set("id", service.id);
              start(async () => { await deleteService(fd); });
              return;
            }

            if (check.reason === "cases_block") {
              await confirm({
                title: "Cannot delete",
                message: check.message,
                confirmLabel: "OK",
                tone: "default",
              });
              return;
            }

            // needs_cascade: subscriptions exist but no cases — offer to
            // soft-delete the subscriptions and then remove the service.
            const ok = await confirm({
              title: "Delete service + its subscriptions?",
              message:
                `${check.message} This soft-deletes ${check.subscription_count} subscription${check.subscription_count === 1 ? "" : "s"} and then removes the service. This cannot be undone.`,
              confirmLabel: "Delete both",
              tone: "danger",
            });
            if (!ok) return;
            const fd = new FormData();
            fd.set("id", service.id);
            fd.set("cascade", "true");
            start(async () => { await deleteService(fd); });
          }}
          className="text-[12px] font-medium text-red-700 hover:underline"
        >
          Delete
        </button>
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
