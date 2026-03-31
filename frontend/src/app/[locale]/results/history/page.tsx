"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/routing";
import { useAuth } from "@/lib/firebase/auth-provider";
import { listAdJobs, type AdJobListItem } from "@/lib/api";

export default function ResultsHistoryPage() {
  const router = useRouter();
  const { platformContext } = useAuth();
  const businessId = platformContext?.account_id;

  const [generations, setGenerations] = useState<AdJobListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    if (!businessId) return;

    let cancelled = false;

    listAdJobs(businessId)
      .then((jobs) => {
        if (!cancelled) {
          setGenerations(jobs);
          setHasFetched(true);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to load generations:", err);
          setError(
            err instanceof Error ? err.message : "Failed to load generations.",
          );
          setHasFetched(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [businessId]);

  const isLoading = businessId ? !hasFetched && !error : false;

  function formatDate(timestamp: { _seconds: number }): string {
    try {
      return new Date(timestamp._seconds * 1000).toLocaleString();
    } catch {
      return "Unknown date";
    }
  }

  function getDisplayTitle(job: AdJobListItem): string {
    if (job.prompt) {
      return job.prompt.length > 80
        ? job.prompt.slice(0, 80) + "…"
        : job.prompt;
    }
    return `Ad Generation ${job.id.slice(0, 8)}`;
  }

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
            {isLoading ? (
              <div className="rounded-xl border border-border bg-background/70 px-4 py-8 text-sm text-muted-foreground">
                Loading generations…
              </div>
            ) : error ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-8 text-center">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            ) : generations.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-background/70 px-4 py-8 text-sm text-muted-foreground">
                No saved generations yet.
              </div>
            ) : (
              generations.map((job) => (
                <div
                  key={job.id}
                  className="flex flex-col gap-4 rounded-xl border border-border bg-background/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {getDisplayTitle(job)}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>ID: {job.id}</span>
                      <span>{formatDate(job.createdAt)}</span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          job.status === "completed"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : job.status === "failed"
                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                              : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                        }`}
                      >
                        {job.status}
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => router.push(`/results/${job.id}`)}
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
