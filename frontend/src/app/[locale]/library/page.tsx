"use client";

import { useMemo, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/firebase/auth-provider";
import { useProducts } from "@/lib/firebase/hooks";
import type { ProductData } from "@/lib/firebase/hooks";
import { ProductForm } from "@/components/forms/ProductForm";
import { deleteProduct } from "@/lib/products-api";

type LibrarySectionKey = "products" | "text" | "avatars" | "assets";
type LibraryView = "list" | "create" | "edit";

export default function LibraryPage() {
  const { platformContext } = useAuth();
  const businessId = platformContext?.account_id;

  const { products, loading, error: productsError } = useProducts(businessId);

  const [activeSection, setActiveSection] =
    useState<LibrarySectionKey>("products");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [view, setView] = useState<LibraryView>("list");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const selectedProduct: ProductData | undefined = useMemo(
    () => products.find((p) => p.id === selectedProductId) ?? products[0],
    [products, selectedProductId],
  );

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

  if (!businessId) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-background bg-mesh-blur font-sans">
        <Navbar />
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
      <Navbar />

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
                    Product library
                  </h1>
                  <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
                    Manage reusable product data, brand context, avatars, and
                    assets for ad generation.
                  </p>
                </div>

                {view === "list" && products.length > 0 && (
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
              </div>
            </section>

            {/* Create / Edit form */}
            {(view === "create" || view === "edit") && (
              <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <h2 className="mb-6 text-xl font-semibold tracking-tight text-foreground">
                  {view === "create" ? "Create product" : "Edit product"}
                </h2>
                <ProductForm
                  businessId={businessId}
                  product={view === "edit" ? selectedProduct : undefined}
                  onSuccess={(id) => {
                    setSelectedProductId(id);
                    setView("list");
                  }}
                  onCancel={() => setView("list")}
                />
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
                  <div className="grid gap-4 sm:grid-cols-2">
                    {products.map((p) => (
                      <div
                        key={p.id}
                        className={`rounded-xl border bg-card p-5 shadow-sm transition-colors ${
                          selectedProduct?.id === p.id
                            ? "border-primary/40"
                            : "border-border"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {p.name}
                            </p>
                            {p.description && (
                              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                                {p.description}
                              </p>
                            )}
                            {p.benefits && p.benefits.length > 0 && (
                              <p className="mt-2 text-xs text-muted-foreground">
                                {p.benefits.length} benefit
                                {p.benefits.length !== 1 ? "s" : ""}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => {
                                setSelectedProductId(p.id);
                                setView("edit");
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                              disabled={deletingId === p.id}
                              onClick={() => handleDelete(p.id)}
                            >
                              {deletingId === p.id ? "…" : "Delete"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Text information section */}
            {view === "list" && activeSection === "text" && (
              <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">
                    Text information
                  </h2>
                  {selectedProduct ? (
                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <div className="rounded-lg border border-border bg-background/70 px-4 py-3 sm:col-span-2">
                        <p className="text-xs text-muted-foreground">
                          Product name
                        </p>
                        <p className="mt-1 text-sm font-medium text-foreground">
                          {selectedProduct.name}
                        </p>
                      </div>
                      {selectedProduct.description && (
                        <div className="rounded-lg border border-border bg-background/70 px-4 py-3 sm:col-span-2">
                          <p className="text-xs text-muted-foreground">
                            Description
                          </p>
                          <p className="mt-1 text-sm text-foreground">
                            {selectedProduct.description}
                          </p>
                        </div>
                      )}
                      {selectedProduct.benefits &&
                        selectedProduct.benefits.length > 0 && (
                          <div className="rounded-lg border border-border bg-background/70 px-4 py-3 sm:col-span-2">
                            <p className="text-xs text-muted-foreground">
                              Benefits
                            </p>
                            <ul className="mt-1 space-y-1">
                              {selectedProduct.benefits.map((b, i) => (
                                <li key={i} className="text-sm text-foreground">
                                  • {b}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      {selectedProduct.defaults?.cta && (
                        <div className="rounded-lg border border-border bg-background/70 px-4 py-3">
                          <p className="text-xs text-muted-foreground">
                            Default CTA
                          </p>
                          <p className="mt-1 text-sm text-foreground">
                            {selectedProduct.defaults.cta}
                          </p>
                        </div>
                      )}
                      {selectedProduct.defaults?.tone && (
                        <div className="rounded-lg border border-border bg-background/70 px-4 py-3">
                          <p className="text-xs text-muted-foreground">
                            Default tone
                          </p>
                          <p className="mt-1 text-sm text-foreground capitalize">
                            {selectedProduct.defaults.tone}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-muted-foreground">
                      Select or create a product to see its text information.
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
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
                </div>
              </section>
            )}

            {/* Avatars section — static placeholder */}
            {view === "list" && activeSection === "avatars" && (
              <section className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">
                    Avatars
                  </h2>
                  <p className="mt-4 text-sm text-muted-foreground">
                    Avatar management is coming soon.
                  </p>
                </div>
              </section>
            )}

            {/* Assets section — static placeholder */}
            {view === "list" && activeSection === "assets" && (
              <section className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">
                    Assets
                  </h2>
                  <p className="mt-4 text-sm text-muted-foreground">
                    Asset management is coming soon.
                  </p>
                </div>
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
