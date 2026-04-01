"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getAdJobResult, type AdJobResultResponse } from "@/lib/api";
import { useAuth } from "@/lib/firebase/auth-provider";

type ResultClientProps = {
  id: string;
};

/** Renders a single key-value row in the summary table. */
function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/70 px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium text-foreground">{value}</p>
    </div>
  );
}

/** Pipeline stage badge with colour coding. */
function StageBadge({ stage, status }: { stage: string; status: string }) {
  const colour =
    status === "done"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
      : status === "running"
        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
        : status === "failed"
          ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
          : "bg-muted text-muted-foreground";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${colour}`}
    >
      {stage}
      <span className="capitalize">{status}</span>
    </span>
  );
}

export function ResultClient({ id }: ResultClientProps) {
  const { platformContext, loading: authLoading } = useAuth();
  const [result, setResult] = useState<AdJobResultResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (authLoading) return; // Wait for AuthProvider to finish loading

    async function loadResult() {
      const businessId = platformContext?.account_id || "test-business-id";

      try {
        setLoading(true);
        setError(null);

        const response = await getAdJobResult(id, businessId);

        if (!cancelled) {
          setResult(response);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load result",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadResult();

    return () => {
      cancelled = true;
    };
  }, [id, platformContext, authLoading]);

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString();
  };

  return (
    <div className="relative min-h-screen bg-background bg-mesh-blur font-sans">
      <main className="mx-auto flex w-full max-w-6xl flex-col px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        <section className="rounded-xl border border-border bg-card/80 p-6 shadow-sm backdrop-blur-sm sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Results
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Generated video result
              </h1>
              <p className="text-sm text-muted-foreground sm:text-base">
                Review your generated video, metadata, and output assets for job{" "}
                {id}.
              </p>
            </div>

            <Button asChild variant="outline">
              <Link href="/">Create another</Link>
            </Button>
          </div>
        </section>

        {/* Video Section - Centered at top */}
        <section className="mt-6 flex justify-center">
          <div className="w-full max-w-4xl rounded-xl border border-border bg-card p-6 shadow-sm">
            {loading ? (
              <div className="flex min-h-[420px] items-center justify-center text-sm text-muted-foreground">
                Loading result…
              </div>
            ) : error ? (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : result?.video_url ? (
              <video
                src={result.video_url}
                controls
                autoPlay
                playsInline
                className="w-full aspect-video rounded-xl border border-border bg-black shadow-sm"
              />
            ) : (
              <div className="flex min-h-[420px] items-center justify-center text-sm text-muted-foreground">
                No video output is available yet.
              </div>
            )}
          </div>
        </section>

        {/* Output Summary - Below video */}
        <section className="mt-6 flex justify-center">
          <div className="w-full max-w-4xl rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Output summary
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
              <SummaryRow label="Job ID" value={id} />

              {result?.generationConfig && (
                <>
                  <SummaryRow
                    label="Platform"
                    value={
                      result.generationConfig.platform
                        ?.toUpperCase()
                        .replace("-", "") ?? "—"
                    }
                  />
                  <SummaryRow
                    label="Aspect ratio"
                    value={result.generationConfig.aspectRatio ?? "—"}
                  />
                  <SummaryRow
                    label="Duration"
                    value={
                      result.generationConfig.durationSec
                        ? `${result.generationConfig.durationSec}s`
                        : "—"
                    }
                  />
                </>
              )}

              <SummaryRow
                label="Status"
                value={
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${result?.pipeline.status === "completed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" : result?.pipeline.status === "failed" ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"}`}
                  >
                    {result?.pipeline.status ?? "unknown"}
                  </span>
                }
              />

              <SummaryRow
                label="Thumbnail"
                value={result?.thumbnail_url ? "Available" : "Not available"}
              />
              <SummaryRow
                label="Script artifact"
                value={result?.script ? "Included" : "Unavailable"}
              />
              <SummaryRow
                label="Creative brief"
                value={result?.creativeBrief ? "Included" : "Unavailable"}
              />
              <SummaryRow
                label="Subtitles"
                value={
                  Array.isArray(result?.subtitles) &&
                  result.subtitles.length > 0
                    ? `${result.subtitles.length} segments`
                    : "Not generated"
                }
              />
              <SummaryRow
                label="Created"
                value={formatDate(result?.timestamps.createdAt ?? null)}
              />
              <SummaryRow
                label="Updated"
                value={formatDate(result?.timestamps.updatedAt ?? null)}
              />
            </div>
          </div>
        </section>

        {/* Pipeline Stages */}
        {result?.pipeline.stages &&
          Object.keys(result.pipeline.stages).length > 0 && (
            <section className="mt-6 flex justify-center">
              <div className="w-full max-w-4xl rounded-xl border border-border bg-card p-6 shadow-sm">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">
                  Pipeline stages
                </h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {Object.entries(result.pipeline.stages).map(
                    ([stage, status]) => (
                      <StageBadge key={stage} stage={stage} status={status} />
                    ),
                  )}
                </div>
              </div>
            </section>
          )}

        {/* Script */}
        {result?.script && Object.keys(result.script).length > 0 && (
          <section className="mt-6 flex justify-center">
            <div className="w-full max-w-4xl rounded-xl border border-border bg-card p-6 shadow-sm">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                Script
              </h2>
              <pre className="mt-4 overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-background/70 p-4 text-xs leading-relaxed text-foreground/80">
                {JSON.stringify(result.script, null, 2)}
              </pre>
            </div>
          </section>
        )}

        {/* Creative Brief */}
        {result?.creativeBrief &&
          Object.keys(result.creativeBrief).length > 0 && (
            <section className="mt-6 flex justify-center">
              <div className="w-full max-w-4xl rounded-xl border border-border bg-card p-6 shadow-sm">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">
                  Creative brief
                </h2>
                <pre className="mt-4 overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-background/70 p-4 text-xs leading-relaxed text-foreground/80">
                  {JSON.stringify(result.creativeBrief, null, 2)}
                </pre>
              </div>
            </section>
          )}

        {/* Metadata */}
        <section className="mt-6 flex justify-center">
          <div className="w-full max-w-4xl rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Metadata
            </h2>
            <pre className="mt-4 overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-background/70 p-4 text-xs text-foreground/80">
              {JSON.stringify(result?.metadata ?? {}, null, 2)}
            </pre>
          </div>
        </section>
      </main>
    </div>
  );
}
