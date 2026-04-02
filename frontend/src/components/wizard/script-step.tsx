'use client';

import { useWizard } from './wizard-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight01Icon, ArrowLeft01Icon, Loading01Icon } from '@hugeicons/core-free-icons';
import { generateWizardScript, type GeneratedScript } from '@/lib/api';

interface ScriptStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function ScriptStep({ onNext, onBack }: ScriptStepProps) {
  const {
    businessId,
    brief,
    script,
    isGenerating,
    error,
    setScript,
    setIsGenerating,
    setError,
  } = useWizard();

  const handleGenerateScript = async () => {
    if (!brief) return;

    setIsGenerating(true);
    setError(null);

    try {
      const result = await generateWizardScript({ businessId, brief });
      setScript(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate script');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleScriptChange = (field: keyof GeneratedScript, value: string) => {
    if (script) {
      const updated = { ...script, [field]: value };
      if (field !== 'full_text') {
        updated.full_text = [
          updated.hook,
          updated.body,
          updated.cta,
        ]
          .filter(Boolean)
          .join('\n\n');
      }
      setScript(updated);
    }
  };

  const canProceed = script && !isGenerating;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ad Script</CardTitle>
        <CardDescription>
          Review and edit the generated script for your ad.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!script && !isGenerating && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="mb-4 text-muted-foreground">
              Click generate to create a script based on your creative brief.
            </p>
            <Button onClick={handleGenerateScript} disabled={isGenerating || !brief}>
              Generate Script
            </Button>
          </div>
        )}

        {isGenerating && (
          <div className="flex flex-col items-center justify-center py-8">
            <HugeiconsIcon icon={Loading01Icon} className="mb-2 size-8 animate-spin" />
            <p className="text-muted-foreground">Generating ad script...</p>
          </div>
        )}

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {script && !isGenerating && (
          <>
            <div className="space-y-2">
              <Label>Title</Label>
              <Textarea
                value={script.title || ''}
                onChange={(e) => handleScriptChange('title', e.target.value)}
                rows={1}
              />
            </div>

            <div className="space-y-2">
              <Label>Hook</Label>
              <Textarea
                value={script.hook || ''}
                onChange={(e) => handleScriptChange('hook', e.target.value)}
                rows={2}
                placeholder="The opening line that grabs attention"
              />
            </div>

            <div className="space-y-2">
              <Label>Body</Label>
              <Textarea
                value={script.body || ''}
                onChange={(e) => handleScriptChange('body', e.target.value)}
                rows={4}
                placeholder="The main content of your ad"
              />
            </div>

            <div className="space-y-2">
              <Label>Call to Action</Label>
              <Textarea
                value={script.cta || ''}
                onChange={(e) => handleScriptChange('cta', e.target.value)}
                rows={2}
                placeholder="The closing line that drives action"
              />
            </div>

            <div className="space-y-2">
              <Label>Visual Description</Label>
              <Textarea
                value={script.visual_description || ''}
                onChange={(e) => handleScriptChange('visual_description', e.target.value)}
                rows={2}
                placeholder="Describe the visual elements"
              />
            </div>

            <div className="space-y-2">
              <Label>Full Script</Label>
              <Textarea
                value={script.full_text}
                onChange={(e) => handleScriptChange('full_text', e.target.value)}
                rows={6}
                className="font-mono text-sm"
              />
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={onBack}>
                <HugeiconsIcon icon={ArrowLeft01Icon} data-icon="inline-start" />
                Back
              </Button>
              <Button onClick={onNext} disabled={!canProceed}>
                Continue to Scene
                <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
