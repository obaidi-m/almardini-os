"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/client";
import { clearFilterMemory } from "@/components/app/FilterMemory";

export default function LoginPage() {
  const { t } = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Any prior tab's remembered filters shouldn't leak into a fresh session.
  useEffect(() => { clearFilterMemory(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      return setError(error.message);
    }
    // Only accept an internal path (starts with "/", not "//") as a redirect
    // target — never trust an absolute URL from the query string.
    const next = searchParams.get("next");
    const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    router.push(safeNext);
    router.refresh();
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="bg-brand text-white p-14 flex flex-col justify-between relative overflow-hidden">
        <div>
          <img
            src="/logo.jpeg"
            alt="Almardini International Group"
            className="h-32 w-auto object-contain"
          />
        </div>

        <div>
          <h2 className="font-serif text-4xl leading-tight max-w-md">
            The operating system for the business.
          </h2>
          <p className="text-white/70 text-sm mt-4">Jakarta · Bali · Batam</p>
        </div>

        <div className="text-xs tracking-widest text-white/60 uppercase">
          v0.1
        </div>
      </div>

      <div className="flex items-center justify-center p-10 bg-[var(--bg)]">
        <form onSubmit={handleSubmit} className="w-full max-w-sm">
          <h1 className="font-serif text-3xl text-ink mb-1">{t("login.title")}</h1>
          <p className="text-muted-foreground text-[var(--muted)] mb-8">
            {t("login.subtitle")}
          </p>

          <label className="block text-xs font-medium text-[var(--muted)] mb-1.5 uppercase tracking-wide">
            {t("login.email")}
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2.5 border border-[var(--border)] rounded-lg bg-white text-sm mb-4 focus:outline-brand focus:border-brand"
            placeholder="name@almardini.id"
          />

          <label className="block text-xs font-medium text-[var(--muted)] mb-1.5 uppercase tracking-wide">
            {t("login.password")}
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2.5 border border-[var(--border)] rounded-lg bg-white text-sm mb-6 focus:outline-brand focus:border-brand"
          />

          {error && (
            <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-ink text-[var(--bg)] rounded-lg font-medium text-sm hover:opacity-90 disabled:opacity-50"
            style={{ background: "#141618", color: "#FAF7F1" }}
          >
            {loading ? (
              <span className="inline-flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="opacity-25"
                  />
                  <path
                    d="M22 12a10 10 0 0 1-10 10"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
                {t("login.signing_in")}
              </span>
            ) : (
              t("login.submit")
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
