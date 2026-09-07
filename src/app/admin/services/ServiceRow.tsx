"use client";
import { useState, useTransition } from "react";
import { updateService, toggleService, deleteService, checkServiceDeletable } from "./actions";
import type { ServiceCategory, ServiceType } from "@/lib/types";
import { ScheduleFields } from "./ScheduleFields";
import { useConfirm } from "@/components/ui/ConfirmProvider";

type Tracking = "none" | "expiry" | "ongoing";

function initialTracking(s: ServiceType): Tracking {
  if (s.is_ongoing) return "ongoing";
  if (s.tracks_expiry) return "expiry";
  return "none";
}

export function ServiceRow({ service, categories }: { service: ServiceType; categories: ServiceCategory[] }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [tracking, setTracking] = useState<Tracking>(initialTracking(service));
  const [appliesTo, setAppliesTo] = useState<"person" | "company" | "either">(service.applies_to ?? "either");
  const confirm = useConfirm();

  if (editing) {
    return (
      <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
        <td colSpan={4} className="px-5 py-4">
          <form
            action={(fd) => start(async () => { await updateService(fd); setEditing(false); })}
            className="grid grid-cols-6 gap-3 items-end"
          >
            <input type="hidden" name="id" value={service.id} />
            <input type="hidden" name="applies_to" value={appliesTo} />
            <input type="hidden" name="tracks_expiry" value={tracking === "expiry" ? "true" : "false"} />
            <input type="hidden" name="is_ongoing" value={tracking === "ongoing" ? "true" : "false"} />
            <Field label="Code (optional)">
              <input name="code" defaultValue={service.code ?? ""}
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
            <div className="col-span-6 grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg">
              <div>
                <div className="text-[10.5px] font-semibold text-[var(--muted)] uppercase tracking-wide mb-1.5">Who is it for?</div>
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
              </div>
              <div>
                <div className="text-[10.5px] font-semibold text-[var(--muted)] uppercase tracking-wide mb-1.5">Type of tracking</div>
                <div className="inline-flex bg-[var(--bg)] border border-[var(--border)] rounded-lg p-0.5">
                  {([
                    ["none", "One-off"],
                    ["expiry", "Has an end date"],
                    ["ongoing", "Ongoing"],
                  ] as const).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setTracking(v)}
                      className={`px-3 py-1 text-[12.5px] rounded-md ${
                        tracking === v ? "bg-brand text-white font-medium" : "text-[var(--muted)] hover:text-ink"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
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
        <div className="font-medium text-ink flex items-center gap-1.5 flex-wrap">
          {service.name}
          {service.applies_to && service.applies_to !== "either" && (
            <span className="text-[10px] font-medium text-[var(--muted)] bg-[var(--surface-muted)] border border-[var(--border)] px-1 py-0 rounded capitalize">
              {service.applies_to}
            </span>
          )}
          {service.tracks_expiry && (
            <span className="text-[10px] font-medium text-blue-700 bg-blue-50 border border-blue-200 px-1 py-0 rounded">
              has expiry
            </span>
          )}
          {service.is_ongoing && (
            <span className="text-[10px] font-medium text-green-700 bg-green-50 border border-green-200 px-1 py-0 rounded">
              ongoing
            </span>
          )}
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
