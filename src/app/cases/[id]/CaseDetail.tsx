"use client";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import type { CaseStatus } from "@/lib/types";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";
import type { CaseRecord, UpdateRow } from "./page";
import { serviceLabel } from "@/lib/service";
import { CaseForm } from "../CaseForm";
import type { CaseFormDefaults } from "../CaseForm";
import { Modal } from "@/components/ui/Modal";
import { FormationDeliverModal } from "./FormationDeliverModal";
import {
  updateCaseMetaAction,
  addCaseUpdateAction,
  setCaseStatusAction,
  deliverCaseAction,
  reopenCaseAction,
  softDeleteCaseAction,
  restoreCaseAction,
  clearCaseExpiryAction,
} from "../actions";
import { useConfirm } from "@/components/ui/ConfirmProvider";

type Option = { id: string; label: string; hint?: string; appliesTo?: "person" | "company" | "either" };

/** Pipeline order. `delivered` is hidden for staff; Owner/Ops Lead see it as
 *  the final pill. */
const PIPELINE: CaseStatus[] = ["new", "in_progress", "done", "delivered"];

const STATUS_PILL: Record<CaseStatus, { activeBg: string; activeText: string; idleDot: string; idleText: string }> = {
  new:         { activeBg: "bg-yellow-100",  activeText: "text-yellow-800",  idleDot: "bg-yellow-500",  idleText: "text-yellow-800" },
  in_progress: { activeBg: "bg-blue-100",    activeText: "text-blue-800",    idleDot: "bg-blue-500",    idleText: "text-blue-800" },
  done:        { activeBg: "bg-green-100",   activeText: "text-green-800",   idleDot: "bg-green-500",   idleText: "text-green-800" },
  delivered:   { activeBg: "bg-neutral-200", activeText: "text-neutral-800", idleDot: "bg-neutral-400", idleText: "text-neutral-700" },
};

