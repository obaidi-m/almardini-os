"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return setError(error.message);
    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="bg-brand text-white p-14 flex flex-col justify-between relative overflow-hidden">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full border-2 border-white/90 flex items-center justify-center font-arabic text-4xl font-bold pb-1 relative">
            الم
            <span className="absolute top-3 right-4 w-2 h-2 bg-gold rounded-sm rotate-12" />
            <span className="absolute top-5 right-6 w-1.5 h-1.5 bg-gold rounded-sm" />
          </div>
          <div>
            <div className="font-arabic text-3xl text-gold font-bold">المارديني</div>
            <div className="font-arabic text-sm text-gold">للخدمات العامة</div>
            <div className="text-[11px] tracking-widest mt-1 font-medium">
              ALMARDINI INTERNATIONAL GROUP
            </div>
          </div>
        </div>

        <div>
          <h2 className="font-serif text-4xl leading-tight max-w-md">
            The internal control room for every case, client, and payment.
          </h2>
          <p className="text-white/70 text-sm mt-4">Jakarta · Bali · Batam</p>
        </div>

        <div className="text-xs tracking-widest text-white/60 uppercase">
          v0.1 · Admin preview
        </div>
      </div>

      <div className="flex items-center justify-center p-10 bg-[var(--bg)]">
        <form onSubmit={handleSubmit} className="w-full max-w-sm">
          <h1 className="font-serif text-3xl text-ink mb-1">Sign in</h1>
          <p className="text-muted-foreground text-[var(--muted)] mb-8">
            Use your Almardini team account.
          </p>

          <label className="block text-xs font-medium text-[var(--muted)] mb-1.5 uppercase tracking-wide">
            Email
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
            Password
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
            {loading ? "Signing in…" : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
