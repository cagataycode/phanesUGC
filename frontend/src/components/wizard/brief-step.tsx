'use client';

import { useWizard } from './wizard-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight01Icon, ArrowLeft01Icon, Loading01Icon } from '@hugeicons/core-free-icons';
import { generateWizardBrief, type CreativeBrief } from '@/lib/api';

interface BriefStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function BriefStep({ onNext, onBack }: BriefStepProps) {
  const {
    businessId,
    productId,
    prompt,
    platform,
    language,
    tone,
    targetAudience,
    cta,
    product,
    brief,
    isGenerating,
    error,
    setBrief,
    setIsGenerating,
    setError,
  } = useWizard();

  const handleGenerateBrief = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const result = await generateWizardBrief({
        businessId,
        productId,
        prompt,
        platform,
        language,
        tone,
        target_audience: targetAudience,
        cta,
        product_info: product
          ? {
            name: product.name,
            description: product.description,
            benefits: product.benefits,
          }
          : undefined,
      });
      setBrief(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate brief');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleBriefChange = (field: keyof CreativeBrief, value: string | string[]) => {
    if (brief) {
      setBrief({ ...brief, [field]: value });
    }
  };

  const canProceed = brief && !isGenerating;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Creative Brief</CardTitle>
        <CardDescription>
          Review and edit the generated creative brief for your ad.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!brief && !isGenerating && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="mb-4 text-muted-foreground">
              Click generate to create a creative brief based on your inputs.
            </p>
            <Button onClick={handleGenerateBrief} disabled={isGenerating}>
              Generate Brief
            </Button>
          </div>
        )}

        {isGenerating && (
          <div className="flex flex-col items-center justify-center py-8">
            <HugeiconsIcon icon={Loading01Icon} className="mb-2 size-8 animate-spin" />
            <p className="text-muted-foreground">Generating creative brief...</p>
          </div>
        )}

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {brief && !isGenerating && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Product Name</Label>
                <Textarea
                  value={brief.product_name || ''}
                  onChange={(e) => handleBriefChange('product_name', e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Offer</Label>
                <Textarea
                  value={brief.offer || ''}
                  onChange={(e) => handleBriefChange('offer', e.target.value)}
                  rows={2}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Key Message</Label>
              <Textarea
                value={brief.key_message || ''}
                onChange={(e) => handleBriefChange('key_message', e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Target Audience</Label>
              <Textarea
                value={brief.audience || ''}
                onChange={(e) => handleBriefChange('audience', e.target.value)}
                rows={2}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Pain Points</Label>
                <Textarea
                  value={(brief.pain_points || []).join('\n')}
                  onChange={(e) =>
                    handleBriefChange(
                      'pain_points',
                      e.target.value.split('\n').filter(Boolean),
                    )
                  }
                  rows={3}
                  placeholder="One per line"
                />
              </div>
              <div className="space-y-2">
                <Label>Benefits</Label>
                <Textarea
                  value={(brief.benefits || []).join('\n')}
                  onChange={(e) =>
                    handleBriefChange(
                      'benefits',
                      e.target.value.split('\n').filter(Boolean),
                    )
                  }
                  rows={3}
                  placeholder="One per line"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tone</Label>
                <Textarea
                  value={brief.tone || ''}
                  onChange={(e) => handleBriefChange('tone', e.target.value)}
                  rows={1}
                />
              </div>
              <div className="space-y-2">
                <Label>Visual Style</Label>
                <Textarea
                  value={brief.visual_style || ''}
                  onChange={(e) => handleBriefChange('visual_style', e.target.value)}
                  rows={1}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Call to Action</Label>
              <Textarea
                value={brief.cta || ''}
                onChange={(e) => handleBriefChange('cta', e.target.value)}
                rows={1}
              />
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={onBack}>
                <HugeiconsIcon icon={ArrowLeft01Icon} data-icon="inline-start" />
                Back
              </Button>
              <Button onClick={onNext} disabled={!canProceed}>
                Continue to Script
                <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
