"use client";

import { useAuth } from "@/lib/firebase/auth-provider";
import { useTranslations } from "next-intl";
import { StripePricingTable } from "@/components/stripe-pricing-table";

const STRIPE_PRICING_TABLE_ID = process.env.NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID || "";
const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";

export function SubscriptionManagement() {
  const { user, platformContext } = useAuth();
  const t = useTranslations("profile");
  const entitlements = platformContext?.entitlements;
  const isPaidSubscriber = platformContext?.subscription_tier && 
    platformContext.subscription_tier !== "free";

  return (
    <div className="space-y-6">
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
              {user ? t("authenticated") : t("signedOut")}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          {t("manageSubscription")}
        </h2>
        <div className="mt-5">
          {!user ? (
            <div className="rounded-lg border border-border bg-background/70 px-4 py-6 text-center">
              <p className="text-sm text-muted-foreground">
                {t("signInToManage")}
              </p>
            </div>
          ) : !STRIPE_PRICING_TABLE_ID || !STRIPE_PUBLISHABLE_KEY ? (
            <div className="rounded-lg border border-border bg-background/70 px-4 py-6 text-center">
              <p className="text-sm text-muted-foreground">
                {t("stripeNotConfigured")}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must be set
              </p>
            </div>
          ) : isPaidSubscriber ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-background/70 px-4 py-4">
                <p className="text-sm text-muted-foreground">
                  {t("alreadySubscribed")}
                </p>
              </div>
              <StripePricingTable
                pricingTableId={STRIPE_PRICING_TABLE_ID}
                publishableKey={STRIPE_PUBLISHABLE_KEY}
              />
            </div>
          ) : (
            <StripePricingTable
              pricingTableId={STRIPE_PRICING_TABLE_ID}
              publishableKey={STRIPE_PUBLISHABLE_KEY}
            />
          )}
        </div>
      </div>
    </div>
  );
}
