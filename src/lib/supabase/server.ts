import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieItem = { name: string; value: string; options?: CookieOptions };

export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(list: CookieItem[]) {
          try {
            list.forEach(({ name, value, options }: CookieItem) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — write is a no-op there.
          }
        },
      },
    },
  );
}
