import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buildIlikeOr, escapeIlike } from "@/lib/search";
import type { CaseStatus } from "@/lib/types";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/messages";

const STATUS_COLORS: Record<CaseStatus, string> = {
  new: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-blue-100 text-blue-800",
  done: "bg-green-100 text-green-800",
  delivered: "bg-neutral-200 text-neutral-700",
};

export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = (searchParams.q ?? "").trim();
  const supabase = createClient();
  const { t } = await getT();

  const hasQuery = q.length >= 1;
  const textLike = `%${escapeIlike(q)}%`;

  // Look up service_type ids whose name matches, so cases attached to those
  // services show up even when the case's own code/title doesn't include the
  // service name (e.g. "LKPM" finds every quarterly filing).
  const svcIds: string[] = hasQuery
    ? (((await supabase
        .from("service_types")
        .select("id")
        .ilike("name", `%${escapeIlike(q)}%`)
        .limit(50)).data ?? []) as Array<{ id: string }>).map((r) => r.id)
    : [];

  const empty = { data: [] as unknown[] };
  const [clientsRes, companiesRes, casesByCodeRes, casesBySvcRes, partnersRes, updatesRes] = hasQuery
    ? await Promise.all([
        supabase
          .from("clients")
          .select("id, code, full_name, passport_no, phone, email")
          .is("deleted_at", null)
          .or(buildIlikeOr(["full_name", "passport_no", "phone", "email", "code"], q))
          .limit(15),
        supabase
          .from("companies")
          .select("id, code, name, nib")
          .is("deleted_at", null)
          .or(buildIlikeOr(["name", "nib", "code"], q))
          .limit(15),
        supabase
          .from("cases")
          .select("id, code, title, status, client:clients(id, full_name), service:service_types(id, name)")
          .is("deleted_at", null)
          .or(buildIlikeOr(["code", "title"], q))
          .limit(15),
        svcIds.length > 0
          ? supabase
              .from("cases")
              .select("id, code, title, status, client:clients(id, full_name), service:service_types(id, name)")
              .is("deleted_at", null)
              .in("service_type_id", svcIds)
              .order("updated_at", { ascending: false })
              .limit(15)
          : Promise.resolve({ data: [] as unknown[] }),
        supabase
          .from("partners")
          .select("id, code, name, contact_person, phone, email")
          .is("deleted_at", null)
          .or(buildIlikeOr(["name", "contact_person", "phone", "email", "code"], q))
          .limit(15),
        supabase
          .from("case_updates")
          .select("id, text, created_at, case:cases!inner(id, code, title, client:clients(id, full_name))")
          .ilike("text", textLike)
          .order("created_at", { ascending: false })
          .limit(15),
      ])
    : [empty, empty, empty, empty, empty, empty];

  const unwrap = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

  const clients = (clientsRes.data ?? []) as Array<{ id: string; code: string; full_name: string; passport_no: string | null; phone: string | null; email: string | null }>;
  const companies = (companiesRes.data ?? []) as Array<{ id: string; code: string; name: string; nib: string | null }>;
  const partners = (partnersRes.data ?? []) as Array<{ id: string; code: string; name: string; contact_person: string | null; phone: string | null; email: string | null }>;
  const casesRaw = [
    ...((casesByCodeRes.data ?? []) as unknown[]),
    ...((casesBySvcRes.data ?? []) as unknown[]),
  ];
  const casesSeen = new Set<string>();
  const cases: Array<{ id: string; code: string; title: string | null; status: CaseStatus; client: { id: string; full_name: string } | null; service: { id: string; name: string } | null }> = [];
  for (const r of casesRaw) {
    const rr = r as { id: string; code: string; title: string | null; status: CaseStatus; client: { id: string; full_name: string }[] | { id: string; full_name: string } | null; service: { id: string; name: string }[] | { id: string; name: string } | null };
    if (casesSeen.has(rr.id)) continue;
    casesSeen.add(rr.id);
    cases.push({ ...rr, client: unwrap(rr.client), service: unwrap(rr.service) });
  }
  const updates = ((updatesRes.data ?? []) as unknown[]).map((r) => {
    const rr = r as { id: string; text: string; created_at: string; case: { id: string; code: string; title: string | null; client: { id: string; full_name: string }[] | { id: string; full_name: string } | null }[] | { id: string; code: string; title: string | null; client: { id: string; full_name: string }[] | { id: string; full_name: string } | null } | null };
    const c = unwrap(rr.case);
    return { id: rr.id, text: rr.text, created_at: rr.created_at, case: c ? { ...c, client: unwrap(c.client) } : null };
  });

  const total = clients.length + companies.length + cases.length + partners.length + updates.length;

  return (
    <div>
      <h1 className="text-[26px] font-semibold text-ink tracking-tight mb-4">{t("search.title")}</h1>

      <form className="mb-6" action="/search">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">
            <SearchIcon />
          </span>
          <input
            name="q"
            defaultValue={q}
            autoFocus
            placeholder={t("search.placeholder_full")}
            className="w-full pl-10 pr-3 py-2.5 text-[14px] bg-white border border-[var(--border)] rounded-md focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </div>
      </form>

      {!hasQuery && (
        <p className="text-[13px] text-[var(--muted)]">{t("search.type_to_search")}</p>
      )}

      {hasQuery && total === 0 && (
        <p className="text-[13px] text-[var(--muted)]">
          {t("search.no_results_for", { q: `"${q}"` })}
        </p>
      )}

      {hasQuery && total > 0 && (
        <div className="space-y-8">
          {clients.length > 0 && (
            <Group title={t("search.group.clients", { n: clients.length })}>
              {clients.map((c) => (
                <Row key={c.id} href={`/clients/${c.id}`} code={c.code}
                  title={c.full_name}
                  hint={[c.passport_no, c.phone, c.email].filter(Boolean).join(" · ")} />
              ))}
            </Group>
          )}
          {companies.length > 0 && (
            <Group title={t("search.group.companies", { n: companies.length })}>
              {companies.map((co) => (
                <Row key={co.id} href={`/companies/${co.id}`} code={co.code}
                  title={co.name}
                  hint={co.nib ? `NIB ${co.nib}` : undefined} />
              ))}
            </Group>
          )}
          {cases.length > 0 && (
            <Group title={t("search.group.cases", { n: cases.length })}>
              {cases.map((cs) => (
                <Row
                  key={cs.id}
                  href={`/cases/${cs.id}`}
                  code={cs.code}
                  title={cs.title || cs.service?.name || t("search.untitled_case")}
                  hint={[cs.service?.name, cs.client?.full_name].filter(Boolean).join(" · ") || undefined}
                  badge={<span className={`text-[10.5px] font-medium px-1.5 py-0.5 rounded ${STATUS_COLORS[cs.status]}`}>{t(`status.${cs.status}` as MessageKey)}</span>}
                />
              ))}
            </Group>
          )}
          {partners.length > 0 && (
            <Group title={t("search.group.partners", { n: partners.length })}>
              {partners.map((p) => (
                <Row key={p.id} href={`/partners/${p.id}`} code={p.code}
                  title={p.name}
                  hint={[p.contact_person, p.phone, p.email].filter(Boolean).join(" · ")} />
              ))}
            </Group>
          )}
          {updates.length > 0 && (
            <Group title={t("search.group.notes", { n: updates.length })}>
              {updates.map((u) => (
                <Link
                  key={u.id}
                  href={`/cases/${u.case?.id ?? ""}`}
                  className="block py-2.5 border-b border-[var(--border)] hover:bg-[var(--surface-muted)] px-2 -mx-2 rounded-md"
                >
                  <div className="text-[13.5px] text-ink whitespace-pre-wrap line-clamp-2">
                    {highlight(u.text, q)}
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-[var(--muted)]">
                    <span className="font-mono">{u.case?.code}</span>
                    {u.case?.client?.full_name && <span> · {u.case.client.full_name}</span>}
                    <span> · {fmtDateTime(u.created_at)}</span>
                  </div>
                </Link>
              ))}
            </Group>
          )}
        </div>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="text-[10.5px] uppercase tracking-widest text-[var(--muted)] font-semibold mb-2">{title}</div>
      <div className="border-t border-[var(--border)]">{children}</div>
    </section>
  );
}

function Row({ href, code, title, hint, badge }: { href: string; code: string; title: string; hint?: string; badge?: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="grid grid-cols-[92px_1fr_auto] gap-3 py-2.5 items-center hover:bg-[var(--surface-muted)] px-2 -mx-2 rounded-md border-b border-[var(--border)]"
    >
      <span className="font-mono text-[12px] text-[var(--muted)]">{code}</span>
      <span className="min-w-0">
        <span className="text-[13.5px] text-ink font-medium truncate block">{title}</span>
        {hint && <span className="text-[11.5px] text-[var(--muted)] truncate block">{hint}</span>}
      </span>
      {badge}
    </Link>
  );
}

function highlight(text: string, q: string): React.ReactNode {
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return text;
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + q.length + 80);
  const before = (start > 0 ? "…" : "") + text.slice(start, idx);
  const match = text.slice(idx, idx + q.length);
  const after = text.slice(idx + q.length, end) + (end < text.length ? "…" : "");
  return (
    <>
      {before}
      <mark className="bg-yellow-100 text-ink rounded px-0.5">{match}</mark>
      {after}
    </>
  );
}

function fmtDateTime(v: string): string {
  try {
    const d = new Date(v);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${d.getFullYear()}`;
  } catch { return v; }
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}
