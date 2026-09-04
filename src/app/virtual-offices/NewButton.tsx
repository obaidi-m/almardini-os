"use client";
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { VOForm, type CompanyOption, type PartnerOption } from "@/components/app/VirtualOfficeCard";

export function NewVirtualOfficeButton({
  companies,
  partners = [],
}: {
  companies: CompanyOption[];
  partners?: PartnerOption[];
}) {
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  return (
    <>
      <button
        onClick={() => { setOpen(true); setFlash(null); }}
        className="inline-flex items-center gap-1.5 bg-brand hover:bg-brand-dark text-white text-[13px] font-medium px-3.5 py-2 rounded-lg shadow-[0_4px_12px_-4px_rgba(20,138,124,0.5)] transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M12 5v14M5 12h14" />
        </svg>
        New
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Add virtual office" size="lg">
        {flash && (
          <div className="mb-3 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
            {flash}
          </div>
        )}
        <VOForm
          mode="create"
          companies={companies}
          partners={partners}
          onDone={() => setOpen(false)}
          onError={setFlash}
        />
      </Modal>
    </>
  );
}
