"use client";
import { createContext, useContext } from "react";
import { translate, type Locale, type MessageKey } from "./messages";

const LocaleContext = createContext<Locale>("en");

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

export function useT() {
  const locale = useLocale();
  return {
    locale,
    t: (key: MessageKey, vars?: Record<string, string | number>) => translate(locale, key, vars),
  };
}