export function CaseDetail({
  caseRow,
  client,
  company,
  service,
  assignee,
  updates,
  canDeliver,
  clientOptions,
  companyOptions,
  serviceOptions,
  userOptions,
  hasDeliverableByService,
}: {
  caseRow: CaseRecord;
  client: { id: string; code: string; full_name: string; phone: string | null; email: string | null; preferred_channel: "whatsapp" | "email" } | null;
  company: { id: string; code: string; name: string } | null;
  service: { id: string; code: string; name: string; has_deliverable: boolean } | null;
  assignee: { id: string; full_name: string } | null;
  updates: UpdateRow[];
  canDeliver: boolean;
  clientOptions: Option[];
  companyOptions: Option[];
  serviceOptions: Option[];
  userOptions: Option[];
  hasDeliverableByService: Record<string, boolean>;
}) {
  const { t } = useT();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [delivering, setDelivering] = useState(false);
  const [deliveringFormation, setDeliveringFormation] = useState(false);
  const [reopening, setReopening] = useState(false);

  const isCompanyFormation = !!service && /company formation/i.test(service.name);
  const [addingNote, setAddingNote] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [statusPending, startStatus] = useTransition();

  useEffect(() => {
    if (!toast) return;
    const h = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(h);
  }, [toast]);

  const editDefaults: CaseFormDefaults = {
    id: caseRow.id,
    client_id: caseRow.client_id,
    company_id: caseRow.company_id,
    service_type_id: caseRow.service_type_id,
    priority: caseRow.priority,
    assigned_to: caseRow.assigned_to,
    deadline: caseRow.deadline,
    title: caseRow.title,
    drive_folder_url: caseRow.drive_folder_url,
  };

  // Which pills to show. Staff never see delivered.
  const visiblePipeline = PIPELINE.filter((s) => {
    if (s === "delivered" && !canDeliver) return false;
    return true;
  });

  function tapStatus(next: CaseStatus) {
    if (statusPending) return;
    if (next === caseRow.status) return;

    // Reopening from delivered needs a reason — route through the modal.
    if (caseRow.status === "delivered" && next !== "delivered") {
      setReopening(true);
      return;
    }
    // Company Formation gets a dedicated delivery flow — the modal handles
    // the (optional) company register + VO subscription toggles.
    if (next === "delivered" && caseRow.status !== "delivered" && isCompanyFormation) {
      setDeliveringFormation(true);
      return;
    }
    startStatus(async () => {
      const fd = new FormData();
      fd.set("case_id", caseRow.id);
      try {
        if (next === "delivered" && caseRow.status !== "delivered") {
          await deliverCaseAction(fd);
          setToast(t("case.detail.deliver.marked"));
        } else {
          fd.set("status", next);
          await setCaseStatusAction(fd);
          setToast(t("case.detail.status.moved", { label: t(`status.${next}` as MessageKey) }));
        }
      } catch (e) {
        setToast(e instanceof Error ? e.message : t("case.detail.status.failed"));
      }
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 max-w-5xl">
      <div>
        {/* Status pill row — the primary interaction of this whole page */}
        <div className="mb-5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {visiblePipeline.map((s) => {
              const isCurrent = caseRow.status === s;
              const p = STATUS_PILL[s];
              return (
                <button
                  key={s}
                  onClick={() => tapStatus(s)}
                  disabled={statusPending}
                  className={`inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-full transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    isCurrent
                      ? `${p.activeBg} ${p.activeText} ring-1 ring-inset ring-black/5`
                      : `bg-transparent ${p.idleText} hover:bg-white/60 border border-[var(--border)]`
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isCurrent ? p.idleDot : "bg-current opacity-50"}`} />
                  {t(`status.${s}` as MessageKey)}
                </button>
              );
            })}
          </div>
          <p className="text-[11.5px] text-[var(--muted)] mt-2">
            {t("case.detail.tap_hint")}
          </p>
        </div>

        {/* Optional note button */}
        <div className="mb-6">
          {addingNote ? (
            <AddNoteForm
              caseId={caseRow.id}
              onDone={(msg) => { setAddingNote(false); if (msg) setToast(msg); }}
              onCancel={() => setAddingNote(false)}
            />
          ) : (
            <button
              onClick={() => setAddingNote(true)}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--muted)] hover:text-ink px-2.5 py-1.5 rounded-md hover:bg-white/60"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              {t("case.detail.add_note")}
            </button>
          )}
        </div>

        {/* Timeline */}
        <div>
          <div className="text-[11px] uppercase tracking-widest text-[var(--muted)] font-semibold mb-3">
            {t("case.detail.timeline_n", { n: updates.length })}
          </div>
          {updates.length === 0 ? (
            <p className="text-[13px] text-[var(--muted)]">{t("case.detail.no_updates")}</p>
          ) : (
            <ul className="space-y-4">
              {updates.map((u) => <TimelineItem key={u.id} update={u} t={t} />)}
            </ul>
          )}
        </div>
      </div>

      <aside className="space-y-4">
        <div className="flex items-center justify-end gap-2">
          {client?.phone && (
            <a
              href={`https://wa.me/${client.phone.replace(/[^\d]/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-[#075E54] hover:bg-[#054841] text-white text-[12.5px] font-medium px-3 py-1.5 rounded-lg shadow-sm transition-colors"
              title={t("case.action.whatsapp_client")}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              WhatsApp
            </a>
          )}
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 bg-surface hover:bg-[var(--surface-deep)] text-ink text-[12.5px] font-medium px-3 py-1.5 rounded-lg shadow-sm border border-[var(--border)] transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4z" />
            </svg>
            {t("action.edit")}
          </button>
          {caseRow.deleted_at ? (
            <form action={restoreCaseAction} className="inline">
              <input type="hidden" name="id" value={caseRow.id} />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 bg-brand hover:bg-brand-dark text-white text-[12.5px] font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                {t("action.restore")}
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={async () => {
                const ok = await confirm({
                  title: t("action.archive"),
                  message: t("case.detail.confirm_archive"),
                  confirmLabel: t("action.archive"),
                  tone: "danger",
                });
                if (!ok) return;
                const fd = new FormData(); fd.set("id", caseRow.id);
                await softDeleteCaseAction(fd);
              }}
              className="inline-flex items-center gap-1.5 text-[var(--muted)] hover:text-red-700 hover:bg-red-50 text-[12.5px] font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              {t("action.archive")}
            </button>
          )}
        </div>

        <Card title={t("case.detail.details_card")}>
          <MetaRow label={t("meta.client")} value={
            client ? <Link href={`/clients/${client.id}`} className="text-brand hover:text-brand-dark font-medium">{client.full_name}</Link> : null
          } />
          <MetaRow label={t("meta.company")} value={
            company ? <Link href={`/companies/${company.id}`} className="text-brand hover:text-brand-dark font-medium">{company.name}</Link> : null
          } />
          <MetaRow label={t("meta.service")} value={service ? serviceLabel(service) : null} />
          <MetaRow label={t("meta.assignee")} value={assignee?.full_name} />
          <MetaRow label={t("meta.priority")} value={t(`priority.${caseRow.priority}` as MessageKey)} />
          <MetaRow label={t("meta.expires")} value={
            caseRow.expires_at ? (
              <span className="inline-flex items-center gap-2">
                {fmtDate(caseRow.expires_at)}
                {caseRow.status !== "delivered" && (
                  <form action={clearCaseExpiryAction}>
                    <input type="hidden" name="case_id" value={caseRow.id} />
                    <button
                      type="submit"
                      className="text-[11px] text-[var(--muted)] hover:text-ink underline"
                      title="Clear this expiry"
                    >
                      clear
                    </button>
                  </form>
                )}
              </span>
            ) : null
          } />
        </Card>
        <div className="text-[11px] text-[var(--muted)] px-1">{t("case.detail.created_at", { date: fmtDate(caseRow.created_at) ?? "" })}</div>
      </aside>

      {delivering && client && service && (
        <DeliverModal
          caseId={caseRow.id}
          client={client}
          service={service}
          onClose={() => setDelivering(false)}
          onDelivered={() => { setDelivering(false); setToast(t("case.detail.deliver.marked")); }}
        />
      )}

      {reopening && (
        <ReopenModal
          caseId={caseRow.id}
          onClose={() => setReopening(false)}
          onDone={() => { setReopening(false); setToast(t("case.detail.reopen.done")); }}
        />
      )}

      <FormationDeliverModal
        open={deliveringFormation}
        onClose={() => setDeliveringFormation(false)}
        caseId={caseRow.id}
        defaultCompanyName={caseRow.title ?? ""}
        onDone={() => { setDeliveringFormation(false); setToast(t("case.detail.deliver.marked")); }}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-ink text-white text-[13px] px-4 py-2 rounded-full shadow-lg z-50">
          {toast}
        </div>
      )}

      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title={t("case.detail.edit_title")}
        subtitle={caseRow.code}
        size="xl"
      >
        <CaseForm
          mode="edit"
          defaults={editDefaults}
          clients={clientOptions}
          companies={companyOptions}
          services={serviceOptions}
          users={userOptions}
          hasDeliverableByService={hasDeliverableByService}
          action={async (fd) => { await updateCaseMetaAction(fd); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      </Modal>
    </div>
  );
}

function AddNoteForm({
  caseId, onDone, onCancel,
}: {
  caseId: string;
  onDone: (toast: string | null) => void;
  onCancel: () => void;
}) {
  const { t } = useT();
  const [pending, start] = useTransition();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      action={(fd) => {
        setError(null);
        start(async () => {
          try {
            await addCaseUpdateAction(fd);
            setText("");
            onDone(t("case.detail.note.added"));
          } catch (e) {
            setError(e instanceof Error ? e.message : "Failed");
            onDone(null);
          }
        });
      }}
      className="border border-[var(--border)] rounded-lg bg-white p-3"
    >
      <input type="hidden" name="case_id" value={caseId} />
      <textarea
        name="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        required
        rows={2}
        autoFocus
        placeholder={t("case.detail.note.placeholder")}
        className="w-full px-2 py-1.5 text-[13.5px] bg-transparent border-0 focus:outline-none resize-none placeholder:text-[var(--muted)]"
      />
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
        <button type="button" onClick={onCancel} className="px-2.5 py-1 text-[12.5px] text-[var(--muted)] hover:text-ink">
          {t("action.cancel")}
        </button>
        <button type="submit" disabled={pending || !text.trim()} className="px-3 py-1.5 text-[12.5px] font-medium bg-ink text-white rounded-md hover:opacity-90 disabled:opacity-40">
          {pending ? t("case.detail.note.posting") : t("case.detail.note.add")}
        </button>
      </div>
      {error && <div className="mt-2 text-[12px] text-red-700">{error}</div>}
    </form>
  );
}

type Tr = (k: MessageKey, vars?: Record<string, string | number>) => string;

function TimelineItem({ update, t }: { update: UpdateRow; t: Tr }) {
  const isStatusOnly = !update.text && update.status_before && update.status_after;
  return (
    <li className="flex gap-3">
      <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${isStatusOnly ? "bg-brand-softer border border-brand" : "bg-brand"}`} />
      <div className="flex-1 min-w-0">
        {update.text && (
          <div className="text-[13.5px] text-ink whitespace-pre-wrap">{update.text}</div>
        )}
        {update.status_before && update.status_after && (
          <div className={`${update.text ? "mt-1" : ""} flex items-center gap-1.5 text-[11.5px]`}>
            <StatusChip s={update.status_before} t={t} />
            <span className="text-[var(--muted)]">→</span>
            <StatusChip s={update.status_after} t={t} />
          </div>
        )}
        <div className="mt-1 text-[11.5px] text-[var(--muted)]">
          {update.author?.full_name ?? t("case.detail.unknown_author")} · {fmtDateTime(update.created_at)}
        </div>
      </div>
    </li>
  );
}

