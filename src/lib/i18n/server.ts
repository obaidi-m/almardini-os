import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { translate, type Locale, type MessageKey } from "./messages";

const LOCALE_COOKIE = "almardini-lang";

/** Resolve the active locale for the current request.
 *  Precedence: URL-set cookie > user's stored `users.language` > 'en'. */
export async function getLocale(): Promise<Locale> {
  const c = cookies().get(LOCALE_COOKIE)?.value;
  if (c === "en" || c === "id") return c;

  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return "en";
    const { data } = await supabase.from("users").select("language").eq("id", user.id).single();
    const lang = data?.language;
    if (lang === "en" || lang === "id") return lang;
  } catch {
    // fall through
  }
  return "en";
}

/** Server-side translator bound to the current request's locale. */
export async function getT() {
  const locale = await getLocale();
  return {
    locale,
    t: (key: MessageKey, vars?: Record<string, string | number>) => translate(locale, key, vars),
  };
}

export const LOCALE_COOKIE_NAME = LOCALE_COOKIE;
