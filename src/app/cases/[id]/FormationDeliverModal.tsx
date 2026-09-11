"use client";
import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { deliverFormationAction } from "../actions";

/**
 * Delivery flow for Company Formation cases: two independent toggles.
 *   - Register the company → creates the company row using the case's
 *     title as the name and links the client as director.
 *   - Start a VO subscription → adds an active VO entity_service for
 *     the resulting (or existing) company, silver / 12mo from today.
 *
 * Both off = plain "mark delivered". Everything runs through one server
 * action so the whole thing either succeeds or errors out cleanly.
 */
export function FormationDeliverModal({
  open, onClose, caseId, defaultCompanyName, onDone,
}: {
  open: boolean;
  onClose: () => void;
  caseId: string;
  defaultCompanyName: string;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [registerCompany, setRegisterCompany] = useState(true);
  const [createVo, setCreateVo] = useState(false);

  return (
    <Modal open={open} onClose={onClose} title="Deliver — Company Formation" size="md">
      {open && (
        <form
          action={(fd) => {
            setError(null);
            fd.set("register_company", registerCompany ? "on" : "off");
            fd.set("create_vo",        createVo        ? "on" : "off");
            fd.set("case_id", caseId);
            fd.set("company_name", defaultCompanyName);
            start(async () => {
              try { await deliverFormationAction(fd); onDone(); }
              catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
            });
          }}
          className="space-y-4"
        >
          <p className="text-[13px] text-[var(--muted)]">
            Two optional steps that happen at delivery. Toggle off anything you don&apos;t need.
          </p>

          <ToggleCard
            checked={registerCompany}
            onChange={setRegisterCompany}
            title="Register the company"
            hint={`Create "${defaultCompanyName || "—"}" and link the client as director.`}
          />

          <ToggleCard
            checked={createVo}
            onChange={setCreateVo}
            title="Start a Virtual Office subscription"
            hint="Silver tier, 12 months from today. Needs the company (register above or existing)."
          />

          {error && (
            <div className="text-[12.5px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-[13px] text-[var(--muted)] hover:text-ink rounded-md">Cancel</button>
            <button
              type="submit"
              disabled={pending}
              className="px-3.5 py-1.5 text-[13px] font-medium bg-ink text-white rounded-md hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Delivering…" : "Deliver"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function ToggleCard({
  checked, onChange, title, hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  hint: string;
}) {
  return (
    <label className="flex items-start gap-3 p-3 border border-[var(--border)] rounded-lg cursor-pointer hover:bg-white/50 transition-colors">
      <Switch checked={checked} onChange={onChange} />
      <div>
        <div className="text-[13.5px] font-medium text-ink">{title}</div>
        <div className="text-[11.5px] text-[var(--muted)]">{hint}</div>
      </div>
    </label>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full shrink-0 transition-colors ${
        checked ? "bg-brand" : "bg-[var(--border-strong)]"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
          checked ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
