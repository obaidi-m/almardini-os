// Rebuilt at most every 60s per path — actions call revalidatePath
// to bust it immediately on mutations.
export const revalidate = 60;

import { createClient } from "@/lib/supabase/server";
import { NewServiceForm } from "./NewServiceForm";
import { ServiceRow } from "./ServiceRow";
import { CategoryManager } from "./CategoryManager";
import type { ServiceCategory, ServiceType } from "@/lib/types";

export default async function ServicesPage() {
  const supabase = createClient();

  const [{ data: services }, { data: cats }] = await Promise.all([
    supabase
      .from("service_types")
      .select("*, category:service_categories(id, code, name, sort_order)")
      .order("sort_order")
      .order("name"),
    supabase.from("service_categories").select("*").order("sort_order"),
  ]);

  const list = (services ?? []) as unknown as ServiceType[];
  const categories = (cats ?? []) as ServiceCategory[];

  const grouped = categories.map((c) => ({
    category: c,
    items: list.filter((s) => s.category_id === c.id),
  }));

  return (
    <div>
      <div className="flex items-end justify-between mb-7">
        <div>
          <h1 className="font-serif text-[26px] text-ink">Service catalog</h1>
          <p className="text-[var(--muted)] mt-1 max-w-xl">
            Every visa type, PT PMA package, and reporting service Almardini offers. Add
            or edit without touching code.
          </p>
        </div>
      </div>

      <CategoryManager
        categories={categories}
        counts={new Map(categories.map((c) => [c.id, list.filter((s) => s.category_id === c.id).length]))}
      />

      <div className="bg-[var(--surface)] border-2 border-brand rounded-[10px] p-6 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-6 h-6 rounded-full bg-brand text-white flex items-center justify-center text-sm font-bold">+</span>
          <div className="text-[13px] font-semibold text-ink">Add a new service</div>
        </div>
        {categories.length === 0 ? (
          <div className="text-sm text-[var(--muted)]">Add a category first — services must belong to one.</div>
        ) : (
          <NewServiceForm categories={categories} />
        )}
      </div>

      <div className="flex flex-col gap-4">
        {grouped.map(({ category, items }) => (
          <div key={category.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--border)] flex items-center justify-between">
              <h2 className="font-serif text-[16px] text-ink">{category.name}</h2>
              <span className="text-xs text-[var(--muted)]">
                {items.length} service{items.length === 1 ? "" : "s"}
              </span>
            </div>
            {items.length === 0 ? (
              <div className="px-5 py-6 text-sm text-[var(--muted)] text-center">
                No services in this category yet.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--muted)] bg-[var(--bg)] border-b border-[var(--border)]">
                    <th className="px-5 py-2.5 font-semibold">Code</th>
                    <th className="px-5 py-2.5 font-semibold">Service</th>
                    <th className="px-5 py-2.5 font-semibold">Status</th>
                    <th className="px-5 py-2.5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((s) => <ServiceRow key={s.id} service={s} categories={categories} />)}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
