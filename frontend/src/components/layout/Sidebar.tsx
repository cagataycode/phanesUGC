"use client";

import { useState, useEffect, useCallback, useSyncExternalStore } from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  Home01Icon,
  Folder01Icon,
  PlayCircleIcon,
  User02Icon,
  Logout03Icon,
  Menu03Icon,
} from "@hugeicons/core-free-icons";
import { AuthForm } from "@/components/forms/AuthForm";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { signOut as firebaseSignOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/firebase/auth-provider";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const SIDEBAR_KEY = "sidebar-collapsed";

// useSyncExternalStore avoids hydration mismatch and React 19 setState-in-effect lint
const sidebarListeners: Set<() => void> = new Set();

function subscribeSidebar(listener: () => void) {
  sidebarListeners.add(listener);
  return () => sidebarListeners.delete(listener);
}

function getSidebarSnapshot(): boolean {
  return localStorage.getItem(SIDEBAR_KEY) === "true";
}

function getSidebarServerSnapshot(): boolean {
  return false;
}

function setSidebarCollapsed(collapsed: boolean) {
  localStorage.setItem(SIDEBAR_KEY, String(collapsed));
  sidebarListeners.forEach((l) => l());
}

function SidebarPanelIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M20.25 7c0-.69-.56-1.25-1.25-1.25H9.75v12.5H19c.69 0 1.25-.56 1.25-1.25zM3.75 17c0 .69.56 1.25 1.25 1.25h3.25V5.75H5c-.69 0-1.25.56-1.25 1.25zm18 0A2.75 2.75 0 0 1 19 19.75H5A2.75 2.75 0 0 1 2.25 17V7A2.75 2.75 0 0 1 5 4.25h14A2.75 2.75 0 0 1 21.75 7z" />
    </svg>
  );
}

