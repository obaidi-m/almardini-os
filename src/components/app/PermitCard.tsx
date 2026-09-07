"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { Permit, PermitStatus } from "@/lib/types";
import { COMMON_PERMIT_KINDS } from "@/lib/permits";
import { Modal } from "@/components/ui/Modal";
import { DateInput } from "@/components/ui/DateInput";
import { Combobox, type ComboOption } from "@/components/ui/Combobox";
import { Spinner } from "@/components/ui/Spinner";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import {
  createPermitAction,
  updatePermitAction,
  renewPermitAction,
  terminatePermitAction,
  archivePermitAction,
} from "@/app/permits/actions";

export type PermitCompanyOption = { id: string; code: string; name: string };
export type PermitPartnerOption = { id: string; code: string; name: string };
export type PermitClientOption = { id: string; code: string; full_name: string };

const STATUS_PILL: Record<PermitStatus, { bg: string; text: string; dot: string }> = {
  active:     { bg: "bg-[#DCFCE7]",           text: "text-[#166534]",       dot: "bg-[#22C55E]" },
  expired:    { bg: "bg-[#FEE2E2]",           text: "text-[#991B1B]",       dot: "bg-[#EF4444]" },
  terminated: { bg: "bg-[var(--surface-2)]",  text: "text-[var(--muted)]",  dot: "bg-[var(--muted)]" },
};

function fmtDate(v: string | null | undefined): string {
  if (!v) return "—";
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}
function daysUntil(iso: string): number {
  const d = new Date(iso + "T00:00:00");
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.floor((d.getTime() - t.getTime()) / 86_400_000);
}
function daysLabel(iso: string): { text: string; tone: string } {
  const n = daysUntil(iso);
  if (n < 0)   return { text: `${-n}d overdue`, tone: "text-red-700 font-semibold" };
  if (n === 0) return { text: "today",          tone: "text-red-700 font-semibold" };
  if (n <= 30) return { text: `in ${n}d`,       tone: "text-red-700 font-semibold" };
  if (n <= 90) return { text: `in ${n}d`,       tone: "text-amber-700 font-semibold" };
  return           { text: `in ${n}d`,          tone: "text-[var(--muted)]" };
}

