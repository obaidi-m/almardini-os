"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { DateInput } from "@/components/ui/DateInput";
import { Combobox, type ComboOption } from "@/components/ui/Combobox";
import { NATIONALITIES } from "@/lib/nationalities";
import { createClientQuickAction } from "@/app/clients/actions";
import { createPermitWithClientAction } from "./actions";

type ClientOpt = { id: string; code: string; full_name: string };
type ServiceOpt = { id: string; code: string | null; name: string };
type PartnerOpt = { id: string; code: string; name: string };
type CompanyOpt = { id: string; code: string; name: string };

export function NewPermitButton({
  clients, services, partners, companies,
}: {
  clients: ClientOpt[];
  services: ServiceOpt[];
  partners: PartnerOpt[];
  companies: CompanyOpt[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 bg-brand hover:bg-brand-dark text-white text-[12.5px] font-medium px-3 py-1.5 rounded-lg shadow-sm"
      >
        <span className="text-[14px] leading-none">+</span>
        New permit
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="New permit" size="xl">
        {open && (
          <NewPermitForm
            clients={clients}
            services={services}
            partners={partners}
            companies={companies}
            onDone={() => setOpen(false)}
          />
        )}
      </Modal>
    </>
  );
}

function NewPermitForm({
  clients, services, partners, companies, onDone,
}: {
  clients: ClientOpt[];
  services: ServiceOpt[];
  partners: PartnerOpt[];
  companies: CompanyOpt[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Local mirror of clients so the "+ New client" quick-add can splice the
  // fresh row in and preselect it without a full-page reload — same trick
  // CaseForm uses.
  const [clientList, setClientList] = useState<ClientOpt[]>(clients);
  const [pickedClientId, setPickedClientId] = useState<string>("");
  const [addingClient, setAddingClient] = useState(false);

  const pickedClient = useMemo(
    () => clientList.find((c) => c.id === pickedClientId) ?? null,
    [clientList, pickedClientId],
  );

  const clientOptions: ComboOption[] = useMemo(
    () => clientList.map((c) => ({ id: c.id, label: c.full_name, hint: c.code })),
    [clientList],
  );

  // Unified guarantor list: companies + partners in one searchable dropdown.
  // The id keeps the "company:<uuid>" / "partner:<uuid>" prefix the server
  // action already expects, so nothing changes on the backend side.
  const guarantorOptions: ComboOption[] = useMemo(() => {
    const co: ComboOption[] = companies.map((c) => ({
      id: `company:${c.id}`,
      label: c.name,
      hint: c.code,
      keywords: "company",
    }));
    const pj: ComboOption[] = partners.map((p) => ({
      id: `partner:${p.id}`,
      label: `${p.name} (PJ)`,
      hint: p.code,
      keywords: "partner pj legacy",
    }));
    return [...co, ...pj];
  }, [companies, partners]);

  return (
    <>
    <form
      action={(fd) => {
        setError(null);
        start(async () => {
          try {
            const { clientId } = await createPermitWithClientAction(fd);
            router.push(`/clients/${clientId}`);
            router.refresh();
            onDone();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Failed");
          }
        });
      }}
    >
      <Section title="Person">
        <Row label="Client" required>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <Combobox
                key={pickedClientId || "empty"}
                name="client_id"
                options={clientOptions}
                defaultValue={pickedClientId}
                placeholder="Search existing clients…"
                required
                onChange={setPickedClientId}
              />
            </div>
            <button
              type="button"
              onClick={() => setAddingClient(true)}
              className="text-[11.5px] font-medium text-brand hover:text-brand-dark whitespace-nowrap shrink-0"
            >
              + New client
            </button>
          </div>
          {pickedClient && (
            <div className="mt-1 text-[11.5px] text-[var(--muted)]">
              <span className="font-mono text-brand-dark bg-brand-softer px-1.5 py-0.5 rounded">{pickedClient.code}</span>
              <span className="ml-2">{pickedClient.full_name}</span>
            </div>
          )}
        </Row>
      </Section>

      <Section title="Permit">
        <Row label="Service" required>
          <select name="service_id" required className={cellInput + " bg-transparent"} defaultValue="">
            <option value="" disabled>Pick a service…</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.code ? `${s.name} (${s.code})` : s.name}</option>
            ))}
          </select>
        </Row>
        <div className="grid grid-cols-2 gap-3">
          <Row label="Issued date">
            <DateInput name="issued_date" />
          </Row>
          <Row label="End date" required>
            <DateInput name="expires_date" />
          </Row>
        </div>
        <Row label="Guarantor">
          <Combobox
            name="guarantor"
            options={guarantorOptions}
            defaultValue=""
            placeholder="Search company or partner…"
            emptyLabel="— (none) —"
            allowEmpty
          />
        </Row>
        <Row label="Notes" align="start">
          <textarea name="notes" rows={2} className={cellInput + " resize-y"} />
        </Row>
      </Section>

      {error && (
        <div className="mt-3 text-[12.5px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>
      )}

      <div className="flex items-center justify-end gap-2 pt-4">
        <button
          type="button"
          onClick={onDone}
          className="px-3 py-1.5 text-[13px] text-[var(--muted)] hover:text-ink rounded-md"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="px-3.5 py-1.5 text-[13px] font-medium bg-ink text-white rounded-md hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Create permit"}
        </button>
      </div>
    </form>

    <Modal open={addingClient} onClose={() => setAddingClient(false)} title="New client" size="md">
      {addingClient && (
        <QuickClientForm
          onSaved={(c) => {
            setClientList((prev) => [{ id: c.id, code: c.code, full_name: c.full_name }, ...prev]);
            setPickedClientId(c.id);
            setAddingClient(false);
          }}
          onCancel={() => setAddingClient(false)}
        />
      )}
    </Modal>
    </>
  );
}

