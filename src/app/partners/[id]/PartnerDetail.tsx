"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { Partner, CaseStatus, CasePriority } from "@/lib/types";
import { CASE_STATUS_LABELS, CASE_PRIORITY_LABELS } from "@/lib/types";
import { PartnerForm } from "../PartnerForm";
import { updatePartnerAction, softDeletePartnerAction, restorePartnerAction } from "../actions";
import { Modal } from "@/components/ui/Modal";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { serviceLabel } from "@/lib/service";

type PartnerCase = {
  id: string;
  code: string;
  title: string | null;
  status: CaseStatus;
  priority: CasePriority;
  deadline: string | null;
  updated_at: string;
  client: { id: string; full_name: string } | null;
  company: { id: string; name: string } | null;
  service: { id: string; code: string; name: string } | null;
};

const STATUS_PILL: Record<CaseStatus, { bg: string; text: string; dot: string }> = {
  new:         { bg: "bg-[#FEF3C7]", text: "text-[#92400E]", dot: "bg-[#F59E0B]" },
  in_progress: { bg: "bg-[#DBEAFE]", text: "text-[#1E40AF]", dot: "bg-[#3B82F6]" },
  done:        { bg: "bg-[#DCFCE7]", text: "text-[#166534]", dot: "bg-[#22C55E]" },
  delivered:   { bg: "bg-[var(--surface-2)]", text: "text-[var(--muted)]", dot: "bg-[var(--muted)]" },
};

type ManagedOffice = {
  id: string;
  tier: "bronze" | "silver" | "gold" | "platinum";
  term_months: number;
  start_date: string | null;
  end_date: string;
  status: "active" | "expired" | "terminated";
  company: { id: string; code: string; name: string } | null;
};

const OFFICE_TIER_LABEL: Record<ManagedOffice["tier"], string> = {
  bronze: "Bronze", silver: "Silver", gold: "Gold", platinum: "Platinum",
};
const OFFICE_STATUS_PILL: Record<ManagedOffice["status"], { bg: string; text: string; dot: string }> = {
  active:     { bg: "bg-[#DCFCE7]",           text: "text-[#166534]",       dot: "bg-[#22C55E]" },
  expired:    { bg: "bg-[#FEE2E2]",           text: "text-[#991B1B]",       dot: "bg-[#EF4444]" },
  terminated: { bg: "bg-[var(--surface-2)]",  text: "text-[var(--muted)]",  dot: "bg-[var(--muted)]" },
};

