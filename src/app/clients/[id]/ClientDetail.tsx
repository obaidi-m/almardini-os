"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { Client, Partner, CaseStatus, CasePriority } from "@/lib/types";
import { ClientForm } from "../ClientForm";
import { updateClientAction, softDeleteClientAction, restoreClientAction } from "../actions";
import { linkClientToCompanyAction, unlinkClientFromCompanyAction } from "@/app/companies/actions";
import { Modal } from "@/components/ui/Modal";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";

type Role = { code: string; label_en: string; label_id: string | null; sort_order: number };
type CaseSummary = {
  id: string;
  code: string;
  title: string | null;
  status: CaseStatus;
  priority: CasePriority;
  service: { id: string; name: string; recurring_amount: number | null; recurring_unit: string | null }[] | { id: string; name: string; recurring_amount: number | null; recurring_unit: string | null } | null;
};

const STATUS_PILL: Record<CaseStatus, string> = {
  new:         "bg-[#FEF3C7] text-[#92400E]",
  in_progress: "bg-[#DBEAFE] text-[#1E40AF]",
  done:        "bg-[#DCFCE7] text-[#166534]",
  delivered:   "bg-[var(--surface-2)] text-[var(--muted)]",
};

type LinkedCompany = { role: string; company: { id: string; code: string; name: string } | null };
type CompanyOption = { id: string; code: string; name: string };