export function PermitCard({
  clientId,
  permits,
  companies = [],
  partners = [],
}: {
  clientId: string;
  permits: Permit[];
  companies?: PermitCompanyOption[];
  partners?: PermitPartnerOption[];
}) {
  const [editing, setEditing] = useState<Permit | null>(null);
  const [creating, setCreating] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const active = permits.filter((p) => p.status === "active");
  const historic = permits.filter((p) => p.status !== "active");

  return (
    <div className="bg-white border border-[var(--border)] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-serif text-[15px] text-ink">Services</h3>
          {active.length > 0 && <span className="text-[11px] text-[var(--muted)]">{active.length} active</span>}
        </div>
        <button
          onClick={() => { setCreating(true); setFlash(null); }}
          className="text-[12px] font-medium text-brand hover:text-brand-dark"
        >
          + Add
        </button>
      </div>

      {flash && (
        <div className="mb-3 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
          {flash}
        </div>
      )}

      {permits.length === 0 && (
        <p className="text-[12.5px] text-[var(--muted)]">No permits on file for this person.</p>
      )}

      {active.length > 0 && (
        <ul className="divide-y divide-[var(--border)] -mx-1">
          {active.map((p) => (
            <PermitRow key={p.id} p={p} onEdit={() => setEditing(p)} onFlash={setFlash} start={start} pending={pending} />
          ))}
        </ul>
      )}

      {historic.length > 0 && (
        <details className="mt-3 group">
          <summary className="text-[11.5px] text-[var(--muted)] hover:text-ink cursor-pointer select-none">
            {historic.length} past {historic.length === 1 ? "permit" : "permits"}
          </summary>
          <ul className="divide-y divide-[var(--border)] -mx-1 mt-2">
            {historic.map((p) => (
              <PermitRow key={p.id} p={p} onEdit={() => setEditing(p)} onFlash={setFlash} start={start} pending={pending} historic />
            ))}
          </ul>
        </details>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Add permit" size="lg">
        <PermitForm
          mode="create"
          clientId={clientId}
          companies={companies}
          partners={partners}
          onDone={() => setCreating(false)}
          onError={setFlash}
        />
      </Modal>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Edit permit" size="lg">
        {editing && (
          <PermitForm
            mode="edit"
            clientId={clientId}
            companies={companies}
            partners={partners}
            existing={editing}
            onDone={() => setEditing(null)}
            onError={setFlash}
          />
        )}
      </Modal>
    </div>
  );
}

function PermitRow({
  p, onEdit, onFlash, start, pending, historic = false,
}: {
  p: Permit;
  onEdit: () => void;
  onFlash: (msg: string | null) => void;
  start: (cb: () => void) => void;
  pending: boolean;
  historic?: boolean;
}) {
  const confirm = useConfirm();
  const pill = STATUS_PILL[p.status];
  const days = p.status === "active" ? daysLabel(p.expires_date) : null;

  return (
    <li className="px-1 py-2.5">
      <div className="grid grid-cols-[1fr_auto] gap-3 items-start">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13.5px] text-ink font-medium">{p.kind}</span>
            {p.reference_no && (
              <span className="font-mono text-[11px] text-[var(--muted)]">{p.reference_no}</span>
            )}
            <span className={`inline-flex items-center gap-1 text-[10.5px] font-medium px-1.5 py-0.5 rounded-full ${pill.bg} ${pill.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${pill.dot}`} />
              {p.status}
            </span>
          </div>
          <div className="text-[11.5px] text-[var(--muted)] mt-0.5">
            {fmtDate(p.issued_date)} → {fmtDate(p.expires_date)}
            {days && <> · <span className={days.tone}>{days.text}</span></>}
          </div>
          {p.sponsor && (
            <div className="text-[11.5px] text-[var(--muted)] mt-0.5">
              Sponsor: <Link href={`/companies/${p.sponsor.id}`} className="text-ink hover:text-brand-dark font-medium">{p.sponsor.name}</Link>
            </div>
          )}
          {p.responsible && (
            <div className="text-[11.5px] text-[var(--muted)] mt-0.5">
              PJ: <Link href={`/partners/${p.responsible.id}`} className="text-ink hover:text-brand-dark font-medium">{p.responsible.name}</Link>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={onEdit} className="text-[11.5px] text-[var(--muted)] hover:text-ink underline">edit</button>
          {(p.status === "active" || p.status === "expired") && (
            <button
              type="button"
              disabled={pending}
              onClick={async () => {
                onFlash(null);
                const ok = await confirm({
                  title: "Renew permit",
                  message: p.status === "expired"
                    ? "Open a new permit starting today? Kind, sponsor and PJ carry over — edit the new row if anything changed."
                    : "Open a new permit for the next term? The current one will be marked expired.",
                  confirmLabel: "Renew",
                });
                if (!ok) return;
                const fd = new FormData();
                fd.set("id", p.id);
                fd.set("duration_months", "12");
                start(async () => {
                  try { await renewPermitAction(fd); }
                  catch (e) { onFlash(e instanceof Error ? e.message : "Failed"); }
                });
              }}
              className="text-[11.5px] font-medium text-brand hover:text-brand-dark disabled:opacity-50"
            >
              renew
            </button>
          )}
          {!historic && p.status === "active" && (
            <button
              type="button"
              disabled={pending}
              onClick={async () => {
                onFlash(null);
                const ok = await confirm({
                  title: "Terminate permit",
                  message: "This ends the permit early. The row stays in history but is no longer active.",
                  confirmLabel: "Terminate",
                  tone: "danger",
                });
                if (!ok) return;
                const fd = new FormData(); fd.set("id", p.id);
                start(async () => {
                  try { await terminatePermitAction(fd); }
                  catch (e) { onFlash(e instanceof Error ? e.message : "Failed"); }
                });
              }}
              className="text-[11.5px] text-red-700 hover:underline disabled:opacity-50"
            >
              terminate
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

export function PermitForm({
  mode, clientId, clients, companies = [], partners = [], existing, onDone, onError,
}: {
  mode: "create" | "edit";
  clientId?: string;
  clients?: PermitClientOption[];
  companies?: PermitCompanyOption[];
  partners?: PermitPartnerOption[];
  existing?: Permit;
  onDone: () => void;
  onError: (msg: string | null) => void;
}) {
  const [pending, start] = useTransition();
  const confirm = useConfirm();

  return (
    <form
      action={(fd) => {
        onError(null);
        start(async () => {
          try {
            if (mode === "create") await createPermitAction(fd);
            else                    await updatePermitAction(fd);
            onDone();
          } catch (e) {
            onError(e instanceof Error ? e.message : "Failed to save.");
          }
        });
      }}
      className="space-y-4"
    >
      {clientId && <input type="hidden" name="client_id" value={clientId} />}
      {existing && <input type="hidden" name="id" value={existing.id} />}

      {!clientId && clients && (
        <Field label="Client">
          <Combobox
            name="client_id"
            required
            options={clients.map<ComboOption>((c) => ({
              id: c.id, label: c.full_name, hint: c.code, keywords: c.code,
            }))}
            defaultValue={existing?.client_id ?? ""}
            placeholder="Select a client…"
          />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Kind">
          <input
            name="kind"
            required
            list="permit-kinds"
            defaultValue={existing?.kind ?? ""}
            placeholder="KITAS, IMTA, …"
            className="w-full px-2.5 py-1.5 border border-[var(--border)] rounded-md bg-white text-[13px]"
          />
          <datalist id="permit-kinds">
            {COMMON_PERMIT_KINDS.map((k) => <option key={k} value={k} />)}
          </datalist>
        </Field>
        <Field label="Reference no.">
          <input
            name="reference_no"
            defaultValue={existing?.reference_no ?? ""}
            placeholder="e.g. 2C1XX0000..."
            className="w-full px-2.5 py-1.5 border border-[var(--border)] rounded-md bg-white text-[13px]"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Issued date">
          <DateInput name="issued_date" defaultValue={existing?.issued_date ?? ""} />
        </Field>
        <Field label="Expires date">
          <DateInput name="expires_date" defaultValue={existing?.expires_date ?? ""} />
        </Field>
      </div>

      <Field label="Status">
        <select
          name="status"
          defaultValue={existing?.status ?? "active"}
          className="w-full px-2.5 py-1.5 border border-[var(--border)] rounded-md bg-white text-[13px]"
        >
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="terminated">Terminated</option>
        </select>
      </Field>

      {companies.length > 0 && (
        <Field label="Sponsor company">
          <Combobox
            name="sponsor_company_id"
            allowEmpty
            emptyLabel="— none —"
            options={companies.map<ComboOption>((c) => ({
              id: c.id, label: c.name, hint: c.code, keywords: c.code,
            }))}
            defaultValue={existing?.sponsor_company_id ?? ""}
            placeholder="Search companies…"
          />
        </Field>
      )}

      {partners.length > 0 && (
        <Field label="Responsible partner">
          <Combobox
            name="responsible_partner_id"
            allowEmpty
            emptyLabel="— none —"
            options={partners.map<ComboOption>((p) => ({
              id: p.id, label: p.name, hint: p.code, keywords: p.code,
            }))}
            defaultValue={existing?.responsible_partner_id ?? ""}
            placeholder="Search partners…"
          />
        </Field>
      )}

      <Field label="OneDrive folder">
        <input
          name="drive_folder_url"
          defaultValue={existing?.drive_folder_url ?? ""}
          placeholder="https://..."
          className="w-full px-2.5 py-1.5 border border-[var(--border)] rounded-md bg-white text-[13px]"
        />
      </Field>

      <Field label="Notes">
        <textarea
          name="notes"
          defaultValue={existing?.notes ?? ""}
          rows={2}
          className="w-full px-2.5 py-1.5 border border-[var(--border)] rounded-md bg-white text-[13px]"
        />
      </Field>

      <div className="flex justify-between items-center pt-2">
        {mode === "edit" && existing ? (
          <button
            type="button"
            onClick={async () => {
              onError(null);
              const ok = await confirm({
                title: "Archive permit",
                message: `Archive this ${existing.kind} record? Soft delete — nothing is lost, and it stops appearing in views.`,
                confirmLabel: "Archive",
                tone: "danger",
              });
              if (!ok) return;
              const fd = new FormData(); fd.set("id", existing.id);
              start(async () => {
                try { await archivePermitAction(fd); onDone(); }
                catch (e) { onError(e instanceof Error ? e.message : "Failed"); }
              });
            }}
            className="text-[12px] text-red-700 hover:underline"
          >
            Archive
          </button>
        ) : <span />}
        <button
          type="submit"
          disabled={pending}
          className="px-3.5 py-1.5 text-[13px] font-medium bg-ink text-white rounded-md hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
        >
          {pending && <Spinner className="h-3.5 w-3.5" />}
          {pending ? "Saving…" : mode === "create" ? "Add" : "Save"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-medium text-[var(--muted)] mb-1 uppercase tracking-wide">
        {label}
      </span>
      {children}
    </label>
  );
}