export function PartnerDetail({
  partner, introducedClients, introducedCompanies = [], managedOffices = [], cases,
}: {
  partner: Partner;
  introducedClients: Array<{ id: string; code: string; full_name: string }>;
  introducedCompanies?: Array<{ id: string; code: string; name: string }>;
  managedOffices?: ManagedOffice[];
  cases: PartnerCase[];
}) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [flash, setFlash] = useState<string | null>(null);
  const confirm = useConfirm();

  return (
    <div>
      <div className="flex items-center justify-end gap-2 mb-4">
        {!partner.deleted_at ? (
          <>
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 bg-surface hover:bg-[var(--surface-deep)] text-ink text-[12.5px] font-medium px-3 py-1.5 rounded-lg shadow-sm border border-[var(--border)] transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4z" />
              </svg>
              Edit
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={async () => {
                const ok = await confirm({
                  title: "Archive partner",
                  message: `Archive ${partner.name}?`,
                  confirmLabel: "Archive",
                  tone: "danger",
                });
                if (!ok) return;
                const fd = new FormData(); fd.set("id", partner.id);
                start(async () => {
                  try { await softDeletePartnerAction(fd); }
                  catch (e) { setFlash(e instanceof Error ? e.message : "Failed"); }
                });
              }}
              className="inline-flex items-center gap-1.5 text-[var(--muted)] hover:text-red-700 hover:bg-red-50 text-[12.5px] font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              Archive
            </button>
          </>
        ) : (
          <form
            action={(fd) => {
              start(async () => {
                try { await restorePartnerAction(fd); }
                catch (e) { setFlash(e instanceof Error ? e.message : "Failed"); }
              });
            }}
          >
            <input type="hidden" name="id" value={partner.id} />
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-1.5 bg-brand hover:bg-brand-dark text-white text-[12.5px] font-medium px-3 py-1.5 rounded-lg disabled:opacity-50"
            >
              Restore
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
          <Card title="Contact">
            <FieldRow label="Contact person" value={partner.contact_person} />
            <FieldRow label="Phone" value={partner.phone} />
            <FieldRow label="Email" value={partner.email} />
          </Card>

          {partner.notes && (
            <Card title="Notes">
              <p className="text-[13.5px] whitespace-pre-wrap text-ink leading-relaxed py-1">
                {partner.notes}
              </p>
            </Card>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-5">
          <Card title="Related clients" count={introducedClients.length} padded>
            {introducedClients.length === 0 ? (
              <p className="text-[12.5px] text-[var(--muted)]">No clients yet from this partner.</p>
            ) : (
              <ul className="divide-y divide-[var(--border)] -mx-1">
                {introducedClients.map((c) => (
                  <li key={c.id} className="px-1 py-2.5">
                    <Link href={`/clients/${c.id}`} className="grid grid-cols-[auto_1fr] gap-3 items-center group">
                      <span className="font-mono text-[11px] text-brand-dark bg-brand-softer px-1.5 py-0.5 rounded justify-self-start">
                        {c.code}
                      </span>
                      <span className="text-[13.5px] text-ink font-medium truncate group-hover:text-brand-dark">
                        {c.full_name}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Related companies" count={introducedCompanies.length} padded>
            {introducedCompanies.length === 0 ? (
              <p className="text-[12.5px] text-[var(--muted)]">No companies yet from this partner.</p>
            ) : (
              <ul className="divide-y divide-[var(--border)] -mx-1">
                {introducedCompanies.map((c) => (
                  <li key={c.id} className="px-1 py-2.5">
                    <Link href={`/companies/${c.id}`} className="grid grid-cols-[auto_1fr] gap-3 items-center group">
                      <span className="font-mono text-[11px] text-brand-dark bg-brand-softer px-1.5 py-0.5 rounded justify-self-start">
                        {c.code}
                      </span>
                      <span className="text-[13.5px] text-ink font-medium truncate group-hover:text-brand-dark">
                        {c.name}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Virtual offices managed" count={managedOffices.length} padded>
            {managedOffices.length === 0 ? (
              <p className="text-[12.5px] text-[var(--muted)]">Not the PJ on any virtual office yet.</p>
            ) : (
              <ul className="divide-y divide-[var(--border)] -mx-1">
                {managedOffices.map((vo) => {
                  const pill = OFFICE_STATUS_PILL[vo.status];
                  return (
                    <li key={vo.id} className="px-1 py-2.5">
                      <div className="grid grid-cols-[1fr_auto] gap-3 items-start">
                        <div className="min-w-0">
                          {vo.company ? (
                            <Link href={`/companies/${vo.company.id}`} className="text-[13.5px] text-ink font-medium hover:text-brand-dark block truncate">
                              {vo.company.name}
                            </Link>
                          ) : (
                            <span className="text-[13.5px] text-[var(--muted)]">—</span>
                          )}
                          <div className="text-[11.5px] text-[var(--muted)] mt-0.5">
                            {OFFICE_TIER_LABEL[vo.tier]} · {vo.term_months}mo · ends {fmtDate(vo.end_date)}
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-1 text-[10.5px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${pill.bg} ${pill.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${pill.dot}`} />
                          {vo.status}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title="Cases handled" count={cases.length} padded>
            <PartnerCasesList cases={cases} />
          </Card>
        </div>
      </div>

      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title="Edit partner"
        subtitle={partner.code}
        size="xl"
      >
        <PartnerForm
          mode="edit"
          partner={partner}
          action={async (fd) => { await updatePartnerAction(fd); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      </Modal>
    </div>
  );
}

/* ============ Cases handled through this partner ============ */
function PartnerCasesList({ cases }: { cases: PartnerCase[] }) {
  if (cases.length === 0) {
    return <p className="text-[12.5px] text-[var(--muted)]">No cases involving this partner yet.</p>;
  }
  const today = new Date().toISOString().slice(0, 10);
  return (
    <ul className="divide-y divide-[var(--border)] -mx-1">
      {cases.map((c) => {
        const p = STATUS_PILL[c.status];
        const overdue = c.deadline && c.deadline < today && c.status !== "delivered";
        const who = c.client?.full_name ?? c.company?.name ?? "—";
        return (
          <li key={c.id} className="px-1 py-2.5">
            <Link href={`/cases/${c.id}`} className="grid grid-cols-[auto_1fr_auto] gap-3 items-center group">
              <span className="font-mono text-[11px] text-brand-dark bg-brand-softer px-1.5 py-0.5 rounded">
                {c.code}
              </span>
              <div className="min-w-0">
                <div className="text-[13.5px] text-ink font-medium truncate group-hover:text-brand-dark">
                  {c.title || serviceLabel(c.service) || "Case"}
                </div>
                <div className="text-[11.5px] text-[var(--muted)] truncate">
                  {who}
                  {c.service?.name && <> · {serviceLabel(c.service)}</>}
                  {c.deadline && (
                    <> · <span className={overdue ? "text-red-700 font-semibold" : ""}>due {fmtDate(c.deadline)}</span></>
                  )}
                  {c.priority !== "normal" && (
                    <> · <span className="uppercase tracking-wide text-[10px] font-semibold">{CASE_PRIORITY_LABELS[c.priority]}</span></>
                  )}
                </div>
              </div>
              <span className={`inline-flex items-center gap-1.5 text-[10.5px] font-medium px-2 py-0.5 rounded-full shrink-0 ${p.bg} ${p.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
                {CASE_STATUS_LABELS[c.status]}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
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
