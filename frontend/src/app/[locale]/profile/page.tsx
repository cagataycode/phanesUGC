"use client";

import { useMemo, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/lib/firebase/auth-provider";
import { useTranslations } from "next-intl";

const PLACEHOLDER_CREDITS = 42;

function getInitial(name?: string | null, email?: string | null) {
  return name?.trim().charAt(0) || email?.trim().charAt(0) || "P";
}

type SectionKey =
  | "overview"
  | "account"
  | "workspace"
  | "access"
  | "usage"
  | "resources"
  | "management";

export default function ProfilePage() {
  const { user, platformContext, loading } = useAuth();
  const t = useTranslations("profile");
  const [activeSection, setActiveSection] = useState<SectionKey>("overview");

  const displayName = user?.displayName || t("fallbackName");
  const email = user?.email || t("fallbackEmail");
  const initial = getInitial(user?.displayName, user?.email).toUpperCase();
  const entitlements = platformContext?.entitlements;
  const usedCredits = 8;
  const generatedAds = 3;
  const productLinks = 1;
  const uploadedAssets = 5;

  const navItems: Array<{ key: SectionKey; label: string }> = useMemo(
    () => [
      { key: "overview", label: "Overview" },
      { key: "account", label: t("accountDetails") },
      { key: "workspace", label: t("workspaceAccount") },
      { key: "access", label: t("subscriptionAccess") },
      { key: "usage", label: t("usageCredits") },
      { key: "resources", label: t("resourceSummary") },
      { key: "management", label: t("workspaceManagement") },
    ],
    [t],
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-background bg-mesh-blur font-sans">
      <Navbar />

      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-12 pt-28 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
          <aside className="lg:sticky lg:top-28">
            <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
              <div className="mb-2 px-2 py-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("title")}
                </p>
              </div>
              <nav className="flex flex-col gap-1">
                {navItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActiveSection(item.key)}
                    className={
                      activeSection === item.key
                        ? "rounded-lg bg-accent px-3 py-2 text-left text-sm font-medium text-accent-foreground"
                        : "rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                    }
                  >
                    {item.label}
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          <div className="space-y-6">
            <section className="rounded-xl border border-border bg-card/80 p-6 shadow-sm backdrop-blur-sm sm:p-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary text-lg font-semibold text-primary-foreground">
                    {initial}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      {t("title")}
                    </p>
                    <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                      {displayName}
                    </h1>
                    <p className="text-sm text-muted-foreground">{email}</p>
                  </div>
                </div>

                <div className="grid gap-3 sm:min-w-64">
                  <div className="rounded-lg border border-border bg-background/80 px-4 py-3">
                    <p className="text-xs text-muted-foreground">
                      {t("remainingCredits")}
                    </p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                      {PLACEHOLDER_CREDITS}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-background/80 px-4 py-3">
                    <p className="text-xs text-muted-foreground">{t("role")}</p>
                    <p className="mt-1 text-sm font-medium text-foreground capitalize">
                      {platformContext?.role || t("member")}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {(activeSection === "overview" || activeSection === "account") && (
              <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">
                    {t("accountDetails")}
                  </h2>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-lg border border-border bg-background/70 px-4 py-3">
                      <p className="text-xs text-muted-foreground">
                        {t("fullName")}
                      </p>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {displayName}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-background/70 px-4 py-3">
                      <p className="text-xs text-muted-foreground">
                        {t("emailAddress")}
                      </p>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {email}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-background/70 px-4 py-3">
                      <p className="text-xs text-muted-foreground">
                        {t("workspaceId")}
                      </p>
                      <p className="mt-1 break-all text-sm font-medium text-foreground">
                        {platformContext?.account_id || t("noWorkspace")}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-background/70 px-4 py-3">
                      <p className="text-xs text-muted-foreground">
                        {t("userId")}
                      </p>
                      <p className="mt-1 break-all text-sm font-medium text-foreground">
                        {platformContext?.user_id ||
                          user?.uid ||
                          t("unavailable")}
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {(activeSection === "overview" ||
              activeSection === "workspace") && (
              <section className="grid gap-6 lg:grid-cols-1">
                <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">
                    {t("workspaceAccount")}
                  </h2>
                  <div className="mt-5 space-y-4">
                    <div className="rounded-lg border border-border bg-background/70 px-4 py-3">
                      <p className="text-xs text-muted-foreground">
                        {t("role")}
                      </p>
                      <p className="mt-1 text-sm font-medium text-foreground capitalize">
                        {platformContext?.role || t("member")}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-background/70 px-4 py-3">
                      <p className="text-xs text-muted-foreground">
                        {t("membershipStatus")}
                      </p>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {t("activeMembership")}
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {(activeSection === "overview" ||
              activeSection === "access" ||
              activeSection === "usage") && (
              <section className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">
                    {t("subscriptionAccess")}
                  </h2>
                  <div className="mt-5 space-y-4">
                    <div className="rounded-lg border border-border bg-background/70 px-4 py-3">
                      <p className="text-xs text-muted-foreground">
                        {t("subscriptionTier")}
                      </p>
                      <p className="mt-1 text-sm font-medium text-foreground capitalize">
                        {platformContext?.subscription_tier || t("free")}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-background/70 px-4 py-3">
                      <p className="text-xs text-muted-foreground">
                        {t("entitlementSource")}
                      </p>
                      <p className="mt-1 text-sm font-medium text-foreground capitalize">
                        {platformContext?.entitlement_source ||
                          t("subscription")}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-background/70 px-4 py-3">
                      <p className="text-xs text-muted-foreground">
                        {t("entitlements")}
                      </p>
                      <div className="mt-3 space-y-2 text-sm text-foreground">
                        <div className="flex items-center justify-between gap-3">
                          <span>{t("canGenerateAds")}</span>
                          <span className="font-medium">
                            {entitlements?.can_generate_ads
                              ? t("enabled")
                              : t("disabled")}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>{t("canRenderFinal")}</span>
                          <span className="font-medium">
                            {entitlements?.can_render_final
                              ? t("enabled")
                              : t("disabled")}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>{t("canRegenerateScene")}</span>
                          <span className="font-medium">
                            {entitlements?.can_regenerate_scene
                              ? t("enabled")
                              : t("disabled")}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>{t("maxDuration")}</span>
                          <span className="font-medium">
                            {entitlements?.max_duration_sec ?? 0}s
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-lg border border-border bg-background/70 px-4 py-3">
                      <p className="text-xs text-muted-foreground">
                        {t("sessionStatus")}
                      </p>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {loading
                          ? t("checkingSession")
                          : user
                            ? t("authenticated")
                            : t("signedOut")}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">
                    {t("usageCredits")}
                  </h2>
                  <div className="mt-5 space-y-4">
                    <div className="rounded-lg border border-border bg-background/70 px-4 py-3">
                      <p className="text-xs text-muted-foreground">
                        {t("remainingCredits")}
                      </p>
                      <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                        {PLACEHOLDER_CREDITS}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-background/70 px-4 py-3">
                      <p className="text-xs text-muted-foreground">
                        {t("currentPeriodUsage")}
                      </p>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {t("usedCredits", { count: usedCredits })}
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {(activeSection === "overview" ||
              activeSection === "resources" ||
              activeSection === "management") && (
              <section className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">
                    {t("resourceSummary")}
                  </h2>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-lg border border-border bg-background/70 px-4 py-3">
                      <p className="text-xs text-muted-foreground">
                        {t("generatedAds")}
                      </p>
                      <p className="mt-1 text-lg font-semibold text-foreground">
                        {generatedAds}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-background/70 px-4 py-3">
                      <p className="text-xs text-muted-foreground">
                        {t("productLinks")}
                      </p>
                      <p className="mt-1 text-lg font-semibold text-foreground">
                        {productLinks}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-background/70 px-4 py-3">
                      <p className="text-xs text-muted-foreground">
                        {t("uploadedAssets")}
                      </p>
                      <p className="mt-1 text-lg font-semibold text-foreground">
                        {uploadedAssets}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-background/70 px-4 py-3">
                      <p className="text-xs text-muted-foreground">
                        {t("templatesAvatars")}
                      </p>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {t("comingSoon")}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">
                    {t("workspaceManagement")}
                  </h2>
                  <div className="mt-5 rounded-lg border border-border bg-background/70 px-4 py-4">
                    <p className="text-sm text-muted-foreground">
                      {t("workspaceManagementDescription")}
                    </p>
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
