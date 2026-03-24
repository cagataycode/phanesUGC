"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";

export function Navbar() {
  const t = useTranslations();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-background/20 backdrop-blur-2xl border-b border-foreground/5 dark:border-white/5">
      <div className="flex items-center gap-8">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/icons/PhanesLogo.svg"
            alt="Phanes logo"
            width={24}
            height={24}
            className="h-6 w-6"
            priority
          />
          <span className="font-bold text-lg tracking-tight">{t("brand")}</span>
        </Link>
        <div className="hidden lg:flex items-center gap-5 text-sm font-medium text-foreground/70 dark:text-foreground/80">
          <Link href="#" className="hover:text-foreground transition-colors">
            {t("links.pricing")}
          </Link>
          <Link href="#" className="hover:text-foreground transition-colors">
            {t("links.security")}
          </Link>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <LanguageSwitcher />
        <ThemeToggle />
        <Button
          variant="ghost"
          className="hidden sm:inline-flex text-sm border-foreground/10 hover:bg-foreground/5 h-8 px-4 font-normal"
        >
          {t("actions.login")}
        </Button>
        <Button className="h-8 px-4 rounded-md font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors">
          {t("actions.getStarted")}
        </Button>
      </div>
    </nav>
  );
}