export function Sidebar() {
  const t = useTranslations();
  const { user } = useAuth();
  const pathname = usePathname();
  const isAuthenticated = !!user;

  const isCollapsed = useSyncExternalStore(
    subscribeSidebar,
    getSidebarSnapshot,
    getSidebarServerSnapshot,
  );
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  const router = useRouter();
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setIsMobileOpen(false);
  }

  const remainingCredits = 42;
  const profileInitial =
    user?.displayName?.trim().charAt(0) || user?.email?.trim().charAt(0) || "P";

  const toggleCollapse = useCallback(() => {
    setSidebarCollapsed(!isCollapsed);
  }, [isCollapsed]);

  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = "hidden";
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") setIsMobileOpen(false);
      };
      document.addEventListener("keydown", handleKeyDown);
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "";
      };
    }
  }, [isMobileOpen]);

  const handleSignOut = async () => {
    if (!auth) return;
    await firebaseSignOut(auth);
  };

  const navItems = [
    {
      href: "/",
      labelKey: "links.home" as const,
      icon: Home01Icon,
      requireAuth: false,
    },
    {
      href: "/library",
      labelKey: "links.library" as const,
      icon: Folder01Icon,
      requireAuth: true,
    },
    {
      href: "/results/history",
      labelKey: "links.results" as const,
      icon: PlayCircleIcon,
      requireAuth: true,
    },
    {
      href: "/profile",
      labelKey: "links.profile" as const,
      icon: User02Icon,
      requireAuth: true,
    },
  ];

  const filteredNavItems = navItems.filter(
    (item) => !item.requireAuth || isAuthenticated,
  );

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  // ── Shared logo component ──
  const logoImage = (
    <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-[9px] border border-foreground/10 bg-background/70 p-[3px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
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
  );

  // ── Navigation link (works in both expanded and collapsed) ──
  const renderNavItem = (item: (typeof filteredNavItems)[number]) => {
    const navLink = (
      <Link
        href={item.href}
        className={cn(
          "group/nav flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer",
          "hover:bg-foreground/5",
          isActive(item.href)
            ? "bg-foreground/5 text-foreground"
            : "text-foreground/60 hover:text-foreground/90",
          isCollapsed && "md:justify-center md:px-0",
        )}
      >
        <HugeiconsIcon
          icon={item.icon as IconSvgElement}
          strokeWidth={1.8}
          className={cn(
            "size-5 shrink-0",
            isActive(item.href)
              ? "text-foreground"
              : "text-foreground/50 group-hover/nav:text-foreground/70",
          )}
        />
        <span
          className={cn(
            "truncate transition-opacity duration-200",
            isCollapsed && "md:hidden",
          )}
        >
          {t(item.labelKey)}
        </span>
      </Link>
    );

    // Show styled tooltip only when sidebar is collapsed
    if (isCollapsed) {
      return (
        <Tooltip key={item.href}>
          <TooltipTrigger asChild>{navLink}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={12}>
            {t(item.labelKey)}
          </TooltipContent>
        </Tooltip>
      );
    }

    return navLink;
  };

  // ── Sidebar content ──
  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* ── Header: Logo + Expand/Collapse button ── */}
      <div className="flex h-16 items-center justify-between border-b border-foreground/5 px-4">
        {/* Logo area: expanded shows logo+text, collapsed shows logo (swaps to expand btn on hover) */}
        {isCollapsed ? (
          /* Collapsed: Logo that swaps to expand button on hover */
          <Link
            href="/"
            className="relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-foreground/5"
          >
            {/* Logo: visible by default, hidden on sidebar hover */}
            <div className="transition-opacity duration-150 group-hover:opacity-0">
              {logoImage}
            </div>
            {/* Expand button: hidden by default, visible on sidebar hover */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleCollapse();
              }}
              className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-150 group-hover:opacity-100"
              aria-label={t("actions.expandSidebar")}
            >
              <SidebarPanelIcon className="size-5 text-foreground/60" />
            </button>
          </Link>
        ) : (
          /* Expanded: Logo + brand text + collapse button */
          <>
            <Link
              href="/"
              className="flex items-center gap-2.5 overflow-hidden"
            >
              {logoImage}
              <span className="font-bold text-lg tracking-tight whitespace-nowrap">
                {t("brand")}
              </span>
            </Link>
            <button
              type="button"
              onClick={toggleCollapse}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-foreground/40 hover:bg-foreground/5 hover:text-foreground/70 transition-colors"
              aria-label={t("actions.collapseSidebar")}
            >
              <SidebarPanelIcon className="size-4" />
            </button>
          </>
        )}
      </div>

      {/* ── Navigation Items ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-1">
          {filteredNavItems.map((item) => (
            <li key={item.href}>{renderNavItem(item)}</li>
          ))}
        </ul>
      </nav>

      {/* ── Bottom Section ── */}
      <div className="border-t border-foreground/5 px-3 py-3 space-y-2">
        {isAuthenticated ? (
          <>
            {/* User Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-foreground/5 outline-none cursor-pointer",
                    isCollapsed && "md:justify-center md:px-0",
                  )}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
                    {profileInitial.toUpperCase()}
                  </div>
                  <div
                    className={cn(
                      "flex flex-col overflow-hidden text-left transition-opacity duration-200",
                      isCollapsed && "md:hidden",
                    )}
                  >
                    <span className="truncate text-xs font-medium text-foreground/90">
                      {user?.displayName || user?.email || t("actions.profile")}
                    </span>
                    <span className="truncate text-[11px] text-foreground/50">
                      {user?.email}
                    </span>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                {/* Navigation items */}
                <DropdownMenuLabel>
                  {t("actions.profileWorkspace")}
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => router.push("/profile")}>
                  <HugeiconsIcon
                    icon={User02Icon as IconSvgElement}
                    strokeWidth={1.8}
                    className="size-4 text-foreground/50"
                  />
                  {t("actions.profile")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/library")}>
                  <HugeiconsIcon
                    icon={Folder01Icon as IconSvgElement}
                    strokeWidth={1.8}
                    className="size-4 text-foreground/50"
                  />
                  {t("actions.library")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => router.push("/results/history")}
                >
                  <HugeiconsIcon
                    icon={PlayCircleIcon as IconSvgElement}
                    strokeWidth={1.8}
                    className="size-4 text-foreground/50"
                  />
                  {t("actions.results")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {/* Appearance & Language */}
                <DropdownMenuLabel>
                  {t("links.security") === "Security"
                    ? "Preferences"
                    : "Einstellungen"}
                </DropdownMenuLabel>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <ThemeToggle />
                  <span className="text-sm">{t("theme.toggle")}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <LanguageSwitcher />
                  <span className="text-sm">Language</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {/* Credits */}
                <DropdownMenuItem disabled className="opacity-70">
                  <span className="text-xs">⚡</span>
                  {t("credits.remaining", { count: remainingCredits })}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {/* Logout */}
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="text-destructive focus:text-destructive"
                >
                  <HugeiconsIcon
                    icon={Logout03Icon as IconSvgElement}
                    strokeWidth={1.8}
                    className="size-4"
                  />
                  {t("actions.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : (
          <div
            className={cn(
              "flex flex-col gap-2 px-1",
              isCollapsed && "md:hidden",
            )}
          >
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setAuthMode("login");
                setIsAuthModalOpen(true);
              }}
              className="w-full text-sm border border-foreground/10 hover:bg-foreground/5 h-8 font-normal"
            >
              {t("actions.login")}
            </Button>
            <Button
              type="button"
              onClick={() => {
                setAuthMode("signup");
                setIsAuthModalOpen(true);
              }}
              className="w-full h-8 text-sm font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors"
            >
              {t("actions.getStarted")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <TooltipProvider>
      {/* ── Mobile Hamburger Button ── */}
      <button
        type="button"
        onClick={() => setIsMobileOpen(true)}
        className="fixed top-4 left-4 z-50 flex md:hidden items-center justify-center h-9 w-9 rounded-xl border border-foreground/10 bg-background/80 backdrop-blur-xl text-foreground/70 hover:text-foreground hover:bg-foreground/5 transition-colors"
        aria-label={t("actions.openMenu")}
      >
        <HugeiconsIcon
          icon={Menu03Icon as IconSvgElement}
          strokeWidth={2}
          className="size-5"
        />
      </button>

      {/* ── Mobile Overlay ── */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile Drawer ── */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-[280px] border-r border-foreground/5 bg-background/95 backdrop-blur-2xl transition-transform duration-300 ease-in-out md:hidden",
          isMobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="relative flex h-full flex-col">
          <button
            type="button"
            onClick={() => setIsMobileOpen(false)}
            className="absolute top-4 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-foreground/50 hover:bg-foreground/5 hover:text-foreground transition-colors"
            aria-label={t("actions.closeMenu")}
          >
            <SidebarPanelIcon className="size-4" />
          </button>
          {sidebarContent}
        </div>
      </aside>

      {/* ── Desktop Sidebar ── */}
      <aside
        className={cn(
          "hidden md:flex fixed top-0 left-0 z-40 h-screen flex-col border-r border-foreground/5 bg-background/80 backdrop-blur-2xl transition-all duration-300 ease-in-out",
          isCollapsed ? "group w-16" : "w-60",
        )}
      >
        {sidebarContent}
      </aside>

      {/* ── Spacer to push content ── */}
      <div
        className={cn(
          "hidden md:block shrink-0 transition-all duration-300 ease-in-out",
          isCollapsed ? "w-16" : "w-60",
        )}
      />

      {/* ── Auth Modal ── */}
      <AuthForm
        isOpen={isAuthModalOpen}
        defaultMode={authMode}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </TooltipProvider>
  );
}
