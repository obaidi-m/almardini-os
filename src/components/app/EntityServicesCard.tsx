"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type { EntityService, EntityServiceStatus, ServiceType } from "@/lib/types";
import { Modal } from "@/components/ui/Modal";
import { DateInput } from "@/components/ui/DateInput";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { ExpiryPill } from "@/components/app/ExpiryPill";
import { effectiveStatus } from "@/lib/entityStatus";
import { isInReminderWindow } from "@/lib/renewal";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";
import {
  createEntityServiceAction,
  updateEntityServiceAction,
  deleteEntityServiceAction,
  renewEntityServiceAction,
} from "@/app/entity-services/actions";

type CatalogService = Pick<
  ServiceType,
  "id" | "code" | "name" | "applies_to" | "tracks_expiry" | "is_ongoing" | "schedule_kind"
>;

// What belongs in the entity's card depends on whether the owner is a
// company (subscriptions) or a person (permits).
//   Subscription = recurring revenue: ongoing OR calendar-recurring OR rolling.
//   Permit       = a document a person holds with an expiry: anything with
//                  a real end date (tracks_expiry) — that's one-off + shelf
//                  life (KITAS 2yr, KITAP 5yr) or rolling.
// Pure one-offs with no expiry (PT PMA formation) belong in /cases, not here.
function isSubscriptionShape(c: CatalogService): boolean {
  return (
    c.is_ongoing ||
    c.schedule_kind === "annual_fixed" ||
    c.schedule_kind === "quarterly_fixed" ||
    c.schedule_kind === "rolling"
  );
}
function isPermitShape(c: CatalogService): boolean {
  return c.tracks_expiry || c.schedule_kind === "rolling";
}

type CompanyOpt = { id: string; code: string; name: string };
type PartnerOpt = { id: string; code: string; name: string };

type Owner = { kind: "client"; id: string } | { kind: "company"; id: string };

