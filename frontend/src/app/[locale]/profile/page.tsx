"use client";

import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/lib/firebase/auth-provider";
import { useTranslations } from "next-intl";

const PLACEHOLDER_CREDITS = 42;

function getInitial(name?: string | null, email?: string | null) {
  return name?.trim().charAt(0) || email?.trim().charAt(0) || "P";
}

export default function ProfilePage() {
  const { user, platformContext, loading } = useAuth();
  const t = useTranslations("profile");

  const displayName = user?.displayName || t("fallbackName");
  const email = user?.email || t("fallbackEmail");
  const initial = getInitial(user?.displayName, user?.email).toUpperCase();

  return (
    <div className="relative min-h-screen overflow-hidden bg-background bg-mesh-blur font-sans">
      <Navbar />

      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pb-12 pt-28 sm:px-6 lg:px-8">
        <section className="rounded-xl border border-border bg-card/80 p-6 shadow-sm backdrop-blur-sm sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary text-lg font-semibold text-primary-foreground">
                {initial}
              </div>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{t("title")}</p>
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

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              {t("accountDetails")}
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-background/70 px-4 py-3">
                <p className="text-xs text-muted-foreground">{t("fullName")}</p>
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
                <p className="text-xs text-muted-foreground">{t("userId")}</p>
                <p className="mt-1 break-all text-sm font-medium text-foreground">
                  {platformContext?.user_id || user?.uid || t("unavailable")}
                </p>
              </div>
            </div>
          </div>

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
                  {platformContext?.entitlement_source || t("subscription")}
                </p>
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
        </section>
      </main>
    </div>
  );
}
