"use client";
import { useState, useTransition } from "react";
import type { Client, Partner } from "@/lib/types";
import { NATIONALITIES } from "@/lib/nationalities";
import { DateInput } from "@/components/ui/DateInput";

type Mode = "create" | "edit";

/**
 * Notion / Attio-style form:
 * - Two-column key/value layout
 * - Borderless inputs; border appears on hover, thickens on focus
 * - Muted uppercase labels, quiet dividers, no coloured backgrounds
 */
export function ClientForm({
  mode,
  client,
  partners,
  action,
  onCancel,
  submitLabel,
}: {
  mode: Mode;
  client?: Partial<Client>;
  partners: Pick<Partner, "id" | "name" | "code">[];
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
      {mode === "edit" && client?.id && <input type="hidden" name="id" value={client.id} />}

      <datalist id="nationalities-list">
        {NATIONALITIES.map((n) => <option key={n} value={n} />)}
      </datalist>

      <Section title="Identity">
        <Row label="Full name" required>
          <input
            name="full_name"
            defaultValue={client?.full_name ?? ""}
            required
            autoFocus={mode === "create"}
            placeholder="e.g. John Michael Smith"
            className={cellInput}
          />
        </Row>

        <Row label="Nationality">
          <input
            name="nationality"
            list="nationalities-list"
            defaultValue={client?.nationality ?? ""}
            placeholder="Start typing, e.g. Indo…"
            autoComplete="off"
            className={cellInput}
          />
        </Row>

        <Row label="Date of birth">
          <DateInput name="date_of_birth" defaultValue={client?.date_of_birth} />
        </Row>

        <Row label="Place of birth">
          <input
            name="place_of_birth"
            defaultValue={client?.place_of_birth ?? ""}
            placeholder="City, Country — e.g. London, UK"
            className={cellInput}
          />
        </Row>
      </Section>

      <Section title="Passport">
        <Row label="Passport no.">
          <input
            name="passport_no"
            defaultValue={client?.passport_no ?? ""}
            placeholder="e.g. A1234567"
            className={cellInput + " font-mono uppercase"}
          />
        </Row>

        <Row label="Passport expiry">
          <DateInput name="passport_expires_at" defaultValue={client?.passport_expires_at} />
        </Row>
      </Section>

      <Section title="Contact">
        <Row label="Phone">
          <input
            name="phone"
            defaultValue={client?.phone ?? ""}
            placeholder="+62 812 3456 7890"
            className={cellInput}
          />
        </Row>

        <Row label="Email">
          <input
            name="email"
            type="email"
            defaultValue={client?.email ?? ""}
            placeholder="name@example.com"
            className={cellInput}
          />
        </Row>

        <Row label="Preferred channel">
          <select
            name="preferred_channel"
            defaultValue={client?.preferred_channel ?? "whatsapp"}
            className={cellInput + " bg-transparent"}
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
          </select>
        </Row>
      </Section>

      <Section title="Files">
        <Row label="OneDrive folder">
          <input
            name="drive_folder_url"
            type="url"
            defaultValue={client?.drive_folder_url ?? ""}
            placeholder="Paste OneDrive share link"
            className={cellInput}
          />
        </Row>
      </Section>

      <Section title="Relationship" last>
        <Row label="Introduced by">
          <select
            name="introduced_by_partner_id"
            defaultValue={client?.introduced_by_partner_id ?? ""}
            className={cellInput + " bg-transparent"}
          >
            <option value="">—</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
            ))}
          </select>
        </Row>

        <Row label="Notes" align="start">
          <textarea
            name="notes"
            defaultValue={client?.notes ?? ""}
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
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-[13px] text-[var(--muted)] hover:text-ink rounded-md hover:bg-[var(--surface-muted)]"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={pending}
          className="px-3.5 py-1.5 text-[13px] font-medium bg-ink text-white rounded-md hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : submitLabel ?? (mode === "create" ? "Create client" : "Save changes")}
        </button>
      </div>
    </form>
  );
}

/** Section wrapper: quiet uppercase heading + divided rows. */
function Section({
  title,
  last,
  children,
}: {
  title: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={last ? "" : "mb-6"}>
      <div className="text-[10.5px] uppercase tracking-widest text-[var(--muted)] font-semibold mb-1">
        {title}
      </div>
      <div className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
        {children}
      </div>
    </div>
  );
}

/** A single label/value row, key on the left, editable value on the right. */
function Row({
  label,
  required,
  align = "center",
  children,
}: {
  label: string;
  required?: boolean;
  align?: "start" | "center";
  children: React.ReactNode;
}) {
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
