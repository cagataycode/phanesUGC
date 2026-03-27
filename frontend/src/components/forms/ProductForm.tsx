"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProductData } from "@/lib/firebase/hooks";
import {
  createProduct,
  updateProduct,
  type CreateProductPayload,
} from "@/lib/products-api";

interface ProductFormProps {
  businessId: string;
  /** If provided, the form is in edit mode */
  product?: ProductData;
  onSuccess?: (productId: string) => void;
  onCancel?: () => void;
}

export function ProductForm({
  businessId,
  product,
  onSuccess,
  onCancel,
}: ProductFormProps) {
  const isEdit = Boolean(product);

  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [benefitsRaw, setBenefitsRaw] = useState(
    (product?.benefits ?? []).join("\n"),
  );
  const [urlsRaw, setUrlsRaw] = useState((product?.urls ?? []).join("\n"));
  const [tone, setTone] = useState(product?.defaults?.tone ?? "");
  const [targetAudience, setTargetAudience] = useState(
    product?.defaults?.targetAudience ?? "",
  );
  const [language, setLanguage] = useState(product?.defaults?.language ?? "en");
  const [cta, setCta] = useState(product?.defaults?.cta ?? "");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function parseLinesArray(raw: string): string[] {
    return raw
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Product name is required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const payload: CreateProductPayload = {
      name: name.trim(),
      description: description.trim() || undefined,
      benefits: parseLinesArray(benefitsRaw),
      urls: parseLinesArray(urlsRaw),
      defaults: {
        tone: tone && tone !== "__none__" ? tone : undefined,
        targetAudience: targetAudience.trim() || undefined,
        language: language || undefined,
        cta: cta.trim() || undefined,
      },
    };

    try {
      if (isEdit && product) {
        await updateProduct(businessId, product.id, payload);
        onSuccess?.(product.id);
      } else {
        const result = await createProduct(businessId, payload);
        console.log("Product created with ID:", result.id);
        onSuccess?.(result.id);
      }
    } catch (err) {
      console.error("ProductForm submit error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred. Check console for details.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="product-name">Product name *</Label>
        <Input
          id="product-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. My SaaS Product"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="product-description">Description</Label>
        <Textarea
          id="product-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does this product do?"
          className="min-h-24 resize-none"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="product-benefits">
          Key benefits{" "}
          <span className="text-xs text-muted-foreground">(one per line)</span>
        </Label>
        <Textarea
          id="product-benefits"
          value={benefitsRaw}
          onChange={(e) => setBenefitsRaw(e.target.value)}
          placeholder={"Saves time\nEasy to use\nAffordable"}
          className="min-h-20 resize-none"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="product-urls">
          Product URLs{" "}
          <span className="text-xs text-muted-foreground">(one per line)</span>
        </Label>
        <Textarea
          id="product-urls"
          value={urlsRaw}
          onChange={(e) => setUrlsRaw(e.target.value)}
          placeholder={
            "https://example.com/product\nhttps://example.com/pricing"
          }
          className="min-h-16 resize-none"
        />
      </div>

      <div className="border-t border-border pt-4">
        <p className="mb-4 text-sm font-medium text-foreground">
          Default ad settings
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="product-tone">Default tone</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger id="product-tone" className="h-9 text-sm">
                <SelectValue placeholder="Select tone…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                <SelectItem value="direct">Direct</SelectItem>
                <SelectItem value="playful">Playful</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="emotional">Emotional</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="product-language">Default language</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger id="product-language" className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="de">Deutsch</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="product-audience">Default target audience</Label>
            <Input
              id="product-audience"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="e.g. Small business owners 25–45"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="product-cta">Default CTA</Label>
            <Input
              id="product-cta"
              value={cta}
              onChange={(e) => setCta(e.target.value)}
              placeholder="e.g. Try for free today"
            />
          </div>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-3 pt-2">
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? isEdit
              ? "Saving…"
              : "Creating…"
            : isEdit
              ? "Save changes"
              : "Create product"}
        </Button>
      </div>
    </form>
  );
}
