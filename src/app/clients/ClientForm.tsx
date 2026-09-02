"use client";
import { useMemo, useState, useTransition } from "react";
import type { Client, Partner } from "@/lib/types";
import { NATIONALITIES } from "@/lib/nationalities";
import { DateInput } from "@/components/ui/DateInput";
import { useT } from "@/lib/i18n/client";

type Mode = "create" | "edit";

export type CompanyRoleOption = { code: string; label_en: string };
export type ExistingCompanyOption = { id: string; code: string; name: string };

type CompanyRow = {
  uid: string;
  kind: "new" | "existing";
  role: string;
  company_id: string;
  name: string;
};

function newRow(defaultRole: string): CompanyRow {
  return {
    uid: Math.random().toString(36).slice(2),
    kind: "new",
    role: defaultRole,
    company_id: "",
    name: "",
  };
}

export function ClientForm({
  mode,
  client,
  partners,
  action,
  onCancel,
  submitLabel,
  roles = [],
  existingCompanies = [],
}: {
  mode: Mode;
  client?: Partial<Client>;
  partners: Pick<Partner, "id" | "name" | "code">[];
  action: (fd: FormData) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  roles?: CompanyRoleOption[];
  existingCompanies?: ExistingCompanyOption[];
}) {
  const { t } = useT();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const defaultRole = roles[0]?.code ?? "";
  const [companies, setCompanies] = useState<CompanyRow[]>([]);

  const companiesJson = useMemo(() => {
    const clean = companies
      .map((c) => {
        if (!c.role) return null;
        if (c.kind === "existing") {
          if (!c.company_id) return null;
          return { kind: "existing", company_id: c.company_id, role: c.role };
        }
        if (!c.name.trim()) return null;
        return { kind: "new", name: c.name.trim(), role: c.role };
      })
      .filter(Boolean);
    return JSON.stringify(clean);
  }, [companies]);

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
      {mode === "create" && <input type="hidden" name="companies_json" value={companiesJson} />}

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

        <Row label={t("field.passport_no")} required={mode === "create"}>
          <input
            name="passport_no"
            defaultValue={client?.passport_no ?? ""}
            required={mode === "create"}
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
          <Section title={t("section.passport")}>
            <Row label={t("field.passport_expiry")}>
              <DateInput name="passport_expires_at" defaultValue={client?.passport_expires_at} />
            </Row>
          </Section>

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

          <Section title={t("section.files")}>
            <Row label={t("field.onedrive_folder")}>
              <input
                name="drive_folder_url"
                type="url"
                defaultValue={client?.drive_folder_url ?? ""}
                placeholder={t("form.placeholder.drive_url")}
                className={cellInput}
              />
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

      {mode === "create" && (
        <CompaniesSection
          companies={companies}
          setCompanies={setCompanies}
          roles={roles}
          existingCompanies={existingCompanies}
          defaultRole={defaultRole}
        />
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
          className="px-3.5 py-1.5 text-[13px] font-medium bg-ink text-white rounded-md hover:opacity-90 disabled:opacity-50"
        >
          {pending ? t("form.saving") : submitLabel ?? (mode === "create" ? t("form.action.create_client") : t("action.save_changes"))}
        </button>
      </div>
    </form>
  );
}

function CompaniesSection({
  companies, setCompanies, roles, existingCompanies, defaultRole,
}: {
  companies: CompanyRow[];
  setCompanies: (fn: (prev: CompanyRow[]) => CompanyRow[]) => void;
  roles: CompanyRoleOption[];
  existingCompanies: ExistingCompanyOption[];
  defaultRole: string;
}) {
  const { t } = useT();
  const update = (uid: string, patch: Partial<CompanyRow>) =>
    setCompanies((prev) => prev.map((c) => (c.uid === uid ? { ...c, ...patch } : c)));
  const remove = (uid: string) => setCompanies((prev) => prev.filter((c) => c.uid !== uid));
  const add = () => setCompanies((prev) => [...prev, newRow(defaultRole)]);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[10.5px] uppercase tracking-widest text-[var(--muted)] font-semibold">
          {t("form.companies_of_person")}
        </div>
        <button type="button" onClick={add} className="text-[12px] font-medium text-brand hover:text-brand-dark">
          {t("form.add_company")}
        </button>
      </div>
      <div className="border-t border-[var(--border)] divide-y divide-[var(--border)]">
        {companies.length === 0 && (
          <div className="py-3 text-[12.5px] text-[var(--muted)]">
            {t("form.no_companies_yet")}
          </div>
        )}
        {companies.map((c, idx) => (
          <div key={c.uid} className="py-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-wider text-[var(--muted)] font-semibold">
                {t("form.company_index", { n: idx + 1 })}
              </div>
              <div className="flex items-center gap-2 text-[11.5px]">
                <label className="inline-flex items-center gap-1 text-[var(--muted)]">
                  <input
                    type="radio"
                    name={`kind-${c.uid}`}
                    checked={c.kind === "new"}
                    onChange={() => update(c.uid, { kind: "new" })}
                  />
                  {t("form.kind_new")}
                </label>
                <label className="inline-flex items-center gap-1 text-[var(--muted)]">
                  <input
                    type="radio"
                    name={`kind-${c.uid}`}
                    checked={c.kind === "existing"}
                    onChange={() => update(c.uid, { kind: "existing" })}
                  />
                  {t("form.kind_existing")}
                </label>
                <button
                  type="button"
                  onClick={() => remove(c.uid)}
                  className="text-[var(--muted)] hover:text-red-700 ml-1"
                  aria-label={t("form.remove")}
                  title={t("form.remove")}
                >
                  ✕
                </button>
              </div>
            </div>

            {c.kind === "existing" ? (
              <div className="grid grid-cols-[1fr_180px] gap-2">
                <select
                  value={c.company_id}
                  onChange={(e) => update(c.uid, { company_id: e.target.value })}
                  className={cellInput}
                >
                  <option value="">{t("form.pick_existing_company")}</option>
                  {existingCompanies.map((co) => (
                    <option key={co.id} value={co.id}>{co.name} ({co.code})</option>
                  ))}
                </select>
                <RoleSelect value={c.role} onChange={(v) => update(c.uid, { role: v })} roles={roles} />
              </div>
            ) : (
              <div className="grid grid-cols-[1fr_180px] gap-2">
                <input
                  placeholder={t("form.placeholder.company_name_required")}
                  value={c.name}
                  onChange={(e) => update(c.uid, { name: e.target.value })}
                  className={cellInput}
                />
                <RoleSelect value={c.role} onChange={(v) => update(c.uid, { role: v })} roles={roles} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function RoleSelect({ value, onChange, roles }: { value: string; onChange: (v: string) => void; roles: CompanyRoleOption[] }) {
  const { t } = useT();
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} required className={cellInput}>
      {roles.length === 0 && <option value="">{t("form.no_roles_configured")}</option>}
      {roles.map((r) => <option key={r.code} value={r.code}>{r.label_en}</option>)}
    </select>
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
