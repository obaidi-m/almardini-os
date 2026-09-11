"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { Company, CaseStatus, CasePriority, EntityService, ServiceType } from "@/lib/types";
import { EntityServicesCard } from "@/components/app/EntityServicesCard";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";
import { serviceLabel } from "@/lib/service";
import { CompanyForm } from "../CompanyForm";
import {
  updateCompanyAction,
  softDeleteCompanyAction,
  hardDeleteCompanyAction,
  restoreCompanyAction,
  linkClientToCompanyAction,
  unlinkClientFromCompanyAction,
} from "../actions";
import { Modal } from "@/components/ui/Modal";
import { useConfirm } from "@/components/ui/ConfirmProvider";

type Role = { code: string; label_en: string; label_id: string | null; sort_order: number };
type LinkedClient = { role: string; client: { id: string; code: string; full_name: string } | null };
type ClientOption = { id: string; code: string; full_name: string };

type CompanyCase = {
  id: string;
  code: string;
  title: string | null;
  status: CaseStatus;
  priority: CasePriority;
  deadline: string | null;
  expires_at: string | null;
  updated_at: string;
  client: { id: string; full_name: string } | null;
  service: { id: string; code: string; name: string; schedule_kind: "one_off" | "annual_fixed" | "quarterly_fixed" | null; annual_month: number | null; annual_day: number | null; quarterly_day: number | null; quarterly_months: number[] | null; validity_amount: number | null; validity_unit: string | null } | null;
};

const STATUS_PILL: Record<CaseStatus, { bg: string; text: string; dot: string }> = {
  new:         { bg: "bg-[#FEF3C7]", text: "text-[#92400E]", dot: "bg-[#F59E0B]" },
  in_progress: { bg: "bg-[#DBEAFE]", text: "text-[#1E40AF]", dot: "bg-[#3B82F6]" },
  done:        { bg: "bg-[#DCFCE7]", text: "text-[#166534]", dot: "bg-[#22C55E]" },
  delivered:   { bg: "bg-[var(--surface-2)]", text: "text-[var(--muted)]", dot: "bg-[var(--muted)]" },
};

type PartnerOpt = { id: string; code: string; name: string };

