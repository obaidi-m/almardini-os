import Image from "next/image";
import fs from "node:fs";
import path from "node:path";
import { LiveSearchBox } from "@/components/app/LiveSearchBox";
import { getT } from "@/lib/i18n/server";

function findLogo(): string | null {
  const dir = path.join(process.cwd(), "public");
  for (const ext of ["png", "svg", "jpg", "jpeg", "webp"]) {
    const file = path.join(dir, `logo.${ext}`);
    try {
      if (fs.existsSync(file)) return `/logo.${ext}`;
    } catch {
      // ignore
    }
  }
  return null;
}

export async function TopBanner() {
  const logo = findLogo();
  const { t } = await getT();

  return (
    <header className="bg-brand border-b-[2px] border-gold sticky top-0 z-30 h-[64px]">
      <div className="flex items-center gap-5 px-6 h-full">
        {logo ? (
          <Image
            src={logo}
            alt={t("banner.logo_alt")}
            width={200}
            height={48}
            priority
            className="h-11 w-auto object-contain"
          />
        ) : (
          <div className="w-11 h-11 flex items-center justify-center shrink-0">
            <LogoMark />
          </div>
        )}
        <div className="hidden md:flex items-baseline gap-2 min-w-0">
          <span className="text-white font-medium text-[17px] leading-none tracking-tight">
            {t("banner.operations")}
          </span>
          <span className="text-gold/90 text-[10px] font-semibold tracking-[.18em] uppercase">
            {t("banner.almardini_indonesia")}
          </span>
        </div>

        {/* Global search — searches clients, companies, cases, partners, and case notes */}
        <div className="ml-auto w-full max-w-[520px]">
          <LiveSearchBox
            variant="onBrand"
            placeholder={t("banner.search_placeholder")}
          />
        </div>
      </div>
    </header>
  );
}

function LogoMark() {
  return (
    <svg viewBox="0 0 100 100" className="w-11 h-11" aria-hidden="true">
      <rect x="30" y="14" width="9" height="9" rx="1" fill="#E8B54D" transform="rotate(20 34.5 18.5)" />
      <rect x="46" y="18" width="7" height="7" rx="1" fill="#E8B54D" />
      <rect x="35" y="34" width="8" height="8" rx="1" fill="#E8B54D" transform="rotate(-15 39 38)" />
      <text
        x="50"
        y="82"
        textAnchor="middle"
        fill="#FFFFFF"
        fontFamily="Amiri, serif"
        fontSize="60"
        fontWeight="700"
      >
        الم
      </text>
    </svg>
  );
}