function StatusChip({ s, t }: { s: CaseStatus; t: Tr }) {
  const p = STATUS_PILL[s];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${p.activeBg} ${p.activeText}`}>
      <span className={`w-1 h-1 rounded-full ${p.idleDot}`} />
      {t(`status.${s}` as MessageKey)}
    </span>
  );
}

function DeliverModal({
  caseId, client, service, onClose, onDelivered,
}: {
  caseId: string;
  client: { full_name: string; phone: string | null; email: string | null; preferred_channel: "whatsapp" | "email" };
  service: { name: string };
  onClose: () => void;
  onDelivered: () => void;
}) {
  const { t } = useT();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const template = t("deliver.template_fallback", { name: client.full_name, service: service.name });
  const [message, setMessage] = useState(template);

  const waHref = client.phone
    ? `https://wa.me/${client.phone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(message)}`
    : null;
  const mailtoHref = client.email
    ? `mailto:${client.email}?subject=${encodeURIComponent(t("deliver.subject_ready", { service: service.name }))}&body=${encodeURIComponent(message)}`
    : null;

  const channelLabel = client.preferred_channel === "whatsapp" ? t("channel.whatsapp") : t("channel.email");

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="text-[10.5px] uppercase tracking-widest text-[var(--muted)] font-semibold mb-1">{t("deliver.deliver_to")}</div>
        <div className="text-[18px] font-semibold text-ink">{client.full_name}</div>
        <div className="text-[12.5px] text-[var(--muted)] mb-4">
          {t("deliver.preferred")} <span>{channelLabel}</span>
          {client.phone && <span> · {client.phone}</span>}
          {client.email && <span> · {client.email}</span>}
        </div>

        <label className="text-[11px] uppercase tracking-wide font-medium text-[var(--muted)]">{t("deliver.message")}</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          className="w-full mt-1 px-3 py-2 text-[13.5px] border border-[var(--border)] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
        />

        <div className="flex flex-wrap gap-2 mt-4">
          <a href={waHref ?? undefined} target="_blank" rel="noopener noreferrer"
            className={`px-3 py-1.5 text-[13px] font-medium rounded-md ${waHref ? "bg-green-600 text-white hover:opacity-90" : "bg-neutral-100 text-neutral-400 pointer-events-none"}`}>
            {t("deliver.wa")}
          </a>
          <a href={mailtoHref ?? undefined}
            className={`px-3 py-1.5 text-[13px] font-medium rounded-md ${mailtoHref ? "bg-blue-600 text-white hover:opacity-90" : "bg-neutral-100 text-neutral-400 pointer-events-none"}`}>
            {t("deliver.email")}
          </a>
        </div>

        {error && <div className="mt-3 text-[12.5px] text-red-700">{error}</div>}

        <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-[var(--border)]">
          <button onClick={onClose} className="px-3 py-1.5 text-[13px] text-[var(--muted)] hover:text-ink">
            {t("action.cancel")}
          </button>
          <form
            action={(fd) => {
              setError(null);
              start(async () => {
                try { await deliverCaseAction(fd); onDelivered(); }
                catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
              });
            }}
          >
            <input type="hidden" name="case_id" value={caseId} />
            <button type="submit" disabled={pending} className="px-3.5 py-1.5 text-[13px] font-semibold bg-ink text-white rounded-md hover:opacity-90 disabled:opacity-50">
              {pending ? t("deliver.marking") : t("deliver.mark_delivered")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function ReopenModal({ caseId, onClose, onDone }: { caseId: string; onClose: () => void; onDone: () => void }) {
  const { t } = useT();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="text-[16px] font-semibold text-ink mb-1">{t("reopen.title")}</div>
        <p className="text-[12.5px] text-[var(--muted)] mb-4">
          {t("reopen.blurb")}
        </p>

        <form
          action={(fd) => {
            setError(null);
            start(async () => {
              try { await reopenCaseAction(fd); onDone(); }
              catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
            });
          }}
        >
          <input type="hidden" name="case_id" value={caseId} />
          <label className="text-[11px] uppercase tracking-wide font-medium text-[var(--muted)]">{t("reopen.reason")}</label>
          <textarea
            name="reason"
            required
            rows={3}
            placeholder={t("reopen.reason_placeholder")}
            className="w-full mt-1 px-3 py-2 text-[13.5px] border border-[var(--border)] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
          />
          {error && <div className="mt-2 text-[12.5px] text-red-700">{error}</div>}
          <div className="flex items-center justify-end gap-2 mt-4">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-[13px] text-[var(--muted)] hover:text-ink">
              {t("action.cancel")}
            </button>
            <button type="submit" disabled={pending} className="px-3.5 py-1.5 text-[13px] font-semibold bg-ink text-white rounded-md hover:opacity-90 disabled:opacity-50">
              {pending ? t("reopen.reopening") : t("reopen.reopen_case")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Warm-shadow card matching the list-page design system. */
function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="bg-surface rounded-2xl shadow-[0_1px_3px_rgba(15,31,29,0.06),0_8px_24px_-6px_rgba(15,31,29,0.10)] p-5">
      {title && (
        <div className="flex items-baseline gap-2 mb-2">
          <h2 className="font-serif text-[15px] text-ink leading-none">{title}</h2>
        </div>
      )}
      <div className="-mb-1">{children}</div>
    </section>
  );
}

/** Only renders when value is non-empty. Keeps the sidebar clean of dashes. */
function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  const empty = value == null || value === "";
  if (empty) return null;
  return (
    <div className="grid grid-cols-[100px_1fr] gap-3 py-2 items-center border-t border-[var(--border)] first:border-t-0">
      <div className="text-[11.5px] text-[var(--muted)] font-medium">{label}</div>
      <div className="text-[13.5px] text-ink">{value}</div>
    </div>
  );
}

function fmtDate(v: string | null | undefined): string | null {
  if (!v) return null;
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

function fmtDateTime(v: string): string {
  try {
    const d = new Date(v);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mn = String(d.getMinutes()).padStart(2, "0");
    return `${dd}/${mm}/${d.getFullYear()} ${hh}:${mn}`;
  } catch {
    return v;
  }
}
