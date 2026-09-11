"use client";
import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { DateInput } from "@/components/ui/DateInput";
import { deliverFormationAction } from "../actions";

/**
 * Delivery flow specific to Company Formation cases. Two toggles that can
 * be turned on independently:
 *   - Register the company (name + optional NIB/address/incorp date)
 *   - Create a Virtual Office subscription for it, starting today
 *
 * Turning both off collapses to a plain "mark delivered" — same result as
 * the ordinary deliver flow. The modal delegates to a single server action
 * so the whole thing goes through in one round-trip.
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
    <Modal open={open} onClose={onClose} title="Deliver — Company Formation" size="lg">
      {open && (
        <form
          action={(fd) => {
            setError(null);
            // FormData omits unchecked switches — set explicit "on"/"off" so
            // the server sees the intent unambiguously.
            fd.set("register_company", registerCompany ? "on" : "off");
            fd.set("create_vo",        createVo        ? "on" : "off");
            fd.set("case_id", caseId);
            start(async () => {
              try { await deliverFormationAction(fd); onDone(); }
              catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
            });
          }}
          className="space-y-5"
        >
          <p className="text-[13px] text-[var(--muted)]">
            Two optional steps that happen at delivery. Toggle off anything you don't need.
          </p>

          {/* Toggle 1: Register the company */}
          <section className="border border-[var(--border)] rounded-lg">
            <label className="flex items-start gap-3 p-3 cursor-pointer">
              <Switch checked={registerCompany} onChange={setRegisterCompany} />
              <div>
                <div className="text-[13.5px] font-medium text-ink">Register the company</div>
                <div className="text-[11.5px] text-[var(--muted)]">
                  Create a new company row and link the client as director.
                </div>
              </div>
            </label>
            {registerCompany && (
              <div className="border-t border-[var(--border)] p-3 space-y-2">
                <Row label="Company name" required>
                  <input
                    name="company_name"
                    defaultValue={defaultCompanyName}
                    required
                    className={cellInput}
                    placeholder="e.g. PT Almardini Wisata"
                  />
                </Row>
                <Row label="NIB">
                  <input name="company_nib" className={cellInput + " font-mono"} />
                </Row>
                <Row label="Incorporation date">
                  <DateInput name="incorporation_date" />
                </Row>
                <Row label="Address" align="start">
                  <textarea name="company_address" rows={2} className={cellInput + " resize-y"} />
                </Row>
              </div>
            )}
          </section>

          {/* Toggle 2: Create VO */}
          <section className="border border-[var(--border)] rounded-lg">
            <label className="flex items-start gap-3 p-3 cursor-pointer">
              <Switch checked={createVo} onChange={setCreateVo} />
              <div>
                <div className="text-[13.5px] font-medium text-ink">Start a Virtual Office subscription</div>
                <div className="text-[11.5px] text-[var(--muted)]">
                  Silver tier, 12 months from today. Needs the company (register above or existing).
                </div>
              </div>
            </label>
          </section>

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

function Row({ label, required, align = "center", children }: {
  label: string;
  required?: boolean;
  align?: "start" | "center";
  children: React.ReactNode;
}) {
  return (
    <div className={`grid grid-cols-[160px_1fr] gap-3 items-${align}`}>
      <div className="text-[12px] text-[var(--muted)] font-medium pt-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </div>
      <div>{children}</div>
    </div>
  );
}

const cellInput =
  "w-full px-2.5 py-1.5 bg-white border border-[var(--border)] rounded-md text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";
