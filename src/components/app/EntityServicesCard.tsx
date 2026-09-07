"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type { EntityService, EntityServiceStatus, ServiceType } from "@/lib/types";
import { Modal } from "@/components/ui/Modal";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import {
  createEntityServiceAction,
  updateEntityServiceAction,
  deleteEntityServiceAction,
} from "@/app/entity-services/actions";

type CatalogService = Pick<
  ServiceType,
  "id" | "code" | "name" | "applies_to" | "tracks_expiry" | "is_ongoing"
>;

type CompanyOpt = { id: string; code: string; name: string };
type PartnerOpt = { id: string; code: string; name: string };

type Owner = { kind: "client"; id: string } | { kind: "company"; id: string };

export function EntityServicesCard({
  owner, services, catalog, companies = [], partners = [],
}: {
  owner: Owner;
  services: EntityService[];
  catalog: CatalogService[];
  companies?: CompanyOpt[];
  partners?: PartnerOpt[];
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<EntityService | null>(null);

  // Filter catalog to what can apply to this owner.
  const availableCatalog = useMemo(
    () =>
      catalog.filter((c) =>
        c.applies_to === "either"
          ? true
          : owner.kind === "client"
          ? c.applies_to === "person"
          : c.applies_to === "company",
      ),
    [catalog, owner.kind],
  );

  const active = services.filter((s) => s.status === "active");
  const other  = services.filter((s) => s.status !== "active");

  return (
    <section className="bg-surface rounded-2xl shadow-[0_1px_3px_rgba(15,31,29,0.06),0_8px_24px_-6px_rgba(15,31,29,0.10)] p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-baseline gap-2">
          <h3 className="font-serif text-[15px] text-ink leading-none">Services</h3>
          <span className="text-[11.5px] text-[var(--muted)] font-medium">{active.length} active</span>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="text-[12px] font-medium text-brand hover:text-brand-dark"
        >
          + Add
        </button>
      </div>

      {services.length === 0 ? (
        <p className="text-[12.5px] text-[var(--muted)]">
          Nothing subscribed yet.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border)] -mx-1">
          {[...active, ...other].map((row) => (
            <li key={row.id}>
              <ServiceRow row={row} onEdit={() => setEditing(row)} />
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Add service"
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
        title="Edit service"
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
    </section>
  );
}

/* ============ Row ============ */

function ServiceRow({ row, onEdit }: { row: EntityService; onEdit: () => void }) {
  const [pending, start] = useTransition();
  const confirm = useConfirm();
  const svc = row.service;
  const label = svc?.name ?? "Service";

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
              {row.term_months}mo term
            </span>
          )}
          <StatusPill status={row.status} />
        </div>
        <div className="text-[11.5px] text-[var(--muted)] mt-0.5">
          <DateLine row={row} />
          {row.responsible && (
            <> · PJ:{" "}
              <Link href={`/partners/${row.responsible.id}`} className="hover:text-brand">
                {row.responsible.name}
              </Link>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="text-[11.5px] text-[var(--muted)] hover:text-ink"
        >
          edit
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={async () => {
            const ok = await confirm({
              title: "Delete subscription",
              message: `Delete this ${row.service?.name ?? "service"}?`,
              confirmLabel: "Delete",
              tone: "danger",
            });
            if (!ok) return;
            const fd = new FormData(); fd.set("id", row.id);
            start(async () => { await deleteEntityServiceAction(fd); });
          }}
          className="text-[11.5px] text-[var(--muted)] hover:text-red-700"
        >
          delete
        </button>
      </div>
    </div>
  );
}

function DateLine({ row }: { row: EntityService }) {
  const svc = row.service;
  if (svc?.is_ongoing) {
    if (row.started_date) return <>since {fmt(row.started_date)}</>;
    return <>ongoing</>;
  }
  if (svc?.tracks_expiry) {
    const parts: string[] = [];
    if (row.issued_date || row.started_date) parts.push(fmt(row.issued_date ?? row.started_date));
    if (row.expires_date) parts.push(`→ ${fmt(row.expires_date)}`);
    const daysLeft = daysUntil(row.expires_date);
    return (
      <>
        {parts.join(" ")}
        {daysLeft !== null && row.status === "active" && (
          <> · in {daysLeft}d</>
        )}
      </>
    );
  }
  return <>—</>;
}

function StatusPill({ status }: { status: EntityServiceStatus }) {
  const styles: Record<EntityServiceStatus, string> = {
    active:     "bg-[#DCFCE7] text-[#166534]",
    expired:    "bg-[#FEF3C7] text-[#92400E]",
    terminated: "bg-[var(--surface-2)] text-[var(--muted)]",
    paused:     "bg-[#DBEAFE] text-[#1E40AF]",
  };
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0 rounded-full ${styles[status]}`}>
      <span className="w-1 h-1 rounded-full bg-current" />
      {status}
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
        No services available for this{" "}
        {owner.kind === "client" ? "person" : "company"}. Add one under{" "}
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
        <Label>Service</Label>
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
            <Label>{svc.applies_to === "company" ? "Start date" : "Issued date"}</Label>
            <input
              type="date"
              name={svc.applies_to === "company" ? "started_date" : "issued_date"}
              defaultValue={
                svc.applies_to === "company"
                  ? initial?.started_date ?? ""
                  : initial?.issued_date ?? ""
              }
              className={input}
            />
          </div>
          <div>
            <Label>End date</Label>
            <input
              type="date"
              name="expires_date"
              defaultValue={initial?.expires_date ?? ""}
              className={input}
              required
            />
          </div>
        </div>
      )}

      {svc?.is_ongoing && (
        <div>
          <Label>Subscribed since (optional)</Label>
          <input
            type="date"
            name="started_date"
            defaultValue={initial?.started_date ?? ""}
            className={input}
          />
        </div>
      )}

      {/* VO-shaped extras — offered only when service is company + tracks_expiry
          and looks like a VO. Simple heuristic: name mentions "office". */}
      {svc?.applies_to === "company" && svc.tracks_expiry &&
        svc.name.toLowerCase().includes("office") && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Tier</Label>
            <select name="tier" defaultValue={initial?.tier ?? "silver"} className={input}>
              <option value="silver">Silver</option>
              <option value="gold">Gold</option>
              <option value="platinum">Platinum</option>
              <option value="bronze">Bronze</option>
            </select>
          </div>
          <div>
            <Label>Term (months)</Label>
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
        <Label>Status</Label>
        <select name="status" defaultValue={initial?.status ?? "active"} className={input}>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="terminated">Terminated</option>
          <option value="paused">Paused</option>
        </select>
      </div>

      {/* Sponsor only makes sense on person subs (KITAS under a PT). */}
      {owner.kind === "client" && (
        <div>
          <Label>Sponsor company (optional)</Label>
          <select
            name="sponsor_company_id"
            defaultValue={initial?.sponsor_company_id ?? ""}
            className={input}
          >
            <option value="">—</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <Label>Responsible partner (optional)</Label>
        <select
          name="responsible_partner_id"
          defaultValue={initial?.responsible_partner_id ?? ""}
          className={input}
        >
          <option value="">—</option>
          {partners.map((p) => (
            <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
          ))}
        </select>
      </div>

      <div>
        <Label>OneDrive folder (optional)</Label>
        <input
          type="url"
          name="drive_folder_url"
          defaultValue={initial?.drive_folder_url ?? ""}
          placeholder="https://…"
          className={input}
        />
      </div>

      <div>
        <Label>Notes (optional)</Label>
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
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="px-3 py-1.5 text-[13px] font-medium bg-ink text-[var(--bg)] rounded-lg hover:opacity-90 disabled:opacity-50"
        >
          {mode === "create" ? "Add" : "Save"}
        </button>
      </div>
    </form>
  );
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

function daysUntil(v: string | null): number | null {
  if (!v) return null;
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const target = new Date(`${v}T00:00:00Z`).getTime();
  const today = new Date();
  const utcMidnight = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((target - utcMidnight) / 86400000);
}
