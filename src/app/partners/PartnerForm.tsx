"use client";
import { useState, useTransition } from "react";
import type { Partner } from "@/lib/types";

type Mode = "create" | "edit";

export function PartnerForm({
  mode,
  partner,
  action,
  onCancel,
  submitLabel,
}: {
  mode: Mode;
  partner?: Partial<Partner>;
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
      {mode === "edit" && partner?.id && <input type="hidden" name="id" value={partner.id} />}

      <Section title="Identity">
        <Row label="Name" required>
          <input
            name="name"
            defaultValue={partner?.name ?? ""}
            required
            autoFocus={mode === "create"}
            placeholder="e.g. Bali Visa Consultants"
            className={cellInput}
          />
        </Row>

        <Row label="Type" required>
          <select name="type" defaultValue={partner?.type ?? "referrer"} className={cellInput + " bg-transparent"}>
            <option value="referrer">Referrer — sends us clients</option>
            <option value="agent">Agent — we act as back office</option>
            <option value="both">Both</option>
          </select>
        </Row>
      </Section>

      <Section title="Contact">
        <Row label="Contact person">
          <input
            name="contact_person"
            defaultValue={partner?.contact_person ?? ""}
            placeholder="e.g. Andi Wijaya"
            className={cellInput}
          />
        </Row>
        <Row label="Phone">
          <input
            name="phone"
            defaultValue={partner?.phone ?? ""}
            placeholder="+62 812 3456 7890"
            className={cellInput}
          />
        </Row>
        <Row label="Email">
          <input
            name="email"
            type="email"
            defaultValue={partner?.email ?? ""}
            placeholder="name@example.com"
            className={cellInput}
          />
        </Row>
      </Section>

      <Section title="Notes" last>
        <Row label="Notes" align="start">
          <textarea
            name="notes"
            defaultValue={partner?.notes ?? ""}
            rows={3}
            placeholder="Anything worth remembering — commission terms, quirks, history…"
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
          {pending ? "Saving…" : submitLabel ?? (mode === "create" ? "Create partner" : "Save changes")}
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
