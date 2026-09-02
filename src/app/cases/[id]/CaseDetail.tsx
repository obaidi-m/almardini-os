"use client";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import type { CaseStatus } from "@/lib/types";
import { CASE_STATUS_LABELS, CASE_PRIORITY_LABELS } from "@/lib/types";
import type { CaseRecord, UpdateRow } from "./page";
import { CaseForm } from "../CaseForm";
import type { CaseFormDefaults } from "../CaseForm";
import { Modal } from "@/components/ui/Modal";
import {
  updateCaseMetaAction,
  addCaseUpdateAction,
  setCaseStatusAction,
  deliverCaseAction,
  reopenCaseAction,
  softDeleteCaseAction,
} from "../actions";

type Option = { id: string; label: string; hint?: string };

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
  service: { id: string; name: string; has_deliverable: boolean; delivery_template_en: string | null; delivery_template_id: string | null } | null;
  assignee: { id: string; full_name: string } | null;
  updates: UpdateRow[];
  canDeliver: boolean;
  clientOptions: Option[];
  companyOptions: Option[];
  serviceOptions: Option[];
  userOptions: Option[];
  hasDeliverableByService: Record<string, boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [delivering, setDelivering] = useState(false);
  const [reopening, setReopening] = useState(false);
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
    // Delivering opens the WhatsApp/email flow when there's a client.
    if (next === "delivered" && caseRow.status !== "delivered" && client) {
      setDelivering(true);
      return;
    }

    startStatus(async () => {
      const fd = new FormData();
      fd.set("case_id", caseRow.id);
      fd.set("status", next);
      try {
        await setCaseStatusAction(fd);
        setToast(`Moved to ${CASE_STATUS_LABELS[next]}`);
      } catch (e) {
        setToast(e instanceof Error ? e.message : "Failed to update status");
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
                  {CASE_STATUS_LABELS[s]}
                </button>
              );
            })}
          </div>
          <p className="text-[11.5px] text-[var(--muted)] mt-2">
            Tap any status to move the case there — nothing else required.
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
              Add a note
            </button>
          )}
        </div>

        {/* Timeline */}
        <div>
          <div className="text-[11px] uppercase tracking-widest text-[var(--muted)] font-semibold mb-3">
            Timeline ({updates.length})
          </div>
          {updates.length === 0 ? (
            <p className="text-[13px] text-[var(--muted)]">Nothing recorded yet. Tap a status pill or add a note.</p>
          ) : (
            <ul className="space-y-4">
              {updates.map((u) => <TimelineItem key={u.id} update={u} />)}
            </ul>
          )}
        </div>
      </div>

      <aside className="space-y-4">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 bg-surface hover:bg-[var(--surface-deep)] text-ink text-[12.5px] font-medium px-3 py-1.5 rounded-lg shadow-sm border border-[var(--border)] transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4z" />
            </svg>
            Edit
          </button>
          <form action={softDeleteCaseAction} onSubmit={(e) => { if (!confirm("Archive this case?")) e.preventDefault(); }} className="inline">
            <input type="hidden" name="id" value={caseRow.id} />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 text-[var(--muted)] hover:text-red-700 hover:bg-red-50 text-[12.5px] font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              Archive
            </button>
          </form>
        </div>

        <Card title="Details">
          <MetaRow label="Client" value={
            client ? <Link href={`/clients/${client.id}`} className="text-brand hover:text-brand-dark font-medium">{client.full_name}</Link> : null
          } />
          <MetaRow label="Company" value={
            company ? <Link href={`/companies/${company.id}`} className="text-brand hover:text-brand-dark font-medium">{company.name}</Link> : null
          } />
          <MetaRow label="Service" value={service?.name} />
          <MetaRow label="Assignee" value={assignee?.full_name} />
          <MetaRow label="Priority" value={CASE_PRIORITY_LABELS[caseRow.priority]} />
          <MetaRow label="Deadline" value={fmtDate(caseRow.deadline)} />
          <MetaRow label="Expires" value={fmtDate(caseRow.expires_at)} />
          <MetaRow label="OneDrive" value={caseRow.drive_folder_url ? (
            <a href={caseRow.drive_folder_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-brand hover:text-brand-dark font-medium">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 8a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /></svg>
              Open folder
            </a>
          ) : null} />
        </Card>
        <div className="text-[11px] text-[var(--muted)] px-1">Created {fmtDate(caseRow.created_at)}</div>
      </aside>

      {delivering && client && service && (
        <DeliverModal
          caseId={caseRow.id}
          client={client}
          service={service}
          onClose={() => setDelivering(false)}
          onDelivered={() => { setDelivering(false); setToast("Marked as Delivered"); }}
        />
      )}

      {reopening && (
        <ReopenModal
          caseId={caseRow.id}
          onClose={() => setReopening(false)}
          onDone={() => { setReopening(false); setToast("Reopened to In progress"); }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-ink text-white text-[13px] px-4 py-2 rounded-full shadow-lg z-50">
          {toast}
        </div>
      )}

      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title="Edit case"
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
            onDone("Note added");
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
        placeholder="What just happened? One sentence."
        className="w-full px-2 py-1.5 text-[13.5px] bg-transparent border-0 focus:outline-none resize-none placeholder:text-[var(--muted)]"
      />
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
        <button type="button" onClick={onCancel} className="px-2.5 py-1 text-[12.5px] text-[var(--muted)] hover:text-ink">
          Cancel
        </button>
        <button type="submit" disabled={pending || !text.trim()} className="px-3 py-1.5 text-[12.5px] font-medium bg-ink text-white rounded-md hover:opacity-90 disabled:opacity-40">
          {pending ? "Posting…" : "Add note"}
        </button>
      </div>
      {error && <div className="mt-2 text-[12px] text-red-700">{error}</div>}
    </form>
  );
}

