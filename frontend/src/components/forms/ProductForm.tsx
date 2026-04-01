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
  createUploadUrl,
  createUploadFromUrl,
  toProductAsset,
  uploadFileToSignedUrl,
} from "@/lib/assets-api";
import {
  createProduct,
  updateProduct,
  type CreateProductPayload,
} from "@/lib/products-api";
import { scrapeProductUrl } from "@/lib/scraper-api";

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
  const [brandAssets, setBrandAssets] = useState(product?.brandAssets ?? []);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [scrapedImages, setScrapedImages] = useState<string[]>([]);
  const [selectedScrapedImages, setSelectedScrapedImages] = useState<
    Set<string>
  >(new Set());
  const [error, setError] = useState<string | null>(null);

  function parseLinesArray(raw: string): string[] {
    return raw
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async function handleAssetUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || !product?.id) {
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const uploaded = [] as NonNullable<CreateProductPayload["brandAssets"]>;

      for (const file of Array.from(fileList)) {
        const assetType = file.type.startsWith("video/")
          ? "video"
          : file.type.includes("logo")
            ? "logo"
            : "image";

        const upload = await createUploadUrl(businessId, product.id, {
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          entityType: "product",
          assetType,
          role: "brand",
        });

        await uploadFileToSignedUrl(upload.uploadUrl, file);
        uploaded.push(toProductAsset(upload.asset));
      }

      const nextAssets = [...brandAssets, ...uploaded];
      setBrandAssets(nextAssets);
      await updateProduct(businessId, product.id, {
        brandAssets: nextAssets,
      });
    } catch (err) {
      console.error("Product asset upload error:", err);
      setError(err instanceof Error ? err.message : "Failed to upload asset.");
    } finally {
      setIsUploading(false);
    }
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
      brandAssets,
      defaults: {
        tone: tone && tone !== "none" ? tone : undefined,
        targetAudience: targetAudience.trim() || undefined,
        language: language || undefined,
        cta: cta.trim() || undefined,
      },
    };

    try {
      let currentProductId = isEdit && product ? product.id : null;
      if (isEdit && product) {
        await updateProduct(businessId, product.id, payload);
      } else {
        const result = await createProduct(businessId, payload);
        currentProductId = result.id;
        console.log("Product created with ID:", result.id);
      }

      if (currentProductId && selectedScrapedImages.size > 0 && !isEdit) {
        setIsUploading(true);
        try {
          const uploaded = [] as NonNullable<
            CreateProductPayload["brandAssets"]
          >;
          for (const url of Array.from(selectedScrapedImages)) {
            const upload = await createUploadFromUrl(
              businessId,
              currentProductId,
              {
                sourceUrl: url,
                filename:
                  url.split("/").pop()?.split("?")[0] || "scraped-image",
                contentType: "application/octet-stream",
                entityType: "product",
                assetType: "image",
                role: "brand",
              },
            );
            uploaded.push(toProductAsset(upload.asset));
          }
          await updateProduct(businessId, currentProductId, {
            brandAssets: [...brandAssets, ...uploaded],
          });
        } catch (err) {
          console.error("Failed to upload scraped images:", err);
        } finally {
          setIsUploading(false);
        }
      }

      onSuccess?.(currentProductId!);
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

  async function handleAutoFill() {
    if (!scrapeUrl.trim()) {
      setError("Please enter a URL to auto-fill.");
      return;
    }

    // Add http:// if missing and not localhost
    let validUrl = scrapeUrl.trim();
    if (!validUrl.startsWith("http://") && !validUrl.startsWith("https://")) {
      validUrl = `https://${validUrl}`;
    }

    try {
      // Basic URL validation
      new URL(validUrl);
    } catch {
      setError("Please enter a valid URL.");
      return;
    }

    setIsScraping(true);
    setError(null);

    try {
      const result = await scrapeProductUrl({ url: validUrl });

      if (!result.extraction) {
        throw new Error(
          "Could not extract any product information from this URL.",
        );
      }

      const { extraction } = result;

      if (extraction.productName) {
        setName((prev) => prev || extraction.productName!);
      }

      if (extraction.description) {
        setDescription((prev) => prev || extraction.description!);
      }

      if (extraction.benefits && extraction.benefits.length > 0) {
        setBenefitsRaw((prev) => {
          const prevLines = parseLinesArray(prev);
          const newBenefits = extraction.benefits.filter(
            (b) => !prevLines.includes(b),
          );
          return [...prevLines, ...newBenefits].join("\n");
        });
      }

      setUrlsRaw((prev) => {
        const prevLines = parseLinesArray(prev);
        if (!prevLines.includes(validUrl)) {
          return [...prevLines, validUrl].join("\n");
        }
        return prev;
      });

      if (extraction.mediaUrls && extraction.mediaUrls.length > 0) {
        const images = extraction.mediaUrls
          .filter((m: { type: string; url: string }) => m.type === "image")
          .map((m: { type: string; url: string }) => m.url);
        if (images.length > 0) {
          setScrapedImages(images);
          setSelectedScrapedImages(new Set(images.slice(0, 5)));
        }
      }

      setScrapeUrl(""); // Clear the input on success
    } catch (err) {
      console.error("Auto-fill error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to auto-fill from URL.",
      );
    } finally {
      setIsScraping(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Auto-fill Section */}
      {!isEdit && (
        <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div>
            <p className="text-sm font-medium text-foreground flex items-center gap-2">
              ✨ Auto-fill from URL
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Save time by extracting product name, description, and benefits
              automatically.
            </p>
          </div>
          <div className="flex gap-2">
            <Input
              value={scrapeUrl}
              onChange={(e) => setScrapeUrl(e.target.value)}
              placeholder="https://example.com/product"
              className="bg-background"
              disabled={isScraping}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleAutoFill();
                }
              }}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={handleAutoFill}
              disabled={isScraping || !scrapeUrl.trim()}
            >
              {isScraping ? "Extracting..." : "Auto-fill"}
            </Button>
          </div>

          {scrapedImages.length > 0 && (
            <div className="pt-2">
              <p className="text-xs font-medium text-foreground mb-2">
                Select images to add as brand assets:
              </p>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {scrapedImages.map((imgUrl, i) => {
                  const isSelected = selectedScrapedImages.has(imgUrl);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        const newSet = new Set(selectedScrapedImages);
                        if (isSelected) newSet.delete(imgUrl);
                        else newSet.add(imgUrl);
                        setSelectedScrapedImages(newSet);
                      }}
                      className={`relative flex-shrink-0 h-20 w-20 overflow-hidden rounded-md border-2 transition-all ${
                        isSelected
                          ? "border-primary"
                          : "border-transparent hover:border-primary/50"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imgUrl}
                        alt="Scraped image preview"
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                      {isSelected && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <div className="bg-primary text-primary-foreground rounded-full p-0.5">
                            ✅
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

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

      <div className="space-y-2 rounded-lg border border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">Brand assets</p>
            <p className="text-xs text-muted-foreground">
              Upload images, videos, or logos after the product exists.
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
            <span>{isUploading ? "Uploading…" : "Upload asset"}</span>
            <input
              type="file"
              className="hidden"
              multiple
              disabled={!product?.id || isUploading || isSubmitting}
              onChange={(e) => void handleAssetUpload(e.target.files)}
            />
          </label>
        </div>
        {!product?.id ? (
          <p className="text-xs text-muted-foreground">
            Create the product first to enable uploads.
          </p>
        ) : null}
        {brandAssets.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {brandAssets.map((asset, index) => (
              <div
                key={`${asset.storageKey}-${index}`}
                className="rounded-md border border-border bg-background px-3 py-2"
              >
                <p className="truncate text-sm font-medium text-foreground">
                  {asset.filename}
                </p>
                <p className="text-xs text-muted-foreground">
                  {asset.type} • {asset.storageKey}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No assets uploaded yet.
          </p>
        )}
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
                <SelectItem value="none">None</SelectItem>
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
