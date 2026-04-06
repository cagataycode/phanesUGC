"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/firebase/auth-provider";

interface StripePricingTableProps {
  pricingTableId: string;
  publishableKey: string;
}

export function StripePricingTable({
  pricingTableId,
  publishableKey,
}: StripePricingTableProps) {
  const { user } = useAuth();
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkScript = () => {
      const existingScript = document.querySelector(
        'script[src="https://js.stripe.com/v3/pricing-table.js"]',
      );

      if (existingScript) {
        setIsScriptLoaded(true);
        return true;
      }
      return false;
    };

    if (checkScript()) return;

    const script = document.createElement("script");
    script.src = "https://js.stripe.com/v3/pricing-table.js";
    script.async = true;

    const handleLoad = () => setIsScriptLoaded(true);
    const handleError = () => console.error("Failed to load Stripe Pricing Table script");

    script.addEventListener("load", handleLoad);
    script.addEventListener("error", handleError);
    document.body.appendChild(script);

    return () => {
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
    };
  }, []);

  if (!isScriptLoaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-muted-foreground">Loading pricing table...</div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <stripe-pricing-table
        pricing-table-id={pricingTableId}
        publishable-key={publishableKey}
        customer-email={user?.email || undefined}
        client-reference-id={user?.uid || undefined}
      />
    </div>
  );
}
