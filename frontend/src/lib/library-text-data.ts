import type { ProductData } from "@/lib/firebase/hooks";
import type { UpdateProductPayload } from "@/lib/products-api";

export interface ProductTextDataValues {
  description: string;
  benefitsRaw: string;
  urlsRaw: string;
  tone: string;
  targetAudience: string;
  language: string;
  cta: string;
}

export function productToTextDataValues(
  product?: ProductData,
): ProductTextDataValues {
  return {
    description: product?.description ?? "",
    benefitsRaw: (product?.benefits ?? []).join("\n"),
    urlsRaw: (product?.urls ?? []).join("\n"),
    tone: product?.defaults?.tone ?? "",
    targetAudience: product?.defaults?.targetAudience ?? "",
    language: product?.defaults?.language ?? "en",
    cta: product?.defaults?.cta ?? "",
  };
}

export function parseMultilineList(raw: string): string[] {
  return raw
    .split("\n")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function buildProductTextDataUpdate(
  values: ProductTextDataValues,
): UpdateProductPayload {
  return {
    description: values.description.trim() || undefined,
    benefits: parseMultilineList(values.benefitsRaw),
    urls: parseMultilineList(values.urlsRaw),
    defaults: {
      tone: values.tone && values.tone !== "none" ? values.tone : undefined,
      targetAudience: values.targetAudience.trim() || undefined,
      language: values.language || undefined,
      cta: values.cta.trim() || undefined,
    },
  };
}
