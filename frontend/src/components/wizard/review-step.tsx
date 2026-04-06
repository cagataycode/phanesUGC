'use client';

import { useWizard } from './wizard-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, CheckmarkCircle02Icon, Loading01Icon } from '@hugeicons/core-free-icons';
import { submitWizardJob } from '@/lib/api';
import { useState } from 'react';

interface ReviewStepProps {
  onBack: () => void;
  onSubmit: (jobId: string) => void;
}

export function ReviewStep({ onBack, onSubmit }: ReviewStepProps) {
  const {
    businessId,
    productId,
    product,
    prompt,
    platform,
    aspectRatio,
    language,
    tone,
    targetAudience,
    cta,
    brief,
    script,
    scene,
  } = useWizard();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!scene) {
      setError('Scene configuration is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (!brief || !script) {
        setError('Brief and script are required.');
        return;
      }

      const payload = {
        businessId,
        productId: productId || 'test-product-id',
        createdBy: 'wizard',
        prompt,
        platform: platform as 'tiktok' | 'instagram' | 'youtube',
        language: language as 'en' | 'de',
        tone: tone || undefined,
        target_audience: targetAudience || undefined,
        cta: cta || undefined,
        product_info: product
          ? {
              name: product.name,
              description: product.description,
              benefits: product.benefits,
            }
          : undefined,
        aspect_ratio: aspectRatio as '9:16' | '1:1' | '16:9',
        subtitle_style: 'standard' as const,
        brief,
        script,
        scene,
      };

      const job = await submitWizardJob(payload);
      
      if (typeof window !== 'undefined') {
        try {
          const storageKey = 'phanes.generations';
          const raw = window.localStorage.getItem(storageKey);
          const current = raw
            ? (JSON.parse(raw) as Array<{
                id: string;
                title: string;
                createdAt: string;
              }>)
            : [];
          const next = [
            {
              id: job.id,
              title: prompt.trim() || 'Untitled generation',
              createdAt: new Date().toISOString(),
            },
            ...current.filter((item) => item.id !== job.id),
          ].slice(0, 20);
          window.localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          // ignore local storage failures
        }
      }

      onSubmit(job.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create ad job');
    } finally {
      setIsSubmitting(false);
    }
  };

  const platformLabels: Record<string, string> = {
    tiktok: 'TikTok',
    instagram: 'Instagram',
    youtube: 'YouTube',
  };

  const aspectRatioLabels: Record<string, string> = {
    '9:16': '9:16 (Vertical)',
    '1:1': '1:1 (Square)',
    '16:9': '16:9 (Horizontal)',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review & Submit</CardTitle>
        <CardDescription>
          Review your ad configuration before submitting for generation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div className="rounded-lg border p-4">
            <h4 className="mb-2 font-medium">Product</h4>
            <p className="text-sm text-muted-foreground">
              {product ? product.name : 'No product selected'}
            </p>
            {product?.description && (
              <p className="mt-1 text-xs text-muted-foreground">
                {product.description}
              </p>
            )}
          </div>

          <div className="rounded-lg border p-4">
            <h4 className="mb-2 font-medium">Prompt</h4>
            <p className="text-sm text-muted-foreground">
              {prompt || 'No prompt provided'}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border p-4">
              <h4 className="mb-2 font-medium">Platform</h4>
              <p className="text-sm text-muted-foreground">
                {platformLabels[platform] || platform}
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <h4 className="mb-2 font-medium">Aspect Ratio</h4>
              <p className="text-sm text-muted-foreground">
                {aspectRatioLabels[aspectRatio] || aspectRatio}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border p-4">
              <h4 className="mb-2 font-medium">Language</h4>
              <p className="text-sm text-muted-foreground">
                {language === 'en' ? 'English' : language === 'de' ? 'German' : language}
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <h4 className="mb-2 font-medium">Tone</h4>
              <p className="text-sm text-muted-foreground">
                {tone || 'Not specified'}
              </p>
            </div>
          </div>

          {targetAudience && (
            <div className="rounded-lg border p-4">
              <h4 className="mb-2 font-medium">Target Audience</h4>
              <p className="text-sm text-muted-foreground">{targetAudience}</p>
            </div>
          )}

          {cta && (
            <div className="rounded-lg border p-4">
              <h4 className="mb-2 font-medium">Call to Action</h4>
              <p className="text-sm text-muted-foreground">{cta}</p>
            </div>
          )}

          {brief && (
            <div className="rounded-lg border p-4">
              <h4 className="mb-2 font-medium">Creative Brief</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                {brief.offer && (
                  <p>
                    <span className="font-medium text-foreground">Offer:</span>{' '}
                    {brief.offer}
                  </p>
                )}
                {brief.key_message && (
                  <p>
                    <span className="font-medium text-foreground">Key Message:</span>{' '}
                    {brief.key_message}
                  </p>
                )}
                {brief.visual_style && (
                  <p>
                    <span className="font-medium text-foreground">Visual Style:</span>{' '}
                    {brief.visual_style}
                  </p>
                )}
              </div>
            </div>
          )}

          {script && (
            <div className="rounded-lg border p-4">
              <h4 className="mb-2 font-medium">Script</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {script.full_text || 'No script text available'}
              </p>
            </div>
          )}

          {scene && (
            <div className="rounded-lg border p-4">
              <h4 className="mb-2 font-medium">Scene Configuration</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">Duration:</span>{' '}
                  {scene.duration_seconds}s
                </p>
                <p>
                  <span className="font-medium text-foreground">Intent:</span>{' '}
                  {scene.prompt.intent}
                </p>
                <p>
                  <span className="font-medium text-foreground">Subject:</span>{' '}
                  {scene.prompt.subject.description}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={onBack} disabled={isSubmitting}>
            <HugeiconsIcon icon={ArrowLeft01Icon} data-icon="inline-start" />
            Back
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !scene}>
            {isSubmitting ? (
              <>
                <HugeiconsIcon icon={Loading01Icon} className="animate-spin" data-icon="inline-start" />
                Submitting...
              </>
            ) : (
              <>
                Create Ad
                <HugeiconsIcon icon={CheckmarkCircle02Icon} data-icon="inline-end" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
