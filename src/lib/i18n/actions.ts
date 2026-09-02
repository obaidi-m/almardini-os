"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { LOCALE_COOKIE_NAME } from "./server";
import type { Locale } from "./messages";

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function setLocaleAction(locale: Locale) {
  if (locale !== "en" && locale !== "id") throw new Error("Invalid locale.");

  cookies().set(LOCALE_COOKIE_NAME, locale, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
  });

  // Persist to the user's row so it survives across devices / browsers.
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await supabase.from("users").update({ language: locale }).eq("id", user.id);
  } catch {
    // Non-fatal — cookie still holds the choice for this device.
  }

  revalidatePath("/", "layout");
}
