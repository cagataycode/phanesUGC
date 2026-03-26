"use client";

import { useMemo, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type LibrarySectionKey = "products" | "text" | "avatars" | "assets";

const MOCK_PRODUCTS = [
  {
    id: "prod-adpilot",
    name: "AdPilot",
    tagline: "AI ad creation tool",
    status: "Ready",
  },
  {
    id: "prod-phanes-serum",
    name: "Phanes Serum",
    tagline: "Skincare performance product",
    status: "Draft",
  },
];

export default function LibraryPage() {
  const [activeSection, setActiveSection] =
    useState<LibrarySectionKey>("products");
  const [selectedProductId, setSelectedProductId] = useState(
    MOCK_PRODUCTS[0].id,
  );

  const selectedProduct =
    MOCK_PRODUCTS.find((product) => product.id === selectedProductId) ||
    MOCK_PRODUCTS[0];

  const navItems: Array<{ key: LibrarySectionKey; label: string }> = useMemo(
    () => [
      { key: "products", label: "Products" },
      { key: "text", label: "Text information" },
      { key: "avatars", label: "Avatars" },
      { key: "assets", label: "Assets" },
    ],
    [],
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
                  Library
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

                <div className="w-full max-w-sm rounded-xl border border-border bg-background/80 p-4">
                  <p className="mb-2 text-xs text-muted-foreground">
                    Selected product
                  </p>
                  <Select
                    value={selectedProductId}
                    onValueChange={setSelectedProductId}
                  >
                    <SelectTrigger className="h-10 w-full rounded-lg text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      align="end"
                      className="min-w-[220px]"
                    >
                      {MOCK_PRODUCTS.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="mt-3 rounded-lg border border-border bg-card px-3 py-3">
                    <p className="text-sm font-medium text-foreground">
                      {selectedProduct.name}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {selectedProduct.tagline}
                    </p>
                    <p className="mt-2 text-xs font-medium text-foreground/80">
                      Status: {selectedProduct.status}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {activeSection === "products" && (
              <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">
                    Product overview
                  </h2>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-lg border border-border bg-background/70 px-4 py-3">
                      <p className="text-xs text-muted-foreground">
                        Product name
                      </p>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {selectedProduct.name}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-background/70 px-4 py-3">
                      <p className="text-xs text-muted-foreground">Status</p>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {selectedProduct.status}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-background/70 px-4 py-3 sm:col-span-2">
                      <p className="text-xs text-muted-foreground">Summary</p>
                      <p className="mt-1 text-sm text-foreground">
                        {selectedProduct.tagline}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">
                    Library status
                  </h2>
                  <div className="mt-5 space-y-3 text-sm text-foreground">
                    <div className="rounded-lg border border-border bg-background/70 px-4 py-3">
                      Text information configured
                    </div>
                    <div className="rounded-lg border border-border bg-background/70 px-4 py-3">
                      Avatar set pending
                    </div>
                    <div className="rounded-lg border border-border bg-background/70 px-4 py-3">
                      Assets partially uploaded
                    </div>
                  </div>
                </div>
              </section>
            )}

            {activeSection === "text" && (
              <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">
                    Text information
                  </h2>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-lg border border-border bg-background/70 px-4 py-3">
                      <p className="text-xs text-muted-foreground">
                        Product name
                      </p>
                      <input
                        defaultValue={selectedProduct.name}
                        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
                      />
                    </div>
                    <div className="rounded-lg border border-border bg-background/70 px-4 py-3">
                      <p className="text-xs text-muted-foreground">Status</p>
                      <Select
                        defaultValue={selectedProduct.status.toLowerCase()}
                      >
                        <SelectTrigger className="mt-1 h-9 w-full rounded-md text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent
                          position="popper"
                          className="min-w-[180px]"
                        >
                          <SelectItem value="ready">Ready</SelectItem>
                          <SelectItem value="draft">Draft</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="rounded-lg border border-border bg-background/70 px-4 py-3 sm:col-span-2">
                      <p className="text-xs text-muted-foreground">
                        Description
                      </p>
                      <textarea
                        defaultValue="Add product summary, benefits, pricing, offers, CTA, and product-specific context here."
                        className="mt-1 min-h-28 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">
                    Content checklist
                  </h2>
                  <div className="mt-5 space-y-3 text-sm text-foreground">
                    <div className="rounded-lg border border-border bg-background/70 px-4 py-3">
                      Product description
                    </div>
                    <div className="rounded-lg border border-border bg-background/70 px-4 py-3">
                      Benefits & pain points
                    </div>
                    <div className="rounded-lg border border-border bg-background/70 px-4 py-3">
                      Pricing & offer
                    </div>
                    <div className="rounded-lg border border-border bg-background/70 px-4 py-3">
                      CTA & target audience
                    </div>
                  </div>
                </div>
              </section>
            )}

            {activeSection === "avatars" && (
              <section className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">
                    Avatars
                  </h2>
                  <div className="mt-5 space-y-4">
                    <div className="rounded-lg border border-border bg-background/70 px-4 py-3">
                      <p className="text-xs text-muted-foreground">
                        Avatar name
                      </p>
                      <input
                        defaultValue={`${selectedProduct.name} Host`}
                        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
                      />
                    </div>
                    <div className="rounded-lg border border-border bg-background/70 px-4 py-3">
                      <p className="text-xs text-muted-foreground">
                        Voice & persona
                      </p>
                      <textarea
                        defaultValue="Confident, friendly, product-focused presenter."
                        className="mt-1 min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">
                    Avatar notes
                  </h2>
                  <div className="mt-5 rounded-lg border border-border bg-background/70 px-4 py-4">
                    <p className="text-xs text-muted-foreground">Usage notes</p>
                    <textarea
                      defaultValue="Use this avatar for direct-response hooks and creator-style product demos."
                      className="mt-2 min-h-28 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
                    />
                  </div>
                </div>
              </section>
            )}

            {activeSection === "assets" && (
              <section className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">
                    Assets
                  </h2>
                  <div className="mt-5 space-y-4">
                    <div className="rounded-lg border border-border bg-background/70 px-4 py-3">
                      <p className="text-xs text-muted-foreground">
                        Upload URL
                      </p>
                      <input
                        placeholder="https://example.com/asset.jpg"
                        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
                      />
                    </div>
                    <div className="rounded-lg border border-border bg-background/70 px-4 py-3">
                      <p className="text-xs text-muted-foreground">
                        Asset type
                      </p>
                      <Select defaultValue="product-shot">
                        <SelectTrigger className="mt-1 h-9 w-full rounded-md text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent
                          position="popper"
                          className="min-w-[180px]"
                        >
                          <SelectItem value="product-shot">
                            Product shot
                          </SelectItem>
                          <SelectItem value="lifestyle">
                            Lifestyle media
                          </SelectItem>
                          <SelectItem value="logo">Logo</SelectItem>
                          <SelectItem value="overlay">Overlay</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">
                    Asset groups
                  </h2>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2 text-sm text-foreground">
                    <div className="rounded-lg border border-border bg-background/70 px-4 py-3">
                      Product shots
                    </div>
                    <div className="rounded-lg border border-border bg-background/70 px-4 py-3">
                      Lifestyle media
                    </div>
                    <div className="rounded-lg border border-border bg-background/70 px-4 py-3">
                      Logos & brand marks
                    </div>
                    <div className="rounded-lg border border-border bg-background/70 px-4 py-3">
                      Templates & overlays
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
