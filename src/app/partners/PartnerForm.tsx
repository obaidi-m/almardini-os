"use client";
import { useState, useTransition } from "react";
import type { Partner } from "@/lib/types";
import { useT } from "@/lib/i18n/client";

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
  const { t } = useT();
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
            setError(e instanceof Error ? e.message : t("partner.err.failed"));
          }
        });
      }}
    >
      {mode === "edit" && partner?.id && <input type="hidden" name="id" value={partner.id} />}

      <Section title={t("partner.section.identity")}>
        <Row label={t("partner.form.name")} required>
          <input
            name="name"
            defaultValue={partner?.name ?? ""}
            required
            autoFocus={mode === "create"}
            placeholder={t("partner.name.placeholder")}
            className={cellInput}
          />
        </Row>

        <Row label={t("partner.form.type")} required>
          <select name="type" defaultValue={partner?.type ?? "referrer"} className={cellInput + " bg-transparent"}>
            <option value="referrer">{t("partner.type.referrer_long")}</option>
            <option value="agent">{t("partner.type.agent_long")}</option>
            <option value="both">{t("partner.type.both")}</option>
          </select>
        </Row>
      </Section>

      <Section title={t("partner.section.contact")}>
        <Row label={t("partner.form.contact_person")}>
          <input
            name="contact_person"
            defaultValue={partner?.contact_person ?? ""}
            placeholder={t("partner.contact_person.placeholder")}
            className={cellInput}
          />
        </Row>
        <Row label={t("partner.form.phone")}>
          <input
            name="phone"
            defaultValue={partner?.phone ?? ""}
            placeholder={t("partner.phone.placeholder")}
            className={cellInput}
          />
        </Row>
        <Row label={t("partner.form.email")}>
          <input
            name="email"
            type="email"
            defaultValue={partner?.email ?? ""}
            placeholder={t("partner.email.placeholder")}
            className={cellInput}
          />
        </Row>
      </Section>

      <Section title={t("partner.section.notes")} last>
        <Row label={t("partner.form.notes")} align="start">
          <textarea
            name="notes"
            defaultValue={partner?.notes ?? ""}
            rows={3}
            placeholder={t("partner.notes.placeholder")}
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
            {t("action.cancel")}
          </button>
        )}
        <button type="submit" disabled={pending} className="px-3.5 py-1.5 text-[13px] font-medium bg-ink text-white rounded-md hover:opacity-90 disabled:opacity-50">
          {pending ? t("partner.saving") : submitLabel ?? (mode === "create" ? t("partner.form.create") : t("action.save_changes"))}
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
