"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { DateInput } from "@/components/ui/DateInput";
import { NATIONALITIES } from "@/lib/nationalities";
import { createPermitWithClientAction } from "./actions";

type ClientOpt = { id: string; code: string; full_name: string };
type ServiceOpt = { id: string; code: string | null; name: string };
type PartnerOpt = { id: string; code: string; name: string };

export function NewPermitButton({
  clients, services, partners,
}: {
  clients: ClientOpt[];
  services: ServiceOpt[];
  partners: PartnerOpt[];
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
            onDone={() => setOpen(false)}
          />
        )}
      </Modal>
    </>
  );
}

function NewPermitForm({
  clients, services, partners, onDone,
}: {
  clients: ClientOpt[];
  services: ServiceOpt[];
  partners: PartnerOpt[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [pickedClient, setPickedClient] = useState<ClientOpt | null>(null);
  const [nameQuery, setNameQuery] = useState("");
  const [passport, setPassport] = useState("");
  const [nationality, setNationality] = useState("");

  return (
    <form
      action={(fd) => {
        setError(null);
        if (pickedClient) fd.set("client_id", pickedClient.id);
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
      <datalist id="np-nationalities">
        {NATIONALITIES.map((n) => <option key={n} value={n} />)}
      </datalist>

      <Section title="Person">
        {pickedClient ? (
          <Row label="Client">
            <div className="flex items-center gap-2">
              <span className="text-[13.5px] text-ink font-medium">{pickedClient.full_name}</span>
              <span className="font-mono text-[11px] text-brand-dark bg-brand-softer px-1.5 py-0.5 rounded">{pickedClient.code}</span>
              <button
                type="button"
                onClick={() => setPickedClient(null)}
                className="ml-auto text-[11.5px] text-[var(--muted)] hover:text-red-700"
              >
                Change
              </button>
            </div>
          </Row>
        ) : (
          <>
            <Row label="Full name" required>
              <ClientCombobox
                value={nameQuery}
                onQueryChange={setNameQuery}
                onPick={(c) => { setPickedClient(c); setNameQuery(""); }}
                options={clients}
              />
              {/* Hidden field so the server action sees the typed name when
                  no existing client was picked. */}
              <input type="hidden" name="full_name" value={nameQuery} />
            </Row>
            <Row label="Passport no." required>
              <input
                name="passport_no"
                value={passport}
                onChange={(e) => setPassport(e.target.value)}
                required
                placeholder="e.g. AB1234567"
                className={cellInput + " font-mono uppercase"}
              />
            </Row>
            <Row label="Nationality">
              <input
                name="nationality"
                list="np-nationalities"
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
                placeholder="e.g. Yemen"
                autoComplete="off"
                className={cellInput}
              />
            </Row>
          </>
        )}
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
        <Row label="Responsible (PJ)">
          <select name="responsible_partner_id" defaultValue="" className={cellInput + " bg-transparent"}>
            <option value="">—</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
            ))}
          </select>
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
  );
}

function ClientCombobox({
  value, onQueryChange, onPick, options,
}: {
  value: string;
  onQueryChange: (v: string) => void;
  onPick: (c: ClientOpt) => void;
  options: ClientOpt[];
}) {
  const [open, setOpen] = useState(false);
  const q = value.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return options.slice(0, 8);
    return options
      .filter((c) => c.full_name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
      .slice(0, 8);
  }, [options, q]);

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => { onQueryChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Type a new name, or search existing…"
        className={cellInput}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-10 left-0 right-0 mt-1 max-h-56 overflow-auto bg-white border border-[var(--border)] rounded-md shadow-sm">
          <div className="px-2 py-1.5 text-[10.5px] uppercase tracking-widest text-[var(--muted)] font-semibold">
            Existing clients
          </div>
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onPick(c); setOpen(false); }}
              className="w-full text-left px-2 py-1.5 text-[12.5px] hover:bg-[var(--surface-2)] flex items-center gap-2"
            >
              <span className="truncate">{c.full_name}</span>
              <span className="font-mono text-[10.5px] text-brand-dark bg-brand-softer px-1.5 py-0.5 rounded ml-auto shrink-0">
                {c.code}
              </span>
            </button>
          ))}
          {value.trim() && (
            <div className="px-2 py-1.5 text-[11px] text-[var(--muted)] border-t border-[var(--border)]">
              Or press Create permit to add <span className="text-ink font-medium">{value.trim()}</span> as a new client.
            </div>
          )}
        </div>
      )}
    </div>
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
