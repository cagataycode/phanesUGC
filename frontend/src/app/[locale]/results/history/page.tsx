"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/routing";

type StoredGeneration = {
  id: string;
  title: string;
  createdAt: string;
};

const STORAGE_KEY = "phanes.generations";

export default function ResultsHistoryPage() {
  const router = useRouter();
  const [generations] = useState<StoredGeneration[] | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as StoredGeneration[]) : [];
    } catch {
      return [];
    }
  });

  return (
    <div className="relative min-h-screen overflow-hidden bg-background bg-mesh-blur font-sans">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-12 pt-28 sm:px-6 lg:px-8">
        <section className="rounded-xl border border-border bg-card/80 p-6 shadow-sm backdrop-blur-sm sm:p-8">
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Results
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Previous generations
            </h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              Browse your previous generated videos and reopen any result page.
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="space-y-4">
            {generations === null ? (
              <div className="rounded-xl border border-border bg-background/70 px-4 py-8 text-sm text-muted-foreground">
                Loading generations…
              </div>
            ) : generations.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-background/70 px-4 py-8 text-sm text-muted-foreground">
                No saved generations yet.
              </div>
            ) : (
              generations.map((generation) => (
                <div
                  key={generation.id}
                  className="flex flex-col gap-4 rounded-xl border border-border bg-background/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {generation.title}
                    </p>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>ID: {generation.id}</span>
                      <span>{generation.createdAt}</span>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => router.push(`/results/${generation.id}`)}
                  >
                    Open result
                  </Button>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
