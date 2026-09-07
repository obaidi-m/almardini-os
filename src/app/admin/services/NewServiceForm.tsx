"use client";
import { useState, useTransition } from "react";
import { createService } from "./actions";
import type { ServiceCategory } from "@/lib/types";
import { ScheduleFields } from "./ScheduleFields";

type Tracking = "none" | "expiry" | "ongoing";

export function NewServiceForm({ categories }: { categories: ServiceCategory[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [tracking, setTracking] = useState<Tracking>("none");
  const [showAdvanced, setShowAdvanced] = useState(false);

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
            setTracking("none");
            setShowAdvanced(false);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to add service");
          }
        });
      }}
      id="new-service-form"
      className="space-y-5"
    >
      {/* Row 1: name + category */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Service name">
          <input
            name="name"
            required
            placeholder="Investor KITAS"
            className={input}
          />
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

      {/* Row 2: applies_to (segmented) */}
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

      {/* Row 3: tracking */}
      <Field label="Type of tracking">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <TrackingOption
            value="none"
            current={tracking}
            onSelect={setTracking}
            title="One-off"
            hint="Delivered once, no state to track."
          />
          <TrackingOption
            value="expiry"
            current={tracking}
            onSelect={setTracking}
            title="Has an end date"
            hint="Virtual office, KITAS, KITAP…"
          />
          <TrackingOption
            value="ongoing"
            current={tracking}
            onSelect={setTracking}
            title="Ongoing subscription"
            hint="Monthly / quarterly / annual reporting."
          />
        </div>
        <input
          type="hidden"
          name="tracks_expiry"
          value={tracking === "expiry" ? "true" : "false"}
        />
        <input
          type="hidden"
          name="is_ongoing"
          value={tracking === "ongoing" ? "true" : "false"}
        />
      </Field>

      {/* Description */}
      <Field label="Description (optional)">
        <input
          name="description"
          placeholder="Short internal description"
          className={input}
        />
      </Field>

      {/* Advanced (kept, hidden by default) */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="text-[12px] font-medium text-[var(--muted)] hover:text-ink"
        >
          {showAdvanced ? "− Hide advanced" : "+ Show advanced (code, schedule, deliverable, validity)"}
        </button>

        {showAdvanced && (
          <div className="mt-4 pt-4 border-t border-[var(--border)] space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Code (optional)">
                <input
                  name="code"
                  placeholder="E28A"
                  className={`${input} uppercase`}
                />
              </Field>
              <Field label="Duration (optional, free text)">
                <input
                  name="duration"
                  placeholder="2 years, or leave blank"
                  className={input}
                />
              </Field>
            </div>

            <ScheduleFields />

            <Field label="Validity (leave blank if not time-bound)">
              <div className="flex gap-2">
                <input
                  name="validity_amount"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="e.g. 12"
                  className="w-24 px-3 py-2 border border-[var(--border)] rounded-md text-sm tabular-nums focus:outline-brand focus:border-brand"
                />
                <select
                  name="validity_unit"
                  defaultValue=""
                  className={`flex-1 ${input}`}
                >
                  <option value="">— no expiry —</option>
                  <option value="days">days</option>
                  <option value="months">months</option>
                  <option value="years">years</option>
                </select>
              </div>
            </Field>

            <label className="flex items-center gap-2 text-[13px] cursor-pointer select-none">
              <input type="hidden" name="has_deliverable" value="false" />
              <input
                type="checkbox"
                name="has_deliverable"
                value="true"
                defaultChecked
                className="w-4 h-4"
              />
              Has deliverable
            </label>
          </div>
        )}
      </div>

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

function TrackingOption({
  value, current, onSelect, title, hint,
}: {
  value: Tracking;
  current: Tracking;
  onSelect: (v: Tracking) => void;
  title: string;
  hint: string;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`text-left rounded-lg border p-3 transition-colors ${
        active
          ? "border-brand bg-brand/5"
          : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--muted)]"
      }`}
    >
      <div className={`text-[13px] font-medium ${active ? "text-brand-dark" : "text-ink"}`}>
        {title}
      </div>
      <div className="text-[11.5px] text-[var(--muted)] mt-0.5">{hint}</div>
    </button>
  );
}
