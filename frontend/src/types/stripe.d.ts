import "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "stripe-pricing-table": {
        "pricing-table-id"?: string;
        "publishable-key"?: string;
        "customer-email"?: string;
        "client-reference-id"?: string;
      };
    }
  }
}
