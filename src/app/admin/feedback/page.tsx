import { createClient } from "@/lib/supabase/server";
import { ResolveButton } from "./ResolveButton";

type FeedbackRow = {
  id: number;
  page_url: string | null;
  message: string;
  resolved: boolean;
  created_at: string;
  resolved_at: string | null;
  user: { full_name: string; email: string } | { full_name: string; email: string }[] | null;
};

type SearchParams = { filter?: "open" | "all" | "resolved" };

export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createClient();
  const filter = searchParams.filter ?? "open";

  let q = supabase
    .from("feedback")
    .select("id, page_url, message, resolved, created_at, resolved_at, user:users(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (filter === "open") q = q.eq("resolved", false);
  if (filter === "resolved") q = q.eq("resolved", true);

  const { data, error } = await q;
  const rows = (data ?? []) as FeedbackRow[];

  const tabs: { key: NonNullable<SearchParams["filter"]>; label: string }[] = [
    { key: "open", label: "Open" },
    { key: "resolved", label: "Resolved" },
    { key: "all", label: "All" },
  ];

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-baseline justify-between mb-4">
        <h1 className="text-2xl font-semibold text-ink">Feedback</h1>
        <div className="text-xs text-[var(--muted)]">
          {rows.length} {filter === "all" ? "total" : filter}
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {tabs.map((t) => (
          <a
            key={t.key}
            href={`/admin/feedback?filter=${t.key}`}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
              filter === t.key
                ? "bg-brand text-white border-brand"
                : "bg-white text-ink border-[var(--border)] hover:bg-[var(--surface-muted)]"
            }`}
          >
            {t.label}
          </a>
        ))}
      </div>

      {error && (
        <div className="text-red-600 text-sm mb-4">Error loading feedback: {error.message}</div>
      )}

      {rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted)]">
          Nothing here. When someone taps the Feedback button in the app, it lands here.
        </div>
      )}

      <div className="flex flex-col gap-2">
        {rows.map((row) => {
          const user = Array.isArray(row.user) ? row.user[0] : row.user;
          return (
            <div
              key={row.id}
              className={`rounded-xl border border-[var(--border)] p-3 ${
                row.resolved ? "bg-[var(--surface-muted)] opacity-70" : "bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] text-ink whitespace-pre-wrap">{row.message}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--muted)]">
                    <span>{user?.full_name ?? "unknown"}</span>
                    {row.page_url && (
                      <span className="font-mono truncate max-w-[240px]" title={row.page_url}>
                        {row.page_url}
                      </span>
                    )}
                    <span>{new Date(row.created_at).toLocaleString()}</span>
                  </div>
                </div>
                <ResolveButton id={row.id} resolved={row.resolved} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
