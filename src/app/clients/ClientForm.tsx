"use client";
import { useState, useTransition } from "react";
import type { Client, Partner } from "@/lib/types";
import { NATIONALITIES } from "@/lib/nationalities";
import { DateInput } from "@/components/ui/DateInput";
import { Spinner } from "@/components/ui/Spinner";
import { useT } from "@/lib/i18n/client";

type Mode = "create" | "edit";

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
  action: (fd: FormData) => Promise<void | { error?: string }>;
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
            const res = await action(fd);
            if (res && "error" in res && res.error) setError(res.error);
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

      <Section title={t("section.identity")}>
        <Row label={t("field.full_name")} required>
          <input
            name="full_name"
            defaultValue={client?.full_name ?? ""}
            required
            autoFocus={mode === "create"}
            placeholder={t("form.placeholder.full_name_example")}
            className={cellInput}
          />
        </Row>

        <Row label={t("field.passport_no")}>
          <input
            name="passport_no"
            defaultValue={client?.passport_no ?? ""}
            placeholder={t("form.placeholder.passport_example")}
            className={cellInput + " font-mono uppercase"}
          />
        </Row>

        <Row label={t("field.nationality")}>
          <input
            name="nationality"
            list="nationalities-list"
            defaultValue={client?.nationality ?? ""}
            placeholder={t("form.placeholder.nationality")}
            autoComplete="off"
            className={cellInput}
          />
        </Row>

        {mode === "edit" && (
          <>
            <Row label={t("field.date_of_birth")}>
              <DateInput name="date_of_birth" defaultValue={client?.date_of_birth} />
            </Row>

            <Row label={t("field.place_of_birth")}>
              <input
                name="place_of_birth"
                defaultValue={client?.place_of_birth ?? ""}
                placeholder={t("form.placeholder.dob_place")}
                className={cellInput}
              />
            </Row>
          </>
        )}

      </Section>

      {mode === "edit" && (
        <>
          <Section title={t("section.contact")}>
            <Row label={t("field.phone")}>
              <input
                name="phone"
                defaultValue={client?.phone ?? ""}
                placeholder={t("form.placeholder.phone")}
                className={cellInput}
              />
            </Row>

            <Row label={t("field.email")}>
              <input
                name="email"
                type="email"
                defaultValue={client?.email ?? ""}
                placeholder={t("form.placeholder.email")}
                className={cellInput}
              />
            </Row>

            <Row label={t("field.preferred_channel")}>
              <select
                name="preferred_channel"
                defaultValue={client?.preferred_channel ?? "whatsapp"}
                className={cellInput + " bg-transparent"}
              >
                <option value="whatsapp">{t("form.channel.whatsapp")}</option>
                <option value="email">{t("form.channel.email")}</option>
              </select>
            </Row>
          </Section>

          <Section title={t("section.relationship")}>
            <Row label={t("field.introduced_by")}>
              <select
                name="introduced_by_partner_id"
                defaultValue={client?.introduced_by_partner_id ?? ""}
                className={cellInput + " bg-transparent"}
              >
                <option value="">{t("form.dash")}</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                ))}
              </select>
            </Row>
          </Section>
        </>
      )}

      <Section title={t("section.notes")} last>
        <Row label={t("field.notes")} align="start">
          <textarea
            name="notes"
            defaultValue={client?.notes ?? ""}
            rows={3}
            placeholder={t("form.placeholder.notes")}
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
            {t("action.cancel")}
          </button>
        )}
        <button
          type="submit"
          disabled={pending}
          className="px-3.5 py-1.5 text-[13px] font-medium bg-ink text-white rounded-md hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
        >
          {pending && <Spinner className="h-3.5 w-3.5" />}
          {pending ? t("form.saving") : submitLabel ?? (mode === "create" ? t("form.action.create_client") : t("action.save_changes"))}
        </button>
      </div>
    </form>
  );
}

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