export function CompanyDetail({
  company, linkedClients, allClients, roles, cases, partners = [],
  entityServices = [], catalog = [], handledServiceIds = [],
}: {
  company: Company;
  linkedClients: LinkedClient[];
  allClients: ClientOption[];
  roles: Role[];
  cases: CompanyCase[];
  partners?: PartnerOpt[];
  entityServices?: EntityService[];
  catalog?: Pick<ServiceType, "id" | "code" | "name" | "applies_to" | "tracks_expiry" | "is_ongoing" | "schedule_kind">[];
  handledServiceIds?: string[];
}) {
  const { t } = useT();
  const confirm = useConfirm();
  const roleLabel = (code: string) => roles.find((r) => r.code === code)?.label_en ?? code;
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [flash, setFlash] = useState<string | null>(null);

  return (
    <div>
      {/* Actions bar */}
      <div className="flex items-center justify-end gap-2 mb-4">
        {!company.deleted_at ? (
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
            <button
              type="button"
              disabled={pending}
              onClick={async () => {
                const ok = await confirm({
                  title: t("action.archive"),
                  message: t("detail.confirm_archive_company", { name: company.name }),
                  confirmLabel: t("action.archive"),
                  tone: "danger",
                });
                if (!ok) return;
                const fd = new FormData(); fd.set("id", company.id);
                start(async () => {
                  try { await softDeleteCompanyAction(fd); }
                  catch (e) { setFlash(e instanceof Error ? e.message : "Failed"); }
                });
              }}
              className="inline-flex items-center gap-1.5 text-[var(--muted)] hover:text-red-700 hover:bg-red-50 text-[12.5px] font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {t("action.archive")}
            </button>
          </>
        ) : (
          <>
            <form
              action={(fd) => {
                start(async () => {
                  try { await restoreCompanyAction(fd); }
                  catch (e) { setFlash(e instanceof Error ? e.message : "Failed"); }
                });
              }}
            >
              <input type="hidden" name="id" value={company.id} />
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center gap-1.5 bg-brand hover:bg-brand-dark text-white text-[12.5px] font-medium px-3 py-1.5 rounded-lg disabled:opacity-50"
              >
                {t("action.restore")}
              </button>
            </form>
            <button
              type="button"
              disabled={pending}
              onClick={async () => {
                const ok = await confirm({
                  title: "Delete permanently",
                  message: `"${company.name}" will be removed from the system for good. This can't be undone.`,
                  confirmLabel: "Delete permanently",
                  tone: "danger",
                });
                if (!ok) return;
                const fd = new FormData(); fd.set("id", company.id);
                start(async () => {
                  try { await hardDeleteCompanyAction(fd); }
                  catch (e) { setFlash(e instanceof Error ? e.message : "Failed"); }
                });
              }}
              className="inline-flex items-center gap-1.5 text-red-700 hover:bg-red-50 text-[12.5px] font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              Delete permanently
            </button>
          </>
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
            <FieldRow label={t("field.nib")} value={company.nib ? <span className="font-mono text-[13px]">{company.nib}</span> : null} />
            <FieldRow label={t("field.incorporation_date")} value={fmtDate(company.incorporation_date)} />
            <FieldRow
              label={t("field.introduced_by")}
              value={company.introduced_by ? (
                <Link href={`/partners/${company.introduced_by.id}`} className="text-brand hover:text-brand-dark font-medium">
                  {company.introduced_by.name}
                  <span className="ml-2 font-mono text-[10.5px] text-brand-dark bg-brand-softer px-1.5 py-0.5 rounded">
                    {company.introduced_by.code}
                  </span>
                </Link>
              ) : null}
            />
          </Card>

          <Card title={t("section.address")}>
            <div className="py-1 text-[13.5px] text-ink whitespace-pre-wrap">
              {company.address || <span className="text-[var(--hint)]">—</span>}
            </div>
          </Card>


          {company.notes && (
            <Card title={t("section.notes")}>
              <p className="text-[13.5px] whitespace-pre-wrap text-ink leading-relaxed py-1">
                {company.notes}
              </p>
            </Card>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-5">
          <Card title={t("section.linked_clients")} count={linkedClients.length} padded>
            <ClientsLinker
              companyId={company.id}
              linkedClients={linkedClients}
              allClients={allClients}
              roles={roles}
              roleLabel={roleLabel}
            />
          </Card>

          <EntityServicesCard
            owner={{ kind: "company", id: company.id }}
            services={entityServices}
            catalog={catalog}
            partners={partners}
            handledServiceIds={handledServiceIds}
          />

          <Card
            title={t("section.cases")}
            count={cases.length}
            padded
            action={
              <Link
                href={`/cases/new?company_id=${company.id}`}
                className="text-[12px] font-medium text-brand hover:text-brand-dark"
              >
                {t("detail.new_case")}
              </Link>
            }
          >
            <CompanyCasesList cases={cases} t={t} />
          </Card>
        </div>
      </div>

      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title={t("detail.edit_company_title")}
        subtitle={company.code}
        size="xl"
      >
        <CompanyForm
          mode="edit"
          company={company}
          partners={partners}
          action={async (fd) => { await updateCompanyAction(fd); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      </Modal>
    </div>
  );
}

/* ============ Cases attached to this company ============ */
// Active cases (New → In progress → Done) sort ahead of Delivered, each group
// by deadline ascending. Delivered is hidden behind a toggle so a company's
// old month-by-month cases don't drown out the current ones.
const STATUS_ORDER: Record<CaseStatus, number> = { new: 0, in_progress: 1, done: 2, delivered: 3 };
function sortCases<T extends { status: CaseStatus; deadline: string | null; updated_at: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const s = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (s !== 0) return s;
    if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return b.updated_at.localeCompare(a.updated_at);
  });
}

type Tr = (k: MessageKey, vars?: Record<string, string | number>) => string;

function CompanyCasesList({ cases, t }: { cases: CompanyCase[]; t: Tr }) {
  const [showDelivered, setShowDelivered] = useState(false);

  if (cases.length === 0) {
    return (
      <p className="text-[12.5px] text-[var(--muted)]">
        {t("detail.no_company_cases")}
      </p>
    );
  }

  const active = sortCases(cases.filter((c) => c.status !== "delivered"));
  const delivered = sortCases(cases.filter((c) => c.status === "delivered"));
  const visible = showDelivered ? [...active, ...delivered] : active;

  return (
    <>
      <CaseRows rows={visible} t={t} />
      {delivered.length > 0 && (
        <button
          type="button"
          onClick={() => setShowDelivered((v) => !v)}
          className="mt-2 text-[11.5px] text-[var(--muted)] hover:text-ink"
        >
          {showDelivered ? t("detail.hide_completed", { n: delivered.length }) : t("detail.show_completed", { n: delivered.length })}
        </button>
      )}
      {active.length === 0 && !showDelivered && (
        <p className="text-[12.5px] text-[var(--muted)] mt-1">{t("detail.no_active_cases")}</p>
      )}
    </>
  );
}

function CaseRows({ rows, t }: { rows: CompanyCase[]; t: Tr }) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <ul className="divide-y divide-[var(--border)] -mx-1">
      {rows.map((c) => {
        const p = STATUS_PILL[c.status];
        const overdue = c.deadline && c.deadline < today && c.status !== "delivered";
        return (
          <li key={c.id} className="px-1 py-2.5">
            <Link href={`/cases/${c.id}`} className="grid grid-cols-[auto_1fr_auto] gap-3 items-center group">
              <span className="font-mono text-[11px] text-brand-dark bg-brand-softer px-1.5 py-0.5 rounded">
                {c.code}
              </span>
              <div className="min-w-0">
                <div className="text-[13.5px] text-ink font-medium truncate group-hover:text-brand-dark flex items-center gap-1.5">
                  <span className="truncate">{c.title || (c.service ? serviceLabel(c.service) : t("detail.case_word"))}</span>
                  {(c.service?.schedule_kind === "annual_fixed" || c.service?.schedule_kind === "quarterly_fixed") && (
                    <span className="text-[9.5px] font-medium text-[#5B21B6] bg-[#EDE9FE] px-1 py-0 rounded shrink-0">
                      {c.service.schedule_kind === "annual_fixed" ? "annual" : "quarterly"}
                    </span>
                  )}
                </div>
                <div className="text-[11.5px] text-[var(--muted)] truncate">
                  {c.service ? serviceLabel(c.service) : "—"}
                  {c.client && <> · {c.client.full_name}</>}
                  {c.priority !== "normal" && (
                    <> · <span className="uppercase tracking-wide text-[10px] font-semibold">{t(`priority.${c.priority}` as MessageKey)}</span></>
                  )}
                </div>
              </div>
              <span className={`inline-flex items-center gap-1.5 text-[10.5px] font-medium px-2 py-0.5 rounded-full shrink-0 ${p.bg} ${p.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
                {t(`status.${c.status}` as MessageKey)}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/* ============ Clients linker (inside a card) ============ */
function ClientsLinker({
  companyId, linkedClients, allClients, roles, roleLabel,
}: {
  companyId: string;
  linkedClients: LinkedClient[];
  allClients: ClientOption[];
  roles: Role[];
  roleLabel: (code: string) => string;
}) {
  const { t } = useT();
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();

  return (
    <div>
      <div className="flex items-center justify-end mb-2 -mt-1">
        {!adding && (
          <button
            onClick={() => { setAdding(true); setError(null); }}
            className="text-[12px] font-medium text-brand hover:text-brand-dark"
          >
            {t("detail.link_client")}
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
          <input type="hidden" name="company_id" value={companyId} />
          <div className="flex-1 min-w-0">
            <label className="text-[10.5px] uppercase tracking-wider text-[var(--muted)] font-semibold">{t("field.client")}</label>
            <select name="client_id" required className={cellInputMuted}>
              <option value="">{t("detail.select_client")}</option>
              {allClients.map((c) => (
                <option key={c.id} value={c.id}>{c.full_name} ({c.code})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10.5px] uppercase tracking-wider text-[var(--muted)] font-semibold">{t("detail.role")}</label>
            <select name="role" defaultValue={roles[0]?.code ?? ""} className={cellInputMuted}>
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

      {linkedClients.length === 0 && !adding ? (
        <p className="text-[12.5px] text-[var(--muted)]">{t("detail.no_linked_clients")}</p>
      ) : (
        <ul className="divide-y divide-[var(--border)] -mx-1">
          {linkedClients.map((l, i) => (
            <li key={i} className="px-1 py-2.5 grid grid-cols-[88px_1fr_auto_auto] gap-3 items-center text-[13.5px]">
              <span className="font-mono text-[11px] text-brand-dark bg-brand-softer px-1.5 py-0.5 rounded justify-self-start">
                {l.client?.code ?? "—"}
              </span>
              <span className="text-ink font-medium truncate">
                {l.client ? (
                  <Link href={`/clients/${l.client.id}`} className="hover:text-brand">{l.client.full_name}</Link>
                ) : (
                  <span className="text-[var(--muted)] italic">{t("common.deleted_client")}</span>
                )}
              </span>
              <span className="text-[11.5px] text-[var(--muted)] uppercase tracking-wider">{roleLabel(l.role)}</span>
              <button
                type="button"
                onClick={async () => {
                  const ok = await confirm({
                    title: t("detail.unlink"),
                    message: t("detail.confirm_unlink"),
                    confirmLabel: t("detail.unlink"),
                    tone: "danger",
                  });
                  if (!ok) return;
                  const fd = new FormData();
                  fd.set("client_id", l.client?.id ?? "");
                  fd.set("company_id", companyId);
                  fd.set("role", l.role);
                  start(async () => {
                    try { await unlinkClientFromCompanyAction(fd); }
                    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
                  });
                }}
                className="text-[11.5px] text-[var(--muted)] hover:text-red-700"
              >
                {t("detail.unlink")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ============ Shared building blocks ============ */
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

function fmtDate(v: string | null | undefined): string {
  if (!v) return "—";
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

const cellInputMuted =
  "w-full mt-1 px-2.5 py-1.5 bg-white border border-[var(--border)] rounded-lg text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";