function QuickClientForm({
  onSaved, onCancel,
}: {
  onSaved: (c: { id: string; code: string; full_name: string }) => void;
  onCancel: () => void;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      action={(fd) => {
        setErr(null);
        start(async () => {
          try {
            const created = await createClientQuickAction(fd);
            if ("error" in created) { setErr(created.error); return; }
            onSaved(created);
          } catch (e) {
            setErr(e instanceof Error ? e.message : "Failed");
          }
        });
      }}
      className="space-y-3"
    >
      <datalist id="qcp-nationalities">
        {NATIONALITIES.map((n) => <option key={n} value={n} />)}
      </datalist>
      <Row label="Full name" required>
        <input name="full_name" required autoFocus placeholder="e.g. Ahmed Al Yamani" className={cellInput} />
      </Row>
      <Row label="Passport no.">
        <input name="passport_no" placeholder="e.g. BV31645" className={cellInput + " font-mono uppercase"} />
      </Row>
      <Row label="Nationality">
        <input name="nationality" list="qcp-nationalities" placeholder="e.g. Yemen" autoComplete="off" className={cellInput} />
      </Row>
      {err && (
        <div className="text-[12.5px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{err}</div>
      )}
      <div className="flex items-center justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-[13px] text-[var(--muted)] hover:text-ink rounded-md">
          Cancel
        </button>
        <button type="submit" disabled={pending} className="px-3.5 py-1.5 text-[13px] font-medium bg-brand hover:bg-brand-dark text-white rounded-md disabled:opacity-50">
          {pending ? "Saving…" : "Add client"}
        </button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="text-[10.5px] uppercase tracking-widest text-[var(--muted)] font-semibold mb-1">{title}</div>
      <div className="divide-y divide-[var(--border)] border-t border-[var(--border)]">{children}</div>
    </div>
  );
}

function Row({
  label, required, align = "center", children,
}: {
  label: string;
  required?: boolean;
  align?: "start" | "center";
  children: React.ReactNode;
}) {
  return (
    <div className={`grid grid-cols-[160px_1fr] gap-4 py-2 items-${align}`}>
      <div className="text-[12px] text-[var(--muted)] font-medium pt-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </div>
      <div>{children}</div>
    </div>
  );
}

const cellInput =
  "w-full px-2.5 py-1.5 bg-transparent border border-transparent rounded-md text-[13.5px] text-ink hover:border-[var(--border)] focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 placeholder:text-[var(--muted)]";
