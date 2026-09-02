"use client";
import { useState, useTransition } from "react";
import { DateInput } from "@/components/ui/DateInput";
import { Combobox, type ComboOption } from "@/components/ui/Combobox";
import type { CasePriority } from "@/lib/types";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";

const PRIORITIES: CasePriority[] = ["low", "normal", "high", "urgent"];

type Mode = "create" | "edit";

type Option = { id: string; label: string; hint?: string };

export type CaseFormDefaults = {
  id?: string;
  client_id?: string | null;
  company_id?: string | null;
  service_type_id?: string;
  priority?: CasePriority;
  assigned_to?: string | null;
  deadline?: string | null;
  title?: string | null;
  drive_folder_url?: string | null;
};

type Scope = "client" | "company";

export function CaseForm({
  mode,
  defaults,
  clients,
  companies,
  services,
  users,
  hasDeliverableByService,
  action,
  onCancel,
  submitLabel,
}: {
  mode: Mode;
  defaults?: CaseFormDefaults;
  clients: Option[];
  companies: Option[];
  services: Option[];
  users: Option[];
  hasDeliverableByService: Record<string, boolean>;
  action: (fd: FormData) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const { t } = useT();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState<string>(defaults?.service_type_id ?? "");

  // Initial scope: an existing case that has only a company (no client) starts
  // as "company"; everything else starts as "client".
  const initialScope: Scope =
    defaults?.company_id && !defaults?.client_id ? "company" : "client";
  const [scope, setScope] = useState<Scope>(initialScope);

  const hasDeliverable = serviceId ? hasDeliverableByService[serviceId] !== false : true;

  const toCombo = (opts: Option[]): ComboOption[] =>
    opts.map((o) => ({ id: o.id, label: o.label, hint: o.hint }));

  return (
    <form
      action={(fd) => {
        setError(null);
        // If scope is company-only, blank the client id so the server treats
        // it as a company case. Same for the inverse.
        if (scope === "company") fd.set("client_id", "");
        start(async () => {
          try { await action(fd); }
          catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
        });
      }}
    >
      {mode === "edit" && defaults?.id && <input type="hidden" name="id" value={defaults.id} />}

      <Section title={t("case.form.what_who")}>
        <Row label={t("case.form.for_a")} required>
          <div className="inline-flex items-center gap-1.5">
            <ScopePill
              active={scope === "client"}
              onClick={() => setScope("client")}
              label={t("case.form.scope_client")}
              dot="bg-[#22C55E]"
            />
            <ScopePill
              active={scope === "company"}
              onClick={() => setScope("company")}
              label={t("case.form.scope_company")}
              dot="bg-[#8B5CF6]"
            />
          </div>
        </Row>

        {scope === "client" ? (
          <>
            <Row label={t("case.field.client")} required>
              <Combobox
                name="client_id"
                options={toCombo(clients)}
                defaultValue={defaults?.client_id ?? ""}
                placeholder={t("case.form.search_client")}
                required
              />
            </Row>
            <Row label={t("case.field.company")}>
              <Combobox
                name="company_id"
                options={toCombo(companies)}
                defaultValue={defaults?.company_id ?? ""}
                placeholder={t("case.form.search_company_optional")}
                emptyLabel={t("case.form.personal_case")}
                allowEmpty
              />
            </Row>
          </>
        ) : (
          <Row label={t("case.field.company")} required>
            <Combobox
              name="company_id"
              options={toCombo(companies)}
              defaultValue={defaults?.company_id ?? ""}
              placeholder={t("case.form.search_company")}
              required
            />
          </Row>
        )}

        <Row label={t("case.field.service")} required>
          <Combobox
            name="service_type_id"
            options={toCombo(services)}
            defaultValue={defaults?.service_type_id ?? ""}
            placeholder={t("case.form.search_service")}
            required
            onChange={setServiceId}
          />
        </Row>
        <Row label={t("case.form.title_note")}>
          <input
            name="title"
            defaultValue={defaults?.title ?? ""}
            placeholder={t("case.form.title_placeholder")}
            className={cellInput}
          />
        </Row>
      </Section>

      <Section title={t("case.form.section.assignment")}>
        <Row label={t("case.form.assigned_to")}>
          <Combobox
            name="assigned_to"
            options={toCombo(users)}
            defaultValue={defaults?.assigned_to ?? ""}
            placeholder={t("case.form.search_staff")}
            emptyLabel={t("case.form.unassigned_dash")}
            allowEmpty
          />
        </Row>
        <Row label={t("case.field.priority")}>
          <select name="priority" defaultValue={defaults?.priority ?? "normal"} className={cellInput}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{t(`priority.${p}` as MessageKey)}</option>
            ))}
          </select>
        </Row>
        <Row label={t("case.field.deadline")}>
          <DateInput name="deadline" defaultValue={defaults?.deadline} />
        </Row>
      </Section>

      <Section title={t("case.form.section.files")} last>
        <Row label={t("field.onedrive_folder")}>
          <input
            name="drive_folder_url"
            type="url"
            defaultValue={defaults?.drive_folder_url ?? ""}
            placeholder={t("form.placeholder.drive_url")}
            className={cellInput}
          />
        </Row>
      </Section>

      {!hasDeliverable && serviceId && (
        <div className="text-[12px] text-[var(--muted)] mt-2">
          {t("case.form.no_deliverable")}
        </div>
      )}

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
          {pending ? t("form.saving") : submitLabel ?? (mode === "create" ? t("case.form.create") : t("action.save_changes"))}
        </button>
      </div>
    </form>
  );
}

function ScopePill({
  active, onClick, label, dot,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  dot: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-medium transition-colors ${
        active
          ? "bg-brand-soft text-brand-dark"
          : "text-[var(--muted)] hover:text-ink hover:bg-white/50"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${active ? dot : "bg-current opacity-50"}`} />
      {label}
    </button>
  );
}

function Section({ title, last, children }: { title: string; last?: boolean; children: React.ReactNode }) {
  return (
    <section className={`bg-surface rounded-2xl shadow-[0_1px_3px_rgba(15,31,29,0.06),0_8px_24px_-6px_rgba(15,31,29,0.10)] p-5 ${last ? "" : "mb-4"}`}>
      <h2 className="font-serif text-[15px] text-ink leading-none mb-3">{title}</h2>
      <div className="divide-y divide-[var(--border)]">{children}</div>
    </section>
  );
}

function Row({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-4 py-2 items-center">
      <div className="text-[12px] text-[var(--muted)] font-medium">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </div>
      <div>{children}</div>
    </div>
  );
}

const cellInput =
  "w-full px-2.5 py-1.5 bg-transparent border border-transparent rounded-md text-[13.5px] text-ink hover:border-[var(--border)] focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 placeholder:text-[var(--muted)]";
