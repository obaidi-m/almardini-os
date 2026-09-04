"use client";
import { useMemo, useState, useTransition } from "react";
import type { Company } from "@/lib/types";
import { DateInput } from "@/components/ui/DateInput";
import { Spinner } from "@/components/ui/Spinner";
import { NATIONALITIES } from "@/lib/nationalities";
import { useT } from "@/lib/i18n/client";

type Mode = "create" | "edit";

export type CompanyRoleOption = { code: string; label_en: string };
export type ExistingClientOption = { id: string; code: string; full_name: string };

type PersonRow = {
  uid: string;
  kind: "new" | "existing";
  role: string;
  client_id: string;
  full_name: string;
  passport_no: string;
  nationality: string;
};

function newRow(defaultRole: string): PersonRow {
  return {
    uid: Math.random().toString(36).slice(2),
    kind: "new",
    role: defaultRole,
    client_id: "",
    full_name: "",
    passport_no: "",
    nationality: "",
  };
}

export function CompanyForm({
  mode,
  company,
  action,
  onCancel,
  submitLabel,
  roles = [],
  existingClients = [],
}: {
  mode: Mode;
  company?: Partial<Company>;
  action: (fd: FormData) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  roles?: CompanyRoleOption[];
  existingClients?: ExistingClientOption[];
}) {
  const { t } = useT();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const defaultRole = roles[0]?.code ?? "";
  const [people, setPeople] = useState<PersonRow[]>(mode === "create" ? [newRow(defaultRole)] : []);

  const peopleJson = useMemo(() => {
    const clean = people
      .map((p) => {
        if (!p.role) return null;
        if (p.kind === "existing") {
          if (!p.client_id) return null;
          return { kind: "existing", client_id: p.client_id, role: p.role };
        }
        if (!p.full_name.trim() || !p.passport_no.trim()) return null;
        return {
          kind: "new",
          full_name: p.full_name.trim(),
          passport_no: p.passport_no.trim(),
          nationality: p.nationality.trim() || null,
          role: p.role,
        };
      })
      .filter(Boolean);
    return JSON.stringify(clean);
  }, [people]);

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
      {mode === "create" && <input type="hidden" name="people_json" value={peopleJson} />}

      <Section title={t("section.identity")}>
        <Row label={t("field.company_name")} required>
          <input
            name="name"
            defaultValue={company?.name ?? ""}
            required
            autoFocus={mode === "create"}
            placeholder={t("form.placeholder.company_name_example")}
            className={cellInput}
          />
        </Row>

        {mode === "edit" && (
          <>
            <Row label={t("field.nib")}>
              <input
                name="nib"
                defaultValue={company?.nib ?? ""}
                placeholder={t("form.placeholder.nib")}
                className={cellInput + " font-mono"}
              />
            </Row>

            <Row label={t("field.incorporation_date")}>
              <DateInput name="incorporation_date" defaultValue={company?.incorporation_date} />
            </Row>
          </>
        )}
      </Section>

      {mode === "edit" && (
        <>
          <Section title={t("section.address")}>
            <Row label={t("field.address")} align="start">
              <textarea
                name="address"
                defaultValue={company?.address ?? ""}
                rows={2}
                placeholder={t("form.placeholder.address")}
                className={cellInput + " resize-y"}
              />
            </Row>
          </Section>

          <Section title={t("section.files")}>
            <Row label={t("field.onedrive_folder")}>
              <input
                name="drive_folder_url"
                type="url"
                defaultValue={company?.drive_folder_url ?? ""}
                placeholder={t("form.placeholder.drive_url")}
                className={cellInput}
              />
            </Row>
          </Section>
        </>
      )}

      {mode === "create" && (
        <PeopleSection
          people={people}
          setPeople={setPeople}
          roles={roles}
          existingClients={existingClients}
          defaultRole={defaultRole}
        />
      )}

      <Section title={t("section.notes")} last>
        <Row label={t("field.notes")} align="start">
          <textarea
            name="notes"
            defaultValue={company?.notes ?? ""}
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
          <button type="button" onClick={onCancel} className="px-3 py-1.5 text-[13px] text-[var(--muted)] hover:text-ink rounded-md hover:bg-[var(--surface-muted)]">
            {t("action.cancel")}
          </button>
        )}
        <button type="submit" disabled={pending} className="px-3.5 py-1.5 text-[13px] font-medium bg-ink text-white rounded-md hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2">
          {pending && <Spinner className="h-3.5 w-3.5" />}
          {pending ? t("form.saving") : submitLabel ?? (mode === "create" ? t("form.action.create_company") : t("action.save_changes"))}
        </button>
      </div>
    </form>
  );
}

