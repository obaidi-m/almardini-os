"use client";
import { useState, useTransition } from "react";
import type { Company } from "@/lib/types";
import { DateInput } from "@/components/ui/DateInput";

type Mode = "create" | "edit";

export function CompanyForm({
  mode,
  company,
  action,
  onCancel,
  submitLabel,
}: {
  mode: Mode;
  company?: Partial<Company>;
  action: (fd: FormData) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      action={(fd) => {
        setError(null);
        start(async () => {
          try {
            await action(fd);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Failed");
          }
        });
      }}
    >
      {mode === "edit" && company?.id && <input type="hidden" name="id" value={company.id} />}

      <Section title="Identity">
        <Row label="Company name" required>
          <input
            name="name"
            defaultValue={company?.name ?? ""}
            required
            autoFocus={mode === "create"}
            placeholder="e.g. PT Almardini Karya Bali"
            className={cellInput}
          />
        </Row>

        <Row label="NIB">
          <input
            name="nib"
            defaultValue={company?.nib ?? ""}
            placeholder="Nomor Induk Berusaha (13 digits)"
            className={cellInput + " font-mono"}
          />
        </Row>

        <Row label="Incorporation date">
          <DateInput name="incorporation_date" defaultValue={company?.incorporation_date} />
        </Row>
      </Section>

      <Section title="Address">
        <Row label="Address" align="start">
          <textarea
            name="address"
            defaultValue={company?.address ?? ""}
            rows={2}
            placeholder="Street, city, province, postal code"
            className={cellInput + " resize-y"}
          />
        </Row>
      </Section>

      <Section title="Renewals">
        <Row label="License expiry">
          <DateInput name="license_expires_at" defaultValue={company?.license_expires_at} />
        </Row>
      </Section>

      <Section title="Files">
        <Row label="OneDrive folder">
          <input
            name="drive_folder_url"
            type="url"
            defaultValue={company?.drive_folder_url ?? ""}
            placeholder="Paste OneDrive share link"
            className={cellInput}
          />
        </Row>
      </Section>

      <Section title="Notes" last>
        <Row label="Notes" align="start">
          <textarea
            name="notes"
            defaultValue={company?.notes ?? ""}
            rows={3}
            placeholder="Anything worth remembering…"
            className={cellInput + " resize-y"}
          />
        </Row>
      </Section>

      {error && (
        <div className="mt-4 text-[12.5px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-5">
        {onCancel && (
          <button type="button" onClick={onCancel} className="px-3 py-1.5 text-[13px] text-[var(--muted)] hover:text-ink rounded-md hover:bg-[var(--surface-muted)]">
            Cancel
          </button>
        )}
        <button type="submit" disabled={pending} className="px-3.5 py-1.5 text-[13px] font-medium bg-ink text-white rounded-md hover:opacity-90 disabled:opacity-50">
          {pending ? "Saving…" : submitLabel ?? (mode === "create" ? "Create company" : "Save changes")}
        </button>
      </div>
    </form>
  );
}

function Section({ title, last, children }: { title: string; last?: boolean; children: React.ReactNode }) {
  return (
    <div className={last ? "" : "mb-6"}>
      <div className="text-[10.5px] uppercase tracking-widest text-[var(--muted)] font-semibold mb-1">{title}</div>
      <div className="divide-y divide-[var(--border)] border-t border-[var(--border)]">{children}</div>
    </div>
  );
}

function Row({ label, required, align = "center", children }: { label: string; required?: boolean; align?: "start" | "center"; children: React.ReactNode }) {
  return (
    <div className={`grid grid-cols-[160px_1fr] gap-4 py-2 items-${align}`}>
      <div className="text-[12px] text-[var(--muted)] font-medium pt-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </div>
      <div>{children}</div>
    </div>
  );
}

const cellInput =
  "w-full px-2.5 py-1.5 bg-transparent border border-transparent rounded-md text-[13.5px] text-ink hover:border-[var(--border)] focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 placeholder:text-[var(--muted)]";
