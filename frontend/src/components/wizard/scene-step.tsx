'use client';

import { useWizard } from './wizard-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight01Icon, ArrowLeft01Icon, Loading01Icon } from '@hugeicons/core-free-icons';
import { generateWizardScene, type VeoScenePrompt } from '@/lib/api';

interface SceneStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function SceneStep({ onNext, onBack }: SceneStepProps) {
  const {
    businessId,
    brief,
    script,
    scene,
    platform,
    aspectRatio,
    language,
    tone,
    targetAudience,
    cta,
    product,
    isGenerating,
    error,
    setScene,
    setIsGenerating,
    setError,
  } = useWizard();

  const handleGenerateScene = async () => {
    if (!brief || !script) return;

    setIsGenerating(true);
    setError(null);

    try {
      const result = await generateWizardScene({
        businessId,
        brief,
        script,
        platform,
        aspectRatio,
        language,
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
      });
      setScene(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate scene');
    } finally {
      setIsGenerating(false);
    }
  };

  const updateScenePrompt = (path: string, value: string) => {
    if (!scene) return;
    const keys = path.split('.');
    const updated = JSON.parse(JSON.stringify(scene)) as VeoScenePrompt;
    let current: Record<string, unknown> = updated.prompt;
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]] as Record<string, unknown>;
    }
    current[keys[keys.length - 1]] = value;
    setScene(updated);
  };

  const canProceed = scene && !isGenerating;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scene Configuration</CardTitle>
        <CardDescription>
          Review and customize the visual scene settings for your ad.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!scene && !isGenerating && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="mb-4 text-muted-foreground">
              Click generate to create scene settings based on your brief and script.
            </p>
            <Button
              onClick={handleGenerateScene}
              disabled={isGenerating || !brief || !script}
            >
              Generate Scene
            </Button>
          </div>
        )}

        {isGenerating && (
          <div className="flex flex-col items-center justify-center py-8">
            <HugeiconsIcon icon={Loading01Icon} className="mb-2 size-8 animate-spin" />
            <p className="text-muted-foreground">Generating scene configuration...</p>
          </div>
        )}

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {scene && !isGenerating && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Duration (seconds)</Label>
                <Input
                  type="number"
                  value={scene.duration_seconds}
                  onChange={(e) =>
                    setScene({
                      ...scene,
                      duration_seconds: Number(e.target.value),
                    })
                  }
                  min={1}
                  max={60}
                />
              </div>
              <div className="space-y-2">
                <Label>Aspect Ratio</Label>
                <Select
                  value={scene.aspect_ratio}
                  onValueChange={(v: '9:16' | '1:1' | '16:9') =>
                    setScene({ ...scene, aspect_ratio: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="9:16">9:16 (Vertical)</SelectItem>
                    <SelectItem value="1:1">1:1 (Square)</SelectItem>
                    <SelectItem value="16:9">16:9 (Horizontal)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Intent / Scene Description</Label>
              <Textarea
                value={scene.prompt.intent}
                onChange={(e) => updateScenePrompt('intent', e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Subject Description</Label>
              <Textarea
                value={scene.prompt.subject.description}
                onChange={(e) => updateScenePrompt('subject.description', e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Subject Action</Label>
              <Textarea
                value={scene.prompt.subject.action}
                onChange={(e) => updateScenePrompt('subject.action', e.target.value)}
                rows={2}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Transition In</Label>
                <Select
                  value={scene.transition_in}
                  onValueChange={(v) =>
                    setScene({
                      ...scene,
                      transition_in: v as VeoScenePrompt['transition_in'],
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cut">Cut</SelectItem>
                    <SelectItem value="fade">Fade</SelectItem>
                    <SelectItem value="slide">Slide</SelectItem>
                    <SelectItem value="dissolve">Dissolve</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Transition Out</Label>
                <Select
                  value={scene.transition_out}
                  onValueChange={(v) =>
                    setScene({
                      ...scene,
                      transition_out: v as VeoScenePrompt['transition_out'],
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cut">Cut</SelectItem>
                    <SelectItem value="fade">Fade</SelectItem>
                    <SelectItem value="slide">Slide</SelectItem>
                    <SelectItem value="dissolve">Dissolve</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Speech Text</Label>
              <Textarea
                value={scene.prompt.audio.speech_text}
                onChange={(e) => updateScenePrompt('audio.speech_text', e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={onBack}>
                <HugeiconsIcon icon={ArrowLeft01Icon} data-icon="inline-start" />
                Back
              </Button>
              <Button onClick={onNext} disabled={!canProceed}>
                Review & Submit
                <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