function PeopleSection({
  people, setPeople, roles, existingClients, defaultRole,
}: {
  people: PersonRow[];
  setPeople: (fn: (prev: PersonRow[]) => PersonRow[]) => void;
  roles: CompanyRoleOption[];
  existingClients: ExistingClientOption[];
  defaultRole: string;
}) {
  const { t } = useT();
  const update = (uid: string, patch: Partial<PersonRow>) =>
    setPeople((prev) => prev.map((p) => (p.uid === uid ? { ...p, ...patch } : p)));
  const remove = (uid: string) => setPeople((prev) => prev.filter((p) => p.uid !== uid));
  const add = () => setPeople((prev) => [...prev, newRow(defaultRole)]);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[10.5px] uppercase tracking-widest text-[var(--muted)] font-semibold">
          {t("form.people_at_company")}
        </div>
        <button type="button" onClick={add} className="text-[12px] font-medium text-brand hover:text-brand-dark">
          {t("form.add_person")}
        </button>
      </div>
      <div className="border-t border-[var(--border)] divide-y divide-[var(--border)]">
        {people.length === 0 && (
          <div className="py-3 text-[12.5px] text-[var(--muted)]">
            {t("form.no_people_yet")}
          </div>
        )}
        {people.map((p, idx) => (
          <div key={p.uid} className="py-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-wider text-[var(--muted)] font-semibold">
                {t("form.person_index", { n: idx + 1 })}
              </div>
              <div className="flex items-center gap-2 text-[11.5px]">
                <label className="inline-flex items-center gap-1 text-[var(--muted)]">
                  <input
                    type="radio"
                    name={`kind-${p.uid}`}
                    checked={p.kind === "new"}
                    onChange={() => update(p.uid, { kind: "new" })}
                  />
                  {t("form.kind_new")}
                </label>
                <label className="inline-flex items-center gap-1 text-[var(--muted)]">
                  <input
                    type="radio"
                    name={`kind-${p.uid}`}
                    checked={p.kind === "existing"}
                    onChange={() => update(p.uid, { kind: "existing" })}
                  />
                  {t("form.kind_existing")}
                </label>
                <button
                  type="button"
                  onClick={() => remove(p.uid)}
                  className="text-[var(--muted)] hover:text-red-700 ml-1"
                  aria-label={t("form.remove")}
                  title={t("form.remove")}
                >
                  ✕
                </button>
              </div>
            </div>

            {p.kind === "existing" ? (
              <div className="grid grid-cols-[1fr_180px] gap-2">
                <select
                  value={p.client_id}
                  onChange={(e) => update(p.uid, { client_id: e.target.value })}
                  className={cellInput}
                >
                  <option value="">{t("form.pick_existing_person")}</option>
                  {existingClients.map((c) => (
                    <option key={c.id} value={c.id}>{c.full_name} ({c.code})</option>
                  ))}
                </select>
                <RoleSelect value={p.role} onChange={(v) => update(p.uid, { role: v })} roles={roles} />
              </div>
            ) : (
              <div className="grid grid-cols-[1.4fr_1fr_1fr_180px] gap-2">
                <input
                  placeholder={t("form.placeholder.full_name_required")}
                  value={p.full_name}
                  onChange={(e) => update(p.uid, { full_name: e.target.value })}
                  className={cellInput}
                />
                <input
                  placeholder={t("form.placeholder.passport_required")}
                  value={p.passport_no}
                  onChange={(e) => update(p.uid, { passport_no: e.target.value })}
                  className={cellInput + " font-mono"}
                />
                <input
                  list={`nats-${p.uid}`}
                  placeholder={t("field.nationality")}
                  value={p.nationality}
                  onChange={(e) => update(p.uid, { nationality: e.target.value })}
                  className={cellInput}
                />
                <datalist id={`nats-${p.uid}`}>
                  {NATIONALITIES.map((n) => <option key={n} value={n} />)}
                </datalist>
                <RoleSelect value={p.role} onChange={(v) => update(p.uid, { role: v })} roles={roles} />
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