export function ClientDetail({
  client, partners, linkedCompanies, allCompanies, roles, cases,
}: {
  client: Client;
  partners: Pick<Partner, "id" | "name" | "code">[];
  linkedCompanies: LinkedCompany[];
  allCompanies: CompanyOption[];
  roles: Role[];
  cases: CaseSummary[];
}) {
  const { t } = useT();
  const roleLabel = (code: string) => roles.find((r) => r.code === code)?.label_en ?? code;
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [flash, setFlash] = useState<string | null>(null);
  const [showDeliveredCases, setShowDeliveredCases] = useState(false);

  return (
    <div>
      {/* Actions bar */}
      <div className="flex items-center justify-end gap-2 mb-4">
        {!client.deleted_at ? (
          <>
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 bg-surface hover:bg-[var(--surface-deep)] text-ink text-[12.5px] font-medium px-3 py-1.5 rounded-lg shadow-sm border border-[var(--border)] transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4z" />
              </svg>
              {t("action.edit")}
            </button>
            <form
              action={(fd) => {
                if (!confirm(t("detail.confirm_archive_client", { name: client.full_name }))) return;
                start(async () => {
                  try { await softDeleteClientAction(fd); }
                  catch (e) { setFlash(e instanceof Error ? e.message : "Failed"); }
                });
              }}
            >
              <input type="hidden" name="id" value={client.id} />
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center gap-1.5 text-[var(--muted)] hover:text-red-700 hover:bg-red-50 text-[12.5px] font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {t("action.archive")}
              </button>
            </form>
          </>
        ) : (
          <form
            action={(fd) => {
              start(async () => {
                try { await restoreClientAction(fd); }
                catch (e) { setFlash(e instanceof Error ? e.message : "Failed"); }
              });
            }}
          >
            <input type="hidden" name="id" value={client.id} />
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-1.5 bg-brand hover:bg-brand-dark text-white text-[12.5px] font-medium px-3 py-1.5 rounded-lg disabled:opacity-50"
            >
              {t("action.restore")}
            </button>
          </form>
        )}
      </div>

      {flash && (
        <div className="mb-4 text-[12.5px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {flash}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* LEFT COLUMN */}
        <div className="space-y-5">
          <Card title={t("section.identity")}>
            <FieldRow label={t("field.nationality")} value={client.nationality} />
            <FieldRow label={t("field.date_of_birth")} value={fmtDate(client.date_of_birth)} />
            <FieldRow label={t("field.place_of_birth")} value={client.place_of_birth} />
          </Card>

          <Card title={t("section.passport")}>
            <FieldRow label={t("field.passport_no")} value={client.passport_no ? <span className="font-mono text-[13px]">{client.passport_no}</span> : null} />
          </Card>

          <Card title={t("section.contact")}>
            <FieldRow label={t("field.phone")} value={client.phone} />
            <FieldRow label={t("field.email")} value={client.email} />
            <FieldRow label={t("field.preferred_channel")} value={<ChannelPill c={client.preferred_channel} t={t} />} />
          </Card>

          <Card title={t("section.relationship")}>
            <FieldRow
              label={t("field.introduced_by")}
              value={
                client.introduced_by ? (
                  <Link href={`/partners/${client.introduced_by.id}`} className="text-brand hover:underline">
                    {client.introduced_by.name}
                    <span className="font-mono text-[11.5px] text-[var(--muted)] ml-2">{client.introduced_by.code}</span>
                  </Link>
                ) : null
              }
            />
            <FieldRow label={t("field.created")} value={fmtDate(client.created_at)} />
          </Card>

          <Card title={t("section.files")}>
            <FieldRow label={t("field.onedrive_folder")} value={<DriveLink url={client.drive_folder_url} label={t("onedrive.open")} />} />
          </Card>

          {client.notes && (
            <Card title={t("section.notes")}>
              <p className="text-[13.5px] whitespace-pre-wrap text-ink leading-relaxed py-1">
                {client.notes}
              </p>
            </Card>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-5">
          <Card
            title={t("section.linked_companies")}
            count={linkedCompanies.length}
            padded
          >
            <CompaniesLinker
              clientId={client.id}
              linkedCompanies={linkedCompanies}
              allCompanies={allCompanies}
              roles={roles}
              roleLabel={roleLabel}
            />
          </Card>

          <Card
            title={t("section.cases")}
            count={cases.length}
            padded
            action={
              <Link
                href={`/cases/new?client=${client.id}`}
                className="text-[12px] font-medium text-brand hover:text-brand-dark"
              >
                {t("detail.new_case")}
              </Link>
            }
          >
            {cases.length === 0 ? (
              <p className="text-[12.5px] text-[var(--muted)]">{t("detail.no_client_cases")}</p>
            ) : (() => {
              // Active first (New → In progress → Done); Delivered hidden
              // behind a toggle so old month-by-month cases don't dominate.
              const order: Record<CaseStatus, number> = { new: 0, in_progress: 1, done: 2, delivered: 3 };
              const sorted = [...cases].sort((a, b) => order[a.status] - order[b.status]);
              const activeCount = sorted.filter((c) => c.status !== "delivered").length;
              const deliveredCount = sorted.length - activeCount;
              const visible = showDeliveredCases ? sorted : sorted.filter((c) => c.status !== "delivered");
              return (
              <>
              <ul className="divide-y divide-[var(--border)] -mx-1">
                {visible.map((c) => {
                  const service = Array.isArray(c.service) ? c.service[0] : c.service;
                  return (
                    <li key={c.id}>
                      <Link
                        href={`/cases/${c.id}`}
                        className="grid grid-cols-[88px_1fr_auto] gap-3 items-center px-1 py-2.5 text-[13.5px] hover:bg-[var(--surface-deep)] rounded"
                      >
                        <span className="font-mono text-[11px] text-brand-dark bg-brand-softer px-1.5 py-0.5 rounded justify-self-start">
                          {c.code}
                        </span>
                        <span className="min-w-0">
                          <span className="text-ink font-medium block truncate">
                            {c.title || service?.name || t("detail.untitled")}
                            {service?.recurring_amount && service?.recurring_unit && (
                              <span className="text-[9.5px] font-medium text-[#5B21B6] bg-[#EDE9FE] px-1 py-0 rounded ml-1.5 align-middle" title={`Recurring every ${service.recurring_amount} ${service.recurring_unit}`}>
                                {t("badge.recurring")}
                              </span>
                            )}
                          </span>
                          {c.title && service?.name && (
                            <span className="text-[11.5px] text-[var(--muted)] block truncate">{service.name}</span>
                          )}
                        </span>
                        <span className={`text-[10.5px] font-medium px-2 py-0.5 rounded-full ${STATUS_PILL[c.status]}`}>
                          {t(`status.${c.status}` as MessageKey)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {deliveredCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowDeliveredCases((v) => !v)}
                  className="mt-2 text-[11.5px] text-[var(--muted)] hover:text-ink"
                >
                  {showDeliveredCases ? t("detail.hide_completed", { n: deliveredCount }) : t("detail.show_completed", { n: deliveredCount })}
                </button>
              )}
              {activeCount === 0 && !showDeliveredCases && (
                <p className="text-[12.5px] text-[var(--muted)] mt-1">{t("detail.no_active_cases")}</p>
              )}
              </>
              );
            })()}
          </Card>

        </div>
      </div>

      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title={t("detail.edit_client_title")}
        subtitle={client.code}
        size="xl"
      >
        <ClientForm
          mode="edit"
          client={client}
          partners={partners}
          action={async (fd) => { await updateClientAction(fd); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      </Modal>
    </div>
  );
}

/* ============ Companies linker (used inside a Card) ============ */
function CompaniesLinker({
  clientId, linkedCompanies, allCompanies, roles, roleLabel,
}: {
  clientId: string;
  linkedCompanies: LinkedCompany[];
  allCompanies: CompanyOption[];
  roles: Role[];
  roleLabel: (code: string) => string;
}) {
  const { t } = useT();
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <div className="flex items-center justify-end mb-2 -mt-1">
        {!adding && (
          <button
            onClick={() => { setAdding(true); setError(null); }}
            className="text-[12px] font-medium text-brand hover:text-brand-dark"
          >
            {t("detail.link_company")}
          </button>
        )}
      </div>

      {adding && (
        <form
          action={(fd) => {
            setError(null);
            start(async () => {
              try { await linkClientToCompanyAction(fd); setAdding(false); }
              catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
            });
          }}
          className="bg-[var(--surface-2)] rounded-lg p-3 mb-3 flex items-end gap-2"
        >
          <input type="hidden" name="client_id" value={clientId} />
          <div className="flex-1 min-w-0">
            <label className="text-[10.5px] uppercase tracking-wider text-[var(--muted)] font-semibold">{t("field.company")}</label>
            <select name="company_id" required className={selectInput}>
              <option value="">{t("detail.select_company")}</option>
              {allCompanies.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10.5px] uppercase tracking-wider text-[var(--muted)] font-semibold">{t("detail.role")}</label>
            <select name="role" defaultValue={roles[0]?.code ?? ""} className={selectInput}>
              {roles.map((r) => <option key={r.code} value={r.code}>{r.label_en}</option>)}
            </select>
          </div>
          <button type="submit" disabled={pending} className="px-3 py-1.5 text-[13px] font-medium bg-brand hover:bg-brand-dark text-white rounded-lg disabled:opacity-50">
            {t("detail.link")}
          </button>
          <button type="button" onClick={() => { setAdding(false); setError(null); }} className="px-2.5 py-1.5 text-[13px] text-[var(--muted)] hover:text-ink">
            {t("action.cancel")}
          </button>
        </form>
      )}

      {error && (
        <div className="mb-3 text-[12.5px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {linkedCompanies.length === 0 && !adding ? (
        <p className="text-[12.5px] text-[var(--muted)]">{t("detail.not_linked_company")}</p>
      ) : (
        <ul className="divide-y divide-[var(--border)] -mx-1">
          {linkedCompanies.map((l, i) => (
            <li key={i} className="px-1 py-2.5 grid grid-cols-[88px_1fr_auto_auto] gap-3 items-center text-[13.5px]">
              <span className="font-mono text-[11px] text-brand-dark bg-brand-softer px-1.5 py-0.5 rounded justify-self-start">
                {l.company?.code ?? "—"}
              </span>
              <span className="text-ink font-medium truncate">
                {l.company ? (
                  <Link href={`/companies/${l.company.id}`} className="hover:text-brand">{l.company.name}</Link>
                ) : (
                  <span className="text-[var(--muted)] italic">{t("detail.deleted_company")}</span>
                )}
              </span>
              <span className="text-[11.5px] text-[var(--muted)] uppercase tracking-wider">{roleLabel(l.role)}</span>
              <form
                action={(fd) => {
                  if (!confirm(t("detail.confirm_unlink_company"))) return;
                  start(async () => {
                    try { await unlinkClientFromCompanyAction(fd); }
                    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
                  });
                }}
              >
                <input type="hidden" name="client_id" value={clientId} />
                <input type="hidden" name="company_id" value={l.company?.id ?? ""} />
                <input type="hidden" name="role" value={l.role} />
                <button type="submit" className="text-[11.5px] text-[var(--muted)] hover:text-red-700">
                  {t("detail.unlink")}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ============ Shared card / field building blocks ============ */
const selectInput =
  "w-full mt-1 px-2.5 py-1.5 bg-white border border-[var(--border)] rounded-lg text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";

function Card({
  title, count, action, children, padded,
}: {
  title?: string;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
  padded?: boolean;
}) {
  return (
    <section className="bg-surface rounded-2xl shadow-[0_1px_3px_rgba(15,31,29,0.06),0_8px_24px_-6px_rgba(15,31,29,0.10)] p-5">
      {(title || action) && (
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-baseline gap-2">
            {title && <h2 className="font-serif text-[15px] text-ink leading-none">{title}</h2>}
            {typeof count === "number" && (
              <span className="text-[11.5px] text-[var(--muted)] font-medium">{count}</span>
            )}
          </div>
          {action}
        </div>
      )}
      <div className={padded ? "" : "-mb-1"}>{children}</div>
    </section>
  );
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  const empty = value == null || value === "";
  return (
    <div className="grid grid-cols-[140px_1fr] gap-4 py-2 items-center border-t border-[var(--border)] first:border-t-0">
      <div className="text-[11.5px] text-[var(--muted)] font-medium">{label}</div>
      <div className={`text-[13.5px] ${empty ? "text-[var(--hint)]" : "text-ink"}`}>
        {empty ? "—" : value}
      </div>
    </div>
  );
}

type Tr = (k: MessageKey, vars?: Record<string, string | number>) => string;

function ChannelPill({ c, t }: { c?: string | null; t: Tr }) {
  if (!c) return <span className="text-[var(--hint)]">—</span>;
  const styles: Record<string, string> = {
    whatsapp:  "bg-[#DCFCE7] text-[#166534]",
    email:     "bg-[#DBEAFE] text-[#1E40AF]",
    phone:     "bg-[#FEF3C7] text-[#92400E]",
    in_person: "bg-[#EDE9FE] text-[#5B21B6]",
  };
  const cls = styles[c] ?? "bg-[var(--surface-2)] text-[var(--muted)]";
  return (
    <span className={`inline-block text-[10.5px] font-medium px-2 py-0.5 rounded-full ${cls}`}>
      {t(`channel.${c}` as MessageKey)}
    </span>
  );
}

function DriveLink({ url, label }: { url: string | null; label: string }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-brand hover:text-brand-dark font-medium"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 8a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      </svg>
      {label}
    </a>
  );
}

function fmtDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${d.getFullYear()}`;
  } catch {
    return value;
  }
}
