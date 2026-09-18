import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { getLocale } from "@/lib/i18n/server";
import { LocaleProvider } from "@/lib/i18n/client";
import { DetailsAutoClose } from "@/components/app/DetailsAutoClose";
import { ConfirmProvider } from "@/components/ui/ConfirmProvider";
import { FeedbackWidget } from "@/components/app/FeedbackWidget";
import { FilterMemory } from "@/components/app/FilterMemory";

export const metadata: Metadata = {
  title: "Almardini · Operations",
  description: "Internal operations system for Almardini International Group",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body>
        <LocaleProvider locale={locale}>
          <ConfirmProvider>{children}</ConfirmProvider>
        </LocaleProvider>
        <DetailsAutoClose />
        <FeedbackWidget />
        <Suspense fallback={null}>
          <FilterMemory />
        </Suspense>
      </body>
    </html>
  );
}
