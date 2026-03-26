"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { getAdJobResult, type AdJobResultResponse } from "@/lib/api";
import { useAuth } from "@/lib/firebase/auth-provider";

type ResultClientProps = {
  id: string;
};

export function ResultClient({ id }: ResultClientProps) {
  const { platformContext } = useAuth();
  const [result, setResult] = useState<AdJobResultResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadResult() {
      try {
        setLoading(true);
        setError(null);

        const response = await getAdJobResult(id, platformContext?.account_id);

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
  }, [id, platformContext?.account_id]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background bg-mesh-blur font-sans">
      <Navbar />

      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-12 pt-28 sm:px-6 lg:px-8">
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

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
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
                className="h-auto w-full rounded-xl border border-border bg-black shadow-sm"
              />
            ) : (
              <div className="flex min-h-[420px] items-center justify-center text-sm text-muted-foreground">
                No video output is available yet.
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                Output summary
              </h2>
              <div className="mt-5 space-y-4 text-sm">
                <div className="rounded-lg border border-border bg-background/70 px-4 py-3">
                  <p className="text-xs text-muted-foreground">Job ID</p>
                  <p className="mt-1 break-all font-medium text-foreground">
                    {id}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-background/70 px-4 py-3">
                  <p className="text-xs text-muted-foreground">Thumbnail</p>
                  <p className="mt-1 font-medium text-foreground">
                    {result?.thumbnail_url ? "Available" : "Not available"}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-background/70 px-4 py-3">
                  <p className="text-xs text-muted-foreground">
                    Script artifact
                  </p>
                  <p className="mt-1 font-medium text-foreground">
                    {result?.script ? "Included" : "Unavailable"}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                Metadata
              </h2>
              <pre className="mt-5 overflow-x-auto rounded-lg border border-border bg-background/70 p-4 text-xs text-foreground/80">
                {JSON.stringify(result?.metadata ?? {}, null, 2)}
              </pre>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