function TimelineItem({ update }: { update: UpdateRow }) {
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
            <StatusChip s={update.status_before} />
            <span className="text-[var(--muted)]">→</span>
            <StatusChip s={update.status_after} />
          </div>
        )}
        <div className="mt-1 text-[11.5px] text-[var(--muted)]">
          {update.author?.full_name ?? "Unknown"} · {fmtDateTime(update.created_at)}
        </div>
      </div>
    </li>
  );
}

function StatusChip({ s }: { s: CaseStatus }) {
  const p = STATUS_PILL[s];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${p.activeBg} ${p.activeText}`}>
      <span className={`w-1 h-1 rounded-full ${p.idleDot}`} />
      {CASE_STATUS_LABELS[s]}
    </span>
  );
}

function DeliverModal({
  caseId, client, service, onClose, onDelivered,
}: {
  caseId: string;
  client: { full_name: string; phone: string | null; email: string | null; preferred_channel: "whatsapp" | "email" };
  service: { name: string; delivery_template_en: string | null; delivery_template_id: string | null };
  onClose: () => void;
  onDelivered: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const rawTemplate = service.delivery_template_en?.trim() || service.delivery_template_id?.trim() || `Hi {{client_name}}, your {{service}} is ready.`;
  const template = rawTemplate
    .replace(/\{\{\s*client_name\s*\}\}/gi, client.full_name)
    .replace(/\{\{\s*service\s*\}\}/gi, service.name);
  const [message, setMessage] = useState(template);

  const waHref = client.phone
    ? `https://wa.me/${client.phone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(message)}`
    : null;
  const mailtoHref = client.email
    ? `mailto:${client.email}?subject=${encodeURIComponent(`Your ${service.name} is ready`)}&body=${encodeURIComponent(message)}`
    : null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="text-[10.5px] uppercase tracking-widest text-[var(--muted)] font-semibold mb-1">Deliver to</div>
        <div className="text-[18px] font-semibold text-ink">{client.full_name}</div>
        <div className="text-[12.5px] text-[var(--muted)] mb-4">
          Preferred: <span className="capitalize">{client.preferred_channel}</span>
          {client.phone && <span> · {client.phone}</span>}
          {client.email && <span> · {client.email}</span>}
        </div>

        <label className="text-[11px] uppercase tracking-wide font-medium text-[var(--muted)]">Message</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          className="w-full mt-1 px-3 py-2 text-[13.5px] border border-[var(--border)] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
        />

        <div className="flex flex-wrap gap-2 mt-4">
          <a href={waHref ?? undefined} target="_blank" rel="noopener noreferrer"
            className={`px-3 py-1.5 text-[13px] font-medium rounded-md ${waHref ? "bg-green-600 text-white hover:opacity-90" : "bg-neutral-100 text-neutral-400 pointer-events-none"}`}>
            Open WhatsApp
          </a>
          <a href={mailtoHref ?? undefined}
            className={`px-3 py-1.5 text-[13px] font-medium rounded-md ${mailtoHref ? "bg-blue-600 text-white hover:opacity-90" : "bg-neutral-100 text-neutral-400 pointer-events-none"}`}>
            Open Email
          </a>
        </div>

        {error && <div className="mt-3 text-[12.5px] text-red-700">{error}</div>}

        <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-[var(--border)]">
          <button onClick={onClose} className="px-3 py-1.5 text-[13px] text-[var(--muted)] hover:text-ink">
            Cancel
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
              {pending ? "Marking…" : "Mark as Delivered"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function ReopenModal({ caseId, onClose, onDone }: { caseId: string; onClose: () => void; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="text-[16px] font-semibold text-ink mb-1">Reopen this case?</div>
        <p className="text-[12.5px] text-[var(--muted)] mb-4">
          The case moves back to In progress. A reason will be logged on the timeline.
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
          <label className="text-[11px] uppercase tracking-wide font-medium text-[var(--muted)]">Reason *</label>
          <textarea
            name="reason"
            required
            rows={3}
            placeholder="e.g. Client raised a follow-up question we hadn't addressed."
            className="w-full mt-1 px-3 py-2 text-[13.5px] border border-[var(--border)] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
          />
          {error && <div className="mt-2 text-[12.5px] text-red-700">{error}</div>}
          <div className="flex items-center justify-end gap-2 mt-4">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-[13px] text-[var(--muted)] hover:text-ink">
              Cancel
            </button>
            <button type="submit" disabled={pending} className="px-3.5 py-1.5 text-[13px] font-semibold bg-ink text-white rounded-md hover:opacity-90 disabled:opacity-50">
              {pending ? "Reopening…" : "Reopen case"}
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
