"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/firebase/auth-provider";
import { useAvatars, useProducts } from "@/lib/firebase/hooks";
import type { AvatarData, ProductData } from "@/lib/firebase/hooks";
import type { ProductAsset, ProductAssetType } from "@/lib/asset-types";
import { ProductForm } from "@/components/forms/ProductForm";
import { AvatarForm } from "@/components/forms/AvatarForm";
import {
  deleteProduct,
  updateProduct,
  type UpdateProductPayload,
} from "@/lib/products-api";
import { deleteAvatar } from "@/lib/avatars-api";
import { useStorageImageUrl } from "@/lib/useStorageImageUrl";
import {
  buildProductTextDataUpdate,
  productToTextDataValues,
} from "@/lib/library-text-data";
import { BrandAssetThumbnail } from "@/components/BrandAssetThumbnail";

type LibrarySectionKey = "products" | "text" | "avatars" | "assets";
type LibraryView = "list" | "create" | "edit";

function ProductCard({
  product,
  firstImageStorageKey,
  isSelected,
  isDeleting,
  onEdit,
  onDelete,
  businessId,
}: {
  product: ProductData;
  firstImageStorageKey: string | undefined;
  isSelected: boolean;
  isDeleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
  businessId: string;
}) {
  const imageUrl = useStorageImageUrl(businessId, firstImageStorageKey);
  const [imgError, setImgError] = useState(false);

  const hasImage = imageUrl && !imgError;

  return (
    <Card
      className={`overflow-hidden rounded-xl border bg-card shadow-sm transition-colors ${
        isSelected ? "border-primary/40" : "border-border"
      }`}
    >
      {/* Brand asset image preview at the top of the card */}
      <div className="flex max-h-48 items-center justify-center overflow-hidden bg-muted/50">
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={product.name}
            className="max-h-48 w-full object-contain"
            onError={() => setImgError(true)}
          />
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted-foreground/30"
          >
            <path d="m7.5 4.27 9 5.15" />
            <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
            <path d="m3.3 7 8.7 5 8.7-5" />
            <path d="M12 22V12" />
          </svg>
        )}
      </div>
      <CardHeader className="px-4 pb-3 pt-3">
        <div className="min-w-0">
          <CardTitle className="truncate text-sm font-medium text-foreground">
            {product.name}
          </CardTitle>
          <CardDescription className="mt-1 line-clamp-2 break-words">
            {product.description || "No description yet."}
          </CardDescription>
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="px-4 pt-3 pb-4">
        <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
          <span className="rounded-full border border-border px-2 py-0.5">
            {(product.benefits ?? []).length} benefit
            {(product.benefits ?? []).length !== 1 ? "s" : ""}
          </span>
          <span className="rounded-full border border-border px-2 py-0.5">
            {(product.brandAssets ?? []).length} asset
            {(product.brandAssets ?? []).length !== 1 ? "s" : ""}
          </span>
          <span className="rounded-full border border-border px-2 py-0.5">
            {(product.urls ?? []).length} URL
            {(product.urls ?? []).length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="mt-3 flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={onEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            disabled={isDeleting}
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AvatarCard({
  avatar,
  firstImageStorageKey,
  isSelected,
  isDeleting,
  onEdit,
  onDelete,
  businessId,
}: {
  avatar: AvatarData;
  firstImageStorageKey: string | undefined;
  isSelected: boolean;
  isDeleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
  businessId: string;
}) {
  const imageUrl = useStorageImageUrl(businessId, firstImageStorageKey);
  const [imgError, setImgError] = useState(false);

  return (
    <Card
      className={`overflow-hidden rounded-xl border bg-card shadow-sm transition-colors ${
        isSelected ? "border-primary/40" : "border-border"
      }`}
    >
      {/* Avatar image at the top of the card */}
      <div className="flex max-h-48 items-center justify-center overflow-hidden bg-muted/50">
        {imageUrl && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={avatar.name}
            className="max-h-48 w-full object-contain"
            onError={() => setImgError(true)}
          />
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted-foreground/30"
          >
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        )}
      </div>
      <CardHeader className="px-4 pb-3 pt-3">
        <div className="min-w-0">
          <CardTitle className="truncate text-sm font-medium text-foreground">
            {avatar.name}
          </CardTitle>
          <CardDescription className="mt-1 uppercase">
            {avatar.type.replaceAll("_", " ")}
          </CardDescription>
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="px-4 pt-3 pb-4">
        <p className="text-xs text-muted-foreground">
          {avatar.assets?.length
            ? `${avatar.assets.length} image${avatar.assets.length !== 1 ? "s" : ""}`
            : "No avatar images"}
          {avatar.isDefault ? " \u2022 Default" : ""}
        </p>
        <div className="mt-3 flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={onEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            disabled={isDeleting}
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LibraryPage() {
  const { platformContext } = useAuth();
  const businessId = platformContext?.account_id;

  const { products, loading, error: productsError } = useProducts(businessId);
  const {
    avatars,
    loading: avatarsLoading,
    error: avatarsError,
  } = useAvatars(businessId);

  const [activeSection, setActiveSection] =
    useState<LibrarySectionKey>("products");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>("");
  const [view, setView] = useState<LibraryView>("list");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isSavingTextData, setIsSavingTextData] = useState(false);
  const [textDataError, setTextDataError] = useState<string | null>(null);
  const [textDataValues, setTextDataValues] = useState(() =>
    productToTextDataValues(undefined),
  );

  const selectedProduct: ProductData | undefined = useMemo(
    () => products.find((p) => p.id === selectedProductId) ?? products[0],
    [products, selectedProductId],
  );
  const selectedAvatar: AvatarData | undefined = useMemo(
    () => avatars.find((a) => a.id === selectedAvatarId) ?? avatars[0],
    [avatars, selectedAvatarId],
  );

  useEffect(() => {
    setTextDataValues(productToTextDataValues(selectedProduct));
    setTextDataError(null);
  }, [selectedProduct]);

  const navItems: Array<{ key: LibrarySectionKey; label: string }> = useMemo(
    () => [
      { key: "products", label: "Products" },
      { key: "text", label: "Text information" },
      { key: "avatars", label: "Avatars" },
      { key: "assets", label: "Assets" },
    ],
    [],
  );

  async function handleDelete(productId: string) {
    if (!businessId) return;
    setDeletingId(productId);
    try {
      await deleteProduct(businessId, productId);
      if (selectedProductId === productId) setSelectedProductId("");
    } catch (err) {
      console.error("Failed to delete product:", err);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleAvatarDelete(avatarId: string) {
    if (!businessId) return;
    setDeletingId(avatarId);
    try {
      await deleteAvatar(businessId, avatarId);
      if (selectedAvatarId === avatarId) setSelectedAvatarId("");
    } catch (err) {
      console.error("Failed to delete avatar:", err);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSaveTextData() {
    if (!businessId || !selectedProduct) {
      return;
    }

    setIsSavingTextData(true);
    setTextDataError(null);

    try {
      const payload: UpdateProductPayload =
        buildProductTextDataUpdate(textDataValues);
      await updateProduct(businessId, selectedProduct.id, payload);
    } catch (error) {
      setTextDataError(
        error instanceof Error
          ? error.message
          : "Failed to save product text data.",
      );
    } finally {
      setIsSavingTextData(false);
    }
  }

  async function handleDeleteAsset(asset: ProductAsset) {
    if (!businessId || !selectedProduct) return;
    const updated = (selectedProduct.brandAssets ?? []).filter(
      (a) => a.storageKey !== asset.storageKey,
    );
    await updateProduct(businessId, selectedProduct.id, {
      brandAssets: updated,
    });
  }

  async function handleEditAssetType(
    asset: ProductAsset,
    newType: ProductAssetType,
  ) {
    if (!businessId || !selectedProduct) return;
    const updated = (selectedProduct.brandAssets ?? []).map((a) =>
      a.storageKey === asset.storageKey ? { ...a, type: newType } : a,
    );
    await updateProduct(businessId, selectedProduct.id, {
      brandAssets: updated,
    });
  }

  if (!businessId) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-background bg-mesh-blur font-sans">
        <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center px-4">
          <p className="text-muted-foreground">
            Please sign in to access your library.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background bg-mesh-blur font-sans">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-12 pt-28 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
          <aside className="lg:sticky lg:top-28">
            <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
              <div className="mb-2 px-2 py-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Library
                </p>
              </div>
              <nav className="flex flex-col gap-1">
                {navItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setActiveSection(item.key);
                      setView("list");
                    }}
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
            {/* Header section */}
            <section className="rounded-xl border border-border bg-card/80 p-6 shadow-sm backdrop-blur-sm sm:p-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Library
                  </p>
                  <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                    Library workspace
                  </h1>
                  <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
                    Manage reusable products, editable text data, visual product
                    assets, and image-based avatars for ad generation.
                  </p>
                </div>

                {view === "list" &&
                  activeSection === "products" &&
                  products.length > 0 && (
                    <div className="w-full max-w-sm rounded-xl border border-border bg-background/80 p-4">
                      <p className="mb-2 text-xs text-muted-foreground">
                        Selected product
                      </p>
                      <Select
                        value={selectedProduct?.id ?? ""}
                        onValueChange={setSelectedProductId}
                      >
                        <SelectTrigger className="h-10 w-full rounded-lg text-sm">
                          <SelectValue placeholder="Select a product…" />
                        </SelectTrigger>
                        <SelectContent
                          position="popper"
                          align="end"
                          className="min-w-[220px]"
                        >
                          {products.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedProduct && (
                        <div className="mt-3 rounded-lg border border-border bg-card px-3 py-3">
                          <p className="text-sm font-medium text-foreground">
                            {selectedProduct.name}
                          </p>
                          {selectedProduct.description && (
                            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                              {selectedProduct.description}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                {view === "list" &&
                  activeSection === "avatars" &&
                  avatars.length > 0 && (
                    <div className="w-full max-w-sm rounded-xl border border-border bg-background/80 p-4">
                      <p className="mb-2 text-xs text-muted-foreground">
                        Selected avatar
                      </p>
                      <Select
                        value={selectedAvatar?.id ?? ""}
                        onValueChange={setSelectedAvatarId}
                      >
                        <SelectTrigger className="h-10 w-full rounded-lg text-sm">
                          <SelectValue placeholder="Select an avatar…" />
                        </SelectTrigger>
                        <SelectContent
                          position="popper"
                          align="end"
                          className="min-w-[220px]"
                        >
                          {avatars.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedAvatar && (
                        <div className="mt-3 rounded-lg border border-border bg-card px-3 py-3">
                          <p className="text-sm font-medium text-foreground">
                            {selectedAvatar.name}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {selectedAvatar.assets?.length
                              ? `${selectedAvatar.assets.length} uploaded image${selectedAvatar.assets.length !== 1 ? "s" : ""}`
                              : "No avatar images uploaded"}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
              </div>
            </section>

            {/* Create / Edit form */}
            {(view === "create" || view === "edit") && (
              <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <h2 className="mb-6 text-xl font-semibold tracking-tight text-foreground">
                  {activeSection === "avatars"
                    ? view === "create"
                      ? "Create avatar"
                      : "Edit avatar"
                    : view === "create"
                      ? "Create product"
                      : "Edit product"}
                </h2>
                {activeSection === "avatars" ? (
                  <AvatarForm
                    businessId={businessId}
                    avatar={view === "edit" ? selectedAvatar : undefined}
                    onSuccess={(id) => {
                      setSelectedAvatarId(id);
                      setView("list");
                    }}
                    onCancel={() => setView("list")}
                  />
                ) : (
                  <ProductForm
                    businessId={businessId}
                    product={view === "edit" ? selectedProduct : undefined}
                    onSuccess={(id) => {
                      setSelectedProductId(id);
                      setView("list");
                    }}
                    onCancel={() => setView("list")}
                  />
                )}
              </section>
            )}

            {/* Products list view */}
            {view === "list" && activeSection === "products" && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">
                    Products
                    {!loading && (
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        ({products.length})
                      </span>
                    )}
                  </h2>
                  <Button size="sm" onClick={() => setView("create")}>
                    + Add product
                  </Button>
                </div>

                {productsError && (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                    <p className="font-medium">Failed to load products</p>
                    <p className="mt-1 opacity-80">{productsError.message}</p>
                    <p className="mt-2 text-xs opacity-60">
                      Try refreshing the page. If the issue persists, check
                      browser console.
                    </p>
                  </div>
                )}
                {loading ? (
                  <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                    Loading products…
                  </div>
                ) : products.length === 0 && !productsError ? (
                  <div className="rounded-xl border border-border bg-card p-8 text-center">
                    <p className="mb-4 text-sm text-muted-foreground">
                      No products yet. Create your first product to get started.
                    </p>
                    <Button size="sm" onClick={() => setView("create")}>
                      Create first product
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {products.map((p) => (
                      <ProductCard
                        key={p.id}
                        product={p}
                        firstImageStorageKey={
                          p.brandAssets?.find(
                            (a) => a.type === "image" || a.type === "logo",
                          )?.storageKey
                        }
                        isSelected={selectedProduct?.id === p.id}
                        isDeleting={deletingId === p.id}
                        businessId={businessId!}
                        onEdit={() => {
                          setSelectedProductId(p.id);
                          setView("edit");
                        }}
                        onDelete={() => handleDelete(p.id)}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Text information section */}
            {view === "list" && activeSection === "text" && (
              <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                <Card className="rounded-xl border border-border bg-card p-6 shadow-sm">
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">
                    Text information
                  </h2>
                  {selectedProduct ? (
                    <div className="mt-5 space-y-4">
                      <div className="rounded-lg border border-border bg-background/70 px-4 py-3">
                        <p className="text-xs text-muted-foreground">
                          Product name
                        </p>
                        <p className="mt-1 text-sm font-medium text-foreground">
                          {selectedProduct.name}
                        </p>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label htmlFor="text-description">Description</Label>
                          <Textarea
                            id="text-description"
                            value={textDataValues.description}
                            onChange={(e) =>
                              setTextDataValues((current) => ({
                                ...current,
                                description: e.target.value,
                              }))
                            }
                            className="min-h-24 resize-none"
                          />
                        </div>

                        <div className="space-y-1.5 sm:col-span-2">
                          <Label htmlFor="text-benefits">
                            Benefits
                            <span className="ml-2 text-xs text-muted-foreground">
                              one per line
                            </span>
                          </Label>
                          <Textarea
                            id="text-benefits"
                            value={textDataValues.benefitsRaw}
                            onChange={(e) =>
                              setTextDataValues((current) => ({
                                ...current,
                                benefitsRaw: e.target.value,
                              }))
                            }
                            className="min-h-24 resize-none"
                          />
                        </div>

                        <div className="space-y-1.5 sm:col-span-2">
                          <Label htmlFor="text-urls">
                            URLs
                            <span className="ml-2 text-xs text-muted-foreground">
                              one per line
                            </span>
                          </Label>
                          <Textarea
                            id="text-urls"
                            value={textDataValues.urlsRaw}
                            onChange={(e) =>
                              setTextDataValues((current) => ({
                                ...current,
                                urlsRaw: e.target.value,
                              }))
                            }
                            className="min-h-20 resize-none"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="text-tone">Default tone</Label>
                          <Select
                            value={textDataValues.tone}
                            onValueChange={(value) =>
                              setTextDataValues((current) => ({
                                ...current,
                                tone: value,
                              }))
                            }
                          >
                            <SelectTrigger
                              id="text-tone"
                              className="h-9 text-sm"
                            >
                              <SelectValue placeholder="Select tone…" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              <SelectItem value="direct">Direct</SelectItem>
                              <SelectItem value="playful">Playful</SelectItem>
                              <SelectItem value="professional">
                                Professional
                              </SelectItem>
                              <SelectItem value="emotional">
                                Emotional
                              </SelectItem>
                              <SelectItem value="urgent">Urgent</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="text-language">
                            Default language
                          </Label>
                          <Select
                            value={textDataValues.language}
                            onValueChange={(value) =>
                              setTextDataValues((current) => ({
                                ...current,
                                language: value,
                              }))
                            }
                          >
                            <SelectTrigger
                              id="text-language"
                              className="h-9 text-sm"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="en">English</SelectItem>
                              <SelectItem value="de">Deutsch</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="text-audience">Target audience</Label>
                          <Input
                            id="text-audience"
                            value={textDataValues.targetAudience}
                            onChange={(e) =>
                              setTextDataValues((current) => ({
                                ...current,
                                targetAudience: e.target.value,
                              }))
                            }
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="text-cta">CTA</Label>
                          <Input
                            id="text-cta"
                            value={textDataValues.cta}
                            onChange={(e) =>
                              setTextDataValues((current) => ({
                                ...current,
                                cta: e.target.value,
                              }))
                            }
                          />
                        </div>
                      </div>

                      {textDataError ? (
                        <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                          {textDataError}
                        </div>
                      ) : null}

                      <div className="flex justify-end">
                        <Button
                          type="button"
                          onClick={() => void handleSaveTextData()}
                          disabled={isSavingTextData}
                        >
                          {isSavingTextData ? "Saving…" : "Save text data"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-muted-foreground">
                      Select or create a product to see its text information.
                    </p>
                  )}
                </Card>

                <Card className="rounded-xl border border-border bg-card p-6 shadow-sm">
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">
                    Content checklist
                  </h2>
                  <div className="mt-5 space-y-3 text-sm">
                    {[
                      {
                        label: "Product description",
                        done: Boolean(selectedProduct?.description),
                      },
                      {
                        label: "Benefits & pain points",
                        done: Boolean(selectedProduct?.benefits?.length),
                      },
                      { label: "Pricing & offer", done: false },
                      {
                        label: "CTA & target audience",
                        done: Boolean(selectedProduct?.defaults?.cta),
                      },
                    ].map(({ label, done }) => (
                      <div
                        key={label}
                        className="flex items-center gap-3 rounded-lg border border-border bg-background/70 px-4 py-3"
                      >
                        <span
                          className={
                            done ? "text-green-500" : "text-muted-foreground"
                          }
                        >
                          {done ? "✓" : "○"}
                        </span>
                        <span
                          className={
                            done ? "text-foreground" : "text-muted-foreground"
                          }
                        >
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              </section>
            )}

            {/* Avatars section */}
            {view === "list" && activeSection === "avatars" && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">
                    Avatars
                    {!avatarsLoading && (
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        ({avatars.length})
                      </span>
                    )}
                  </h2>
                  <Button size="sm" onClick={() => setView("create")}>
                    + Add avatar
                  </Button>
                </div>

                {avatarsError && (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                    <p className="font-medium">Failed to load avatars</p>
                    <p className="mt-1 opacity-80">{avatarsError.message}</p>
                  </div>
                )}

                {avatarsLoading ? (
                  <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                    Loading avatars…
                  </div>
                ) : avatars.length === 0 && !avatarsError ? (
                  <div className="rounded-xl border border-border bg-card p-8 text-center">
                    <p className="mb-4 text-sm text-muted-foreground">
                      No avatars yet. Create your first avatar to get started.
                    </p>
                    <Button size="sm" onClick={() => setView("create")}>
                      Create first avatar
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {avatars.map((a) => {
                      const firstImageKey = a.assets?.find(
                        (ast) => ast.type === "image",
                      )?.storageKey;
                      return (
                        <AvatarCard
                          key={a.id}
                          avatar={a}
                          firstImageStorageKey={firstImageKey}
                          isSelected={selectedAvatar?.id === a.id}
                          isDeleting={deletingId === a.id}
                          businessId={businessId}
                          onEdit={() => {
                            setSelectedAvatarId(a.id);
                            setView("edit");
                          }}
                          onDelete={() => handleAvatarDelete(a.id)}
                        />
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* Assets section — product visual data */}
            {view === "list" && activeSection === "assets" && (
              <section className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">
                    Product assets
                  </h2>
                  <div className="mt-4 space-y-4 text-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Manage visual references linked to the selected product.
                      </p>
                      {selectedProduct ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedProductId(selectedProduct.id);
                            setActiveSection("products");
                            setView("edit");
                          }}
                        >
                          Manage product assets
                        </Button>
                      ) : null}
                    </div>

                    <div className="rounded-lg border border-border bg-background/70 px-4 py-3">
                      <p className="text-xs text-muted-foreground">
                        Visual product data
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Store and review product-related images, logos,
                        packaging, screenshots, and other visual references
                        here.
                      </p>
                      {selectedProduct?.brandAssets?.length ? (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {selectedProduct.brandAssets.map((asset, index) => (
                            <BrandAssetThumbnail
                              key={`${asset.storageKey}-${index}`}
                              businessId={businessId}
                              asset={asset}
                              onDelete={handleDeleteAsset}
                              onEditType={handleEditAssetType}
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 text-sm text-muted-foreground">
                          No visual product assets available for the selected
                          product.
                        </p>
                      )}
                    </div>
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
