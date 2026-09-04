"use client";
import { useState, useTransition } from "react";
import type { VirtualOffice, VirtualOfficeTier, VirtualOfficeStatus } from "@/lib/types";
import { Modal } from "@/components/ui/Modal";
import { DateInput } from "@/components/ui/DateInput";
import { Combobox, type ComboOption } from "@/components/ui/Combobox";
import { Spinner } from "@/components/ui/Spinner";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import {
  createVirtualOfficeAction,
  updateVirtualOfficeAction,
  renewVirtualOfficeAction,
  terminateVirtualOfficeAction,
  archiveVirtualOfficeAction,
} from "@/app/virtual-offices/actions";

export type CompanyOption = { id: string; code: string; name: string };
export type PartnerOption = { id: string; code: string; name: string };

const TIER_LABEL: Record<VirtualOfficeTier, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
};

const STATUS_PILL: Record<VirtualOfficeStatus, { bg: string; text: string; dot: string }> = {
  active:     { bg: "bg-[#DCFCE7]",         text: "text-[#166534]",     dot: "bg-[#22C55E]" },
  expired:    { bg: "bg-[#FEE2E2]",         text: "text-[#991B1B]",     dot: "bg-[#EF4444]" },
  terminated: { bg: "bg-[var(--surface-2)]", text: "text-[var(--muted)]", dot: "bg-[var(--muted)]" },
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

export function VirtualOfficeCard({
  companyId,
  offices,
  partners = [],
}: {
  companyId: string;
  offices: VirtualOffice[];
  partners?: PartnerOption[];
}) {
  const [editing, setEditing] = useState<VirtualOffice | null>(null);
  const [creating, setCreating] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const active = offices.filter((o) => o.status === "active");
  const historic = offices.filter((o) => o.status !== "active");

  return (
    <div className="bg-white border border-[var(--border)] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-serif text-[15px] text-ink">Virtual office</h3>
          {active.length > 0 && (
            <span className="text-[11px] text-[var(--muted)]">
              {active.length} active
            </span>
          )}
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

      {offices.length === 0 && (
        <p className="text-[12.5px] text-[var(--muted)]">
          No virtual office on file for this company.
        </p>
      )}

      {active.length > 0 && (
        <ul className="divide-y divide-[var(--border)] -mx-1">
          {active.map((vo) => (
            <VORow key={vo.id} vo={vo} onEdit={() => setEditing(vo)} onFlash={setFlash} start={start} pending={pending} />
          ))}
        </ul>
      )}

      {historic.length > 0 && (
        <details className="mt-3 group">
          <summary className="text-[11.5px] text-[var(--muted)] hover:text-ink cursor-pointer select-none">
            {historic.length} past {historic.length === 1 ? "term" : "terms"}
          </summary>
          <ul className="divide-y divide-[var(--border)] -mx-1 mt-2">
            {historic.map((vo) => (
              <VORow key={vo.id} vo={vo} onEdit={() => setEditing(vo)} onFlash={setFlash} start={start} pending={pending} historic />
            ))}
          </ul>
        </details>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Add virtual office" size="lg">
        <VOForm
          mode="create"
          companyId={companyId}
          partners={partners}
          onDone={() => setCreating(false)}
          onError={setFlash}
        />
      </Modal>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Edit virtual office"
        size="lg"
      >
        {editing && (
          <VOForm
            mode="edit"
            companyId={companyId}
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

function VORow({
  vo, onEdit, onFlash, start, pending, historic = false,
}: {
  vo: VirtualOffice;
  onEdit: () => void;
  onFlash: (msg: string | null) => void;
  start: (cb: () => void) => void;
  pending: boolean;
  historic?: boolean;
}) {
  const confirm = useConfirm();
  const pill = STATUS_PILL[vo.status];
  const days = vo.status === "active" ? daysLabel(vo.end_date) : null;

  return (
    <li className="px-1 py-2.5">
      <div className="grid grid-cols-[1fr_auto] gap-3 items-start">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13.5px] text-ink font-medium">
              {TIER_LABEL[vo.tier]}
            </span>
            <span className="text-[11px] text-[var(--muted)]">
              {vo.term_months}mo term
            </span>
            <span className={`inline-flex items-center gap-1 text-[10.5px] font-medium px-1.5 py-0.5 rounded-full ${pill.bg} ${pill.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${pill.dot}`} />
              {vo.status}
            </span>
          </div>
          <div className="text-[11.5px] text-[var(--muted)] mt-0.5">
            {fmtDate(vo.start_date)} → {fmtDate(vo.end_date)}
            {days && <> · <span className={days.tone}>{days.text}</span></>}
          </div>
          {vo.responsible && (
            <div className="text-[11.5px] text-[var(--muted)] mt-0.5">
              PJ: <span className="text-ink">{vo.responsible.name}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onEdit}
            className="text-[11.5px] text-[var(--muted)] hover:text-ink underline"
          >
            edit
          </button>
          {(vo.status === "active" || vo.status === "expired") && (
            <button
              type="button"
              disabled={pending}
              onClick={async () => {
                onFlash(null);
                const msg = vo.status === "expired"
                  ? "Open a new tenancy starting after this one's end date? Term and tier carry over — edit the new row if anything changed."
                  : "Open a new tenancy for the next term? The current one will be marked expired.";
                const ok = await confirm({
                  title: "Renew virtual office",
                  message: msg,
                  confirmLabel: "Renew",
                });
                if (!ok) return;
                const fd = new FormData(); fd.set("id", vo.id);
                start(async () => {
                  try { await renewVirtualOfficeAction(fd); }
                  catch (e) { onFlash(e instanceof Error ? e.message : "Failed"); }
                });
              }}
              className="text-[11.5px] font-medium text-brand hover:text-brand-dark disabled:opacity-50"
            >
              renew
            </button>
          )}
          {vo.status === "active" && (
            <button
              type="button"
              disabled={pending}
              onClick={async () => {
                onFlash(null);
                const ok = await confirm({
                  title: "Terminate virtual office",
                  message: "This ends the tenancy early. The row stays in history but is no longer active.",
                  confirmLabel: "Terminate",
                  tone: "danger",
                });
                if (!ok) return;
                const fd = new FormData(); fd.set("id", vo.id);
                start(async () => {
                  try { await terminateVirtualOfficeAction(fd); }
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

export function VOForm({
  mode, companyId, companies, partners = [], existing, onDone, onError,
}: {
  mode: "create" | "edit";
  /** Fixed company (from the company page card). If absent, `companies` must
   *  be provided so the form renders a picker. */
  companyId?: string;
  companies?: CompanyOption[];
  /** Optional list to power the responsible-partner picker. When empty, the
   *  field is hidden — safe when partners aren't loaded on that call site. */
  partners?: PartnerOption[];
  existing?: VirtualOffice;
  onDone: () => void;
  onError: (msg: string | null) => void;
}) {
  const [pending, start] = useTransition();
  const confirm = useConfirm();
  const [termMonths, setTermMonths] = useState<number>(existing?.term_months ?? 12);
  const [startDate, setStartDate] = useState<string>(existing?.start_date ?? "");
  const [endDate, setEndDate] = useState<string>(existing?.end_date ?? "");

  // Recompute end whenever start or term changes. Users can still type over
  // the End field afterwards; a subsequent change to Start/Term will
  // overwrite that edit.
  function recomputeEnd(nextStart: string, nextTerm: number) {
    if (!nextStart || !nextTerm) return;
    const d = new Date(nextStart + "T00:00:00");
    d.setMonth(d.getMonth() + nextTerm);
    setEndDate(d.toISOString().slice(0, 10));
  }

  function onStartChange(v: string) {
    setStartDate(v);
    recomputeEnd(v, termMonths);
  }
  function onTermChange(v: number) {
    setTermMonths(v);
    recomputeEnd(startDate, v);
  }

  return (
    <form
      action={(fd) => {
        onError(null);
        start(async () => {
          try {
            if (mode === "create") await createVirtualOfficeAction(fd);
            else                    await updateVirtualOfficeAction(fd);
            onDone();
          } catch (e) {
            onError(e instanceof Error ? e.message : "Failed to save.");
          }
        });
      }}
      className="space-y-4"
    >
      {companyId && <input type="hidden" name="company_id" value={companyId} />}
      {existing && <input type="hidden" name="id" value={existing.id} />}

      {!companyId && companies && (
        <Field label="Company">
          <Combobox
            name="company_id"
            required
            options={companies.map<ComboOption>((c) => ({
              id: c.id,
              label: c.name,
              hint: c.code,
              keywords: c.code,
            }))}
            defaultValue={existing?.company_id ?? ""}
            placeholder="Select a company…"
          />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Tier">
          <select
            name="tier"
            defaultValue={existing?.tier ?? "silver"}
            className="w-full px-2.5 py-1.5 border border-[var(--border)] rounded-md bg-white text-[13px]"
          >
            {(["bronze", "silver", "gold", "platinum"] as VirtualOfficeTier[]).map((t) => (
              <option key={t} value={t}>{TIER_LABEL[t]}</option>
            ))}
          </select>
        </Field>
        <Field label="Term (months)">
          <input
            type="number"
            name="term_months"
            min={1}
            value={termMonths}
            onChange={(e) => onTermChange(Number(e.target.value) || 12)}
            className="w-full px-2.5 py-1.5 border border-[var(--border)] rounded-md bg-white text-[13px]"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Start date">
          <DateInput name="start_date" value={startDate} onChange={onStartChange} />
        </Field>
        <Field label="End date">
          <DateInput name="end_date" value={endDate} onChange={setEndDate} />
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

      {partners.length > 0 && (
        <Field label="Responsible partner">
          <Combobox
            name="responsible_partner_id"
            allowEmpty
            emptyLabel="— none —"
            options={partners.map<ComboOption>((p) => ({
              id: p.id,
              label: p.name,
              hint: p.code,
              keywords: p.code,
            }))}
            defaultValue={existing?.responsible_partner_id ?? ""}
            placeholder="Search partners…"
          />
        </Field>
      )}

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
                title: "Archive virtual office",
                message: `Archive this record for ${existing.tier.charAt(0).toUpperCase() + existing.tier.slice(1)} · ${existing.term_months}mo? This is a soft delete — nothing is lost, and it stops appearing in views.`,
                confirmLabel: "Archive",
                tone: "danger",
              });
              if (!ok) return;
              const fd = new FormData();
              fd.set("id", existing.id);
              start(async () => {
                try { await archiveVirtualOfficeAction(fd); onDone(); }
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
