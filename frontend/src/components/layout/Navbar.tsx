"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Logout03Icon } from "@hugeicons/core-free-icons";
import { AuthForm } from "@/components/forms/AuthForm";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { signOut as firebaseSignOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/firebase/auth-provider";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";

export function Navbar() {
  const t = useTranslations();
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isAuthenticated = !!user;
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const remainingCredits = 42;
  const profileInitial =
    user?.displayName?.trim().charAt(0) || user?.email?.trim().charAt(0) || "P";

  const handleSignOut = async () => {
    if (!auth) return;
    await firebaseSignOut(auth);
  };

  const handleProfileMenuChange = (value: string) => {
    if (value === "profile") {
      router.push("/profile");
      return;
    }

    if (value === "library") {
      router.push("/library");
    }
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-background/20 backdrop-blur-2xl border-b border-foreground/5 dark:border-white/5">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="relative h-7 w-7 overflow-hidden rounded-[9px] border border-foreground/10 bg-background/70 p-[3px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
              <Image
                src="/icons/PhanesLogo.svg"
                alt="Phanes logo"
                width={24}
                height={24}
                className="h-full w-full object-contain opacity-85 contrast-125 grayscale dark:hidden"
                priority
              />
              <Image
                src="/icons/PhanesLogo.svg"
                alt="Phanes logo"
                width={24}
                height={24}
                className="absolute inset-[3px] hidden h-[calc(100%-6px)] w-[calc(100%-6px)] object-contain invert opacity-90 contrast-125 grayscale dark:block"
                priority
              />
            </div>
            <span className="font-bold text-lg tracking-tight">
              {t("brand")}
            </span>
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
          {isAuthenticated ? (
            <>
              <div className="hidden sm:flex items-center rounded-full border border-foreground/10 bg-background/70 px-3 py-1.5 text-xs font-medium text-foreground/80 backdrop-blur-sm">
                {t("credits.remaining", { count: remainingCredits })}
              </div>
              <div className="hidden md:flex items-center gap-3">
                <Select onValueChange={handleProfileMenuChange}>
                  <SelectTrigger
                    hideIcon
                    className="flex min-h-14 items-center gap-3 rounded-2xl border border-foreground/10 bg-background/70 px-4 py-3 shadow-sm backdrop-blur-sm transition-colors hover:bg-foreground/5"
                    aria-label={t("actions.profile")}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
                      {profileInitial.toUpperCase()}
                    </div>
                    <div className="flex flex-col text-left text-xs text-foreground/70">
                      <span className="font-medium text-foreground/90">
                        {user?.displayName ||
                          user?.email ||
                          t("actions.profile")}
                      </span>
                      <span>{user?.email}</span>
                    </div>
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    align="end"
                    className="min-w-[220px]"
                  >
                    <SelectItem value="profile">
                      {t("actions.profileWorkspace")}
                    </SelectItem>
                    <SelectItem value="library">
                      {t("actions.library")}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleSignOut}
                  className="h-8 w-8 rounded-full border border-foreground/10 p-0 hover:bg-foreground/5"
                  aria-label={t("actions.logout")}
                >
                  <HugeiconsIcon
                    icon={Logout03Icon}
                    strokeWidth={2}
                    className="size-4"
                  />
                </Button>
              </div>
            </>
          ) : (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setAuthMode("login");
                setIsAuthModalOpen(true);
              }}
              className="hidden sm:inline-flex text-sm border-foreground/10 hover:bg-foreground/5 h-8 px-4 font-normal"
            >
              {t("actions.login")}
            </Button>
          )}
          {!isAuthenticated ? (
            <Button
              type="button"
              onClick={() => {
                setAuthMode("signup");
                setIsAuthModalOpen(true);
              }}
              className="h-8 px-4 rounded-md font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors"
            >
              {t("actions.getStarted")}
            </Button>
          ) : null}
          <ThemeToggle />
        </div>
      </nav>
      <AuthForm
        isOpen={isAuthModalOpen}
        defaultMode={authMode}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </>
  );
}
