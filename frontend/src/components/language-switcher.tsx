"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/routing";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

const LOCALE_FLAGS: Record<string, string> = {
  en: "🇬🇧",
  de: "🇩🇪",
};

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleChange = (newLocale: string) => {
    router.push(pathname, { locale: newLocale });
  };

  return (
    <Select value={locale} onValueChange={handleChange}>
      <SelectTrigger
        hideIcon
        className="h-9 w-9 rounded-full border border-foreground/10 bg-background/70 px-0 py-0 text-sm shadow-sm backdrop-blur-sm hover:bg-foreground/5"
      >
        <span
          aria-hidden="true"
          className="flex h-full w-full items-center justify-center px-2 text-base leading-none"
        >
          {LOCALE_FLAGS[locale] ?? "🌐"}
        </span>
        <span className="sr-only">
          {locale === "de" ? "Deutsch" : "English"}
        </span>
      </SelectTrigger>
      <SelectContent
        position="popper"
        sideOffset={8}
        align="end"
        className="min-w-[140px] rounded-xl"
      >
        <SelectItem value="en">🇬🇧 English</SelectItem>
        <SelectItem value="de">🇩🇪 Deutsch</SelectItem>
      </SelectContent>
    </Select>
  );
}