export function EntityServicesCard({
  owner, services, catalog, companies = [], partners = [], handledServiceIds = [],
}: {
  owner: Owner;
  services: EntityService[];
  catalog: CatalogService[];
  companies?: CompanyOpt[];
  partners?: PartnerOpt[];
  handledServiceIds?: string[];
}) {
  const { t } = useT();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<EntityService | null>(null);
  const [renewing, setRenewing] = useState<EntityService | null>(null);
  const [showPast, setShowPast] = useState(false);

  // Count past cycles per (service_id) so an active row can hint
  // "3rd cycle since …" without hitting the DB again.
  const pastCountByService = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of services) {
      if (r.status !== "active") m.set(r.service_id, (m.get(r.service_id) ?? 0) + 1);
    }
    return m;
  }, [services]);

  // Filter catalog to what can apply to this owner AND fits the card's
  // real-world concept — subscriptions for companies, permits for people.
  const availableCatalog = useMemo(
    () =>
      catalog
        .filter((c) =>
          c.applies_to === "either"
            ? true
            : owner.kind === "client"
            ? c.applies_to === "person"
            : c.applies_to === "company",
        )
        .filter(owner.kind === "client" ? isPermitShape : isSubscriptionShape),
    [catalog, owner.kind],
  );

  const active = services.filter((s) => s.status === "active");
  const other  = services.filter((s) => s.status !== "active");

  // Naming diverges by owner kind. Companies have subscriptions (recurring
  // things they pay us for). People have permits (KITAS/KITAP/IMTA — a
  // regulatory allowance with an expiry). Same table underneath, different
  // real-world concept, so different words for the operator.
  const isPerson = owner.kind === "client";
  const titleKey    = isPerson ? "services.title.permits"          : "services.title.subscriptions";
  const emptyKey    = isPerson ? "services.empty.permit"           : "services.empty.subscription";
  const addModalKey = isPerson ? "services.modal.add.permit"       : "services.modal.add.subscription";
  const editModalKey= isPerson ? "services.modal.edit.permit"      : "services.modal.edit.subscription";

  return (
    <section className="bg-surface rounded-2xl shadow-[0_1px_3px_rgba(15,31,29,0.06),0_8px_24px_-6px_rgba(15,31,29,0.10)] p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-baseline gap-2">
          <h3 className="font-serif text-[15px] text-ink leading-none">{t(titleKey)}</h3>
          <span className="text-[11.5px] text-[var(--muted)] font-medium">{t("services.n_active", { n: active.length })}</span>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="text-[12px] font-medium text-brand hover:text-brand-dark"
        >
          {t("services.add")}
        </button>
      </div>

      {services.length === 0 ? (
        <p className="text-[12.5px] text-[var(--muted)]">
          {t(emptyKey)}
        </p>
      ) : (
        <>
          <ul className="divide-y divide-[var(--border)] -mx-1">
            {active.map((row) => (
              <li key={row.id}>
                <ServiceRow
                  row={row}
                  handled={handledServiceIds.includes(row.service_id)}
                  cycleNumber={(pastCountByService.get(row.service_id) ?? 0) + 1}
                  onEdit={() => setEditing(row)}
                  onRenew={() => setRenewing(row)}
                />
              </li>
            ))}
          </ul>

          {other.length > 0 && (
            <div className="mt-2 border-t border-[var(--border)] pt-2">
              <button
                type="button"
                onClick={() => setShowPast((v) => !v)}
                className="text-[11.5px] text-[var(--muted)] hover:text-ink"
              >
                {showPast
                  ? `Hide past (${other.length})`
                  : `Show past (${other.length})`}
              </button>
              {showPast && (
                <ul className="divide-y divide-[var(--border)] -mx-1 mt-1 opacity-70">
                  {other.map((row) => (
                    <li key={row.id}>
                      <ServiceRow
                        row={row}
                        handled={false}
                        cycleNumber={null}
                        onEdit={() => setEditing(row)}
                        onRenew={null}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title={t(addModalKey)}
        size="lg"
      >
        <ServiceForm
          mode="create"
          owner={owner}
          catalog={availableCatalog}
          companies={companies}
          partners={partners}
          onDone={() => setCreating(false)}
        />
      </Modal>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={t(editModalKey)}
        size="lg"
      >
        {editing && (
          <ServiceForm
            mode="edit"
            owner={owner}
            catalog={availableCatalog}
            companies={companies}
            partners={partners}
            initial={editing}
            onDone={() => setEditing(null)}
          />
        )}
      </Modal>

      <Modal
        open={renewing !== null}
        onClose={() => setRenewing(null)}
        title={`Renew ${renewing?.service?.name ?? ""}`}
        size="md"
      >
        {renewing && (
          <RenewForm row={renewing} onDone={() => setRenewing(null)} />
        )}
      </Modal>
    </section>
  );
}

/* ============ Row ============ */

function ServiceRow({
  row, handled, cycleNumber, onEdit, onRenew,
}: {
  row: EntityService;
  handled: boolean;
  cycleNumber: number | null;
  onEdit: () => void;
  onRenew: (() => void) | null;
}) {
  const { t } = useT();
  const [pending, start] = useTransition();
  const confirm = useConfirm();
  const svc = row.service;
  const label = svc?.name ?? t("services.label.service");
  const canRenew =
    onRenew !== null &&
    row.status === "active" &&
    !!svc?.tracks_expiry;

  return (
    <div className="px-1 py-2.5 grid grid-cols-[1fr_auto] gap-3 items-start text-[13.5px]">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-ink font-medium">{label}</span>
          {row.tier && (
            <span className="text-[10.5px] text-[var(--muted)] uppercase tracking-wide">
              {row.tier}
            </span>
          )}
          {row.term_months && (
            <span className="text-[10.5px] text-[var(--muted)]">
              {t("services.row.mo_term", { n: row.term_months })}
            </span>
          )}
          <StatusPill status={effectiveStatus(row)} />
        </div>
        <div className="text-[11.5px] text-[var(--muted)] mt-0.5">
          <DateLine row={row} />
          {row.sponsor ? (
            <> · Guarantor:{" "}
              <Link href={`/companies/${row.sponsor.id}`} className="hover:text-brand">
                {row.sponsor.name}
              </Link>
            </>
          ) : row.responsible ? (
            <> · Guarantor:{" "}
              <Link href={`/partners/${row.responsible.id}`} className="hover:text-brand">
                {row.responsible.name}
              </Link>
            </>
          ) : null}
          {cycleNumber && cycleNumber > 1 && (
            <> · <span title="Cycles including renewals">cycle {cycleNumber}</span></>
          )}
        </div>
        {row.status === "active" && !handled && isInReminderWindow(svc ?? null) && (
          <div className="text-[11.5px] font-medium text-amber-700 mt-0.5">
            {t("services.row.due_now")}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        {canRenew && (
          <button
            type="button"
            onClick={() => onRenew!()}
            className="text-[11.5px] font-medium text-brand hover:text-brand-dark"
          >
            Renew
          </button>
        )}
        <button
          type="button"
          onClick={onEdit}
          className="text-[11.5px] text-[var(--muted)] hover:text-ink"
        >
          {t("services.row.edit")}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={async () => {
            const ok = await confirm({
              title: t("services.delete.title"),
              message: t("services.delete.message", { name: row.service?.name ?? t("services.label.service") }),
              confirmLabel: t("action.delete"),
              tone: "danger",
            });
            if (!ok) return;
            const fd = new FormData(); fd.set("id", row.id);
            start(async () => { await deleteEntityServiceAction(fd); });
          }}
          className="text-[11.5px] text-[var(--muted)] hover:text-red-700"
        >
          {t("services.row.delete")}
        </button>
      </div>
    </div>
  );
}

function DateLine({ row }: { row: EntityService }) {
  const { t } = useT();
  const svc = row.service;
  if (svc?.is_ongoing) {
    if (row.started_date) return <>{t("services.row.since")} {fmt(row.started_date)}</>;
    return <>{t("services.row.ongoing")}</>;
  }
  if (svc?.tracks_expiry) {
    const parts: string[] = [];
    if (row.issued_date || row.started_date) parts.push(fmt(row.issued_date ?? row.started_date));
    if (row.expires_date) parts.push(`→ ${fmt(row.expires_date)}`);
    return (
      <>
        {parts.join(" ")}
        {row.status === "active" && row.expires_date && (
          <> · <ExpiryPill expires={row.expires_date} /></>
        )}
      </>
    );
  }
  return <>—</>;
}

function StatusPill({ status }: { status: EntityServiceStatus }) {
  const { t } = useT();
  const styles: Record<EntityServiceStatus, string> = {
    active:     "bg-[#DCFCE7] text-[#166534]",
    expired:    "bg-[#FEF3C7] text-[#92400E]",
    terminated: "bg-[var(--surface-2)] text-[var(--muted)]",
    paused:     "bg-[#DBEAFE] text-[#1E40AF]",
  };
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0 rounded-full ${styles[status]}`}>
      <span className="w-1 h-1 rounded-full bg-current" />
      {t(`services.status.${status}` as MessageKey)}
    </span>
  );
}

/* ============ Form ============ */

function ServiceForm({
  mode, owner, catalog, companies, partners, initial, onDone,
}: {
  mode: "create" | "edit";
  owner: Owner;
  catalog: CatalogService[];
  companies: CompanyOpt[];
  partners: PartnerOpt[];
  initial?: EntityService;
  onDone: () => void;
}) {
  const { t } = useT();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [serviceId, setServiceId] = useState<string>(
    initial?.service_id ?? catalog[0]?.id ?? "",
  );
  const svc = useMemo(
    () => catalog.find((c) => c.id === serviceId) ?? null,
    [catalog, serviceId],
  );

  if (catalog.length === 0) {
    return (
      <p className="text-[13px] text-[var(--muted)]">
        {owner.kind === "client"
          ? t("services.form.no_available_person")
          : t("services.form.no_available_company")}{" "}
        <Link href="/admin/services" className="text-brand hover:underline">
          /admin/services
        </Link>
        .
      </p>
    );
  }

  return (
    <form
      action={(fd) => {
        setError(null);
        if (owner.kind === "client")  fd.set("client_id", owner.id);
        if (owner.kind === "company") fd.set("company_id", owner.id);
        fd.set("service_id", serviceId);
        start(async () => {
          try {
            if (mode === "create") {
              await createEntityServiceAction(fd);
            } else if (initial) {
              fd.set("id", initial.id);
              await updateEntityServiceAction(fd);
            }
            onDone();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Failed");
          }
        });
      }}
      className="space-y-4"
    >
      {/* Service picker (locked on edit — you don't retype the service) */}
      <div>
        <Label>{t("services.label.service")}</Label>
        {mode === "create" ? (
          <select
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            className={input}
            required
          >
            {catalog.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.code ? ` (${c.code})` : ""}
              </option>
            ))}
          </select>
        ) : (
          <div className="text-[13.5px] text-ink py-1.5">{svc?.name}</div>
        )}
      </div>

      {/* Adaptive fields based on flags */}
      {svc?.tracks_expiry && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>{svc.applies_to === "company" ? t("services.label.start_date") : t("services.label.issued_date")}</Label>
            <DateInput
              name={svc.applies_to === "company" ? "started_date" : "issued_date"}
              defaultValue={
                svc.applies_to === "company"
                  ? initial?.started_date ?? ""
                  : initial?.issued_date ?? ""
              }
            />
          </div>
          <div>
            <Label>{t("services.label.end_date")}</Label>
            <DateInput
              name="expires_date"
              defaultValue={initial?.expires_date ?? ""}
            />
          </div>
        </div>
      )}

      {svc?.is_ongoing && (
        <div>
          <Label>{t("services.label.subscribed_since")}</Label>
          <DateInput
            name="started_date"
            defaultValue={initial?.started_date ?? ""}
          />
        </div>
      )}

      {/* VO-shaped extras — offered only when service is company + tracks_expiry
          and looks like a VO. Simple heuristic: name mentions "office". */}
      {svc?.applies_to === "company" && svc.tracks_expiry &&
        svc.name.toLowerCase().includes("office") && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>{t("services.label.tier")}</Label>
            <select name="tier" defaultValue={initial?.tier ?? "silver"} className={input}>
              <option value="silver">{t("services.tier.silver")}</option>
              <option value="gold">{t("services.tier.gold")}</option>
              <option value="platinum">{t("services.tier.platinum")}</option>
              <option value="bronze">{t("services.tier.bronze")}</option>
            </select>
          </div>
          <div>
            <Label>{t("services.label.term_months")}</Label>
            <input
              type="number"
              name="term_months"
              min="1"
              defaultValue={initial?.term_months ?? 12}
              className={input}
            />
          </div>
        </div>
      )}

      {/* Common fields */}
      <div>
        <Label>{t("services.label.status")}</Label>
        <select name="status" defaultValue={initial?.status ?? "active"} className={input}>
          <option value="active">{t("services.status.active")}</option>
          <option value="paused">{t("services.status.paused")}</option>
          <option value="terminated">{t("services.status.terminated")}</option>
        </select>
        <p className="text-[11px] text-[var(--muted)] mt-1">
          Expired is set automatically from the expiry date — no need to pick it.
        </p>
      </div>

      <div>
        <Label>Guarantor</Label>
        <select
          name="guarantor"
          defaultValue={
            initial?.sponsor_company_id
              ? `company:${initial.sponsor_company_id}`
              : initial?.responsible_partner_id
                ? `partner:${initial.responsible_partner_id}`
                : ""
          }
          className={input}
        >
          <option value="">— (family / none)</option>
          {companies.length > 0 && (
            <optgroup label="Companies">
              {companies.map((c) => (
                <option key={`c-${c.id}`} value={`company:${c.id}`}>{c.name} ({c.code})</option>
              ))}
            </optgroup>
          )}
          {partners.length > 0 && (
            <optgroup label="PJ (legacy)">
              {partners.map((p) => (
                <option key={`p-${p.id}`} value={`partner:${p.id}`}>{p.name} ({p.code})</option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      <div>
        <Label>{t("services.label.notes_optional")}</Label>
        <textarea
          name="notes"
          defaultValue={initial?.notes ?? ""}
          rows={3}
          className={input}
        />
      </div>

      {error && (
        <div className="text-[12.5px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onDone}
          className="px-3 py-1.5 text-[13px] text-[var(--muted)] hover:text-ink"
        >
          {t("action.cancel")}
        </button>
        <button
          type="submit"
          disabled={pending}
          className="px-3 py-1.5 text-[13px] font-medium bg-ink text-[var(--bg)] rounded-lg hover:opacity-90 disabled:opacity-50"
        >
          {mode === "create" ? t("services.form.add") : t("services.form.save")}
        </button>
      </div>
    </form>
  );
}

/* ============ Renew form ============ */

// Small modal for rolling the current cycle. Pre-fills the new dates from
// the service's validity so the operator only types when the govt-issued
// date differs (KITAS/KITAP). One button, no fancy fields.
function RenewForm({ row, onDone }: { row: EntityService; onDone: () => void }) {
  const svc = row.service;
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const todayIso = new Date().toISOString().slice(0, 10);
  const defaultStart = row.expires_date ?? todayIso;
  const validityDays =
    svc?.validity_amount && svc?.validity_unit
      ? svc.validity_unit === "years"
        ? svc.validity_amount * 365
        : svc.validity_unit === "months"
        ? svc.validity_amount * 30
        : svc.validity_amount
      : null;
  const defaultExpiry = validityDays
    ? addDaysIso(defaultStart, validityDays)
    : "";

  const [newStart, setNewStart]   = useState<string>(defaultStart);
  const [newExpiry, setNewExpiry] = useState<string>(defaultExpiry);
  const [notes, setNotes]         = useState<string>("");

  return (
    <form
      action={(fd) => {
        setError(null);
        fd.set("id", row.id);
        fd.set("started_date", newStart);
        fd.set("expires_date", newExpiry);
        if (notes.trim()) fd.set("notes", notes.trim());
        start(async () => {
          try {
            await renewEntityServiceAction(fd);
            onDone();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to renew");
          }
        });
      }}
      className="space-y-3"
    >
      <div className="text-[12.5px] text-[var(--muted)]">
        Current expiry: <span className="text-ink font-medium">{fmtLong(row.expires_date)}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Renews on</Label>
          <DateInput
            name="_renews_on_display"
            value={newStart}
            onChange={(iso) => setNewStart(iso)}
          />
          <div className="text-[11px] text-[var(--muted)] mt-1 tabular-nums">
            → {fmtLong(newStart)}
          </div>
        </div>
        <div>
          <Label>New expiry</Label>
          <DateInput
            name="_new_expiry_display"
            value={newExpiry}
            onChange={(iso) => setNewExpiry(iso)}
          />
          <div className="text-[11px] text-[var(--muted)] mt-1 tabular-nums">
            → {fmtLong(newExpiry)}
          </div>
        </div>
      </div>

      <div>
        <Label>Notes for this cycle (optional)</Label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="e.g. issued at Kanim Denpasar"
          className={input}
        />
      </div>

      {error && <div className="text-[12px] text-red-700">{error}</div>}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onDone}
          className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-md hover:bg-[var(--surface-muted)]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="px-3 py-1.5 text-sm bg-brand text-white rounded-md hover:bg-brand-dark disabled:opacity-50"
        >
          {pending ? "Renewing…" : "Renew"}
        </button>
      </div>
    </form>
  );
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/* ============ helpers ============ */

const input =
  "w-full mt-1 px-2.5 py-1.5 bg-white border border-[var(--border)] rounded-lg text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10.5px] uppercase tracking-wider text-[var(--muted)] font-semibold">
      {children}
    </label>
  );
}

function fmt(v: string | null | undefined): string {
  if (!v) return "—";
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

// Unambiguous month-in-words format for anywhere date interpretation matters.
// "08/10/2026" is ambiguous (8 Oct or Oct 8?); "8 Oct 2026" is not.
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtLong(v: string | null | undefined): string {
  if (!v) return "—";
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return v;
  const [, y, mm, dd] = m;
  const monthIdx = parseInt(mm, 10) - 1;
  return `${parseInt(dd, 10)} ${MONTH_SHORT[monthIdx] ?? mm} ${y}`;
}

