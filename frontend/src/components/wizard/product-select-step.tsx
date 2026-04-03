'use client';

import { useWizard } from './wizard-context';
import { useAuth } from '@/lib/firebase/auth-provider';
import { useProducts, useAvatars, useProduct, useAvatar } from '@/lib/firebase/hooks';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { useEffect } from 'react';

interface ProductSelectStepProps {
  onNext: () => void;
}

export function ProductSelectStep({ onNext }: ProductSelectStepProps) {
  const {
    productId,
    avatarId,
    product,
    avatar,
    prompt,
    platform,
    language,
    tone,
    targetAudience,
    cta,
    setProductId,
    setAvatarId,
    setProduct,
    setAvatar,
    setPrompt,
    setPlatform,
    setLanguage,
    setTone,
    setTargetAudience,
    setCta,
    setBusinessId,
    invalidateFromStep,
  } = useWizard();

  const { user, platformContext } = useAuth();
  const businessId =
    platformContext?.account_id ||
    process.env.NEXT_PUBLIC_DEFAULT_BUSINESS_ID ||
    'test-business-id';

  useEffect(() => {
    if (businessId) {
      setBusinessId(businessId);
    }
  }, [businessId, setBusinessId]);

  const { products } = useProducts(user ? businessId : undefined);
  const { avatars } = useAvatars(user ? businessId : undefined);
  const { product: fetchedProduct } = useProduct(
    productId ? businessId : undefined,
    productId || undefined,
  );
  const { avatar: fetchedAvatar } = useAvatar(
    avatarId ? businessId : undefined,
    avatarId || undefined,
  );

  useEffect(() => {
    if (fetchedProduct && fetchedProduct.id !== product?.id) {
      setProduct(fetchedProduct);
      if (fetchedProduct.defaults?.tone) setTone(fetchedProduct.defaults.tone);
      if (fetchedProduct.defaults?.targetAudience)
        setTargetAudience(fetchedProduct.defaults.targetAudience);
      if (fetchedProduct.defaults?.language) setLanguage(fetchedProduct.defaults.language);
      if (fetchedProduct.defaults?.cta) setCta(fetchedProduct.defaults.cta);
    }
  }, [fetchedProduct, product?.id, setProduct, setTone, setTargetAudience, setLanguage, setCta]);

  useEffect(() => {
    if (fetchedAvatar && fetchedAvatar.id !== avatar?.id) {
      setAvatar(fetchedAvatar);
    }
  }, [fetchedAvatar, avatar?.id, setAvatar]);

  const handleProductChange = (value: string) => {
    setProductId(value);
    invalidateFromStep(1);
  };

  const handleAvatarChange = (value: string) => {
    setAvatarId(value);
    invalidateFromStep(1);
  };

  const canProceed = productId && prompt.trim().length >= 5;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Product & Prompt</CardTitle>
        <CardDescription>
          Select a product and avatar, then describe your ad concept.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="product">Product</Label>
            <Select value={productId} onValueChange={handleProductChange}>
              <SelectTrigger id="product">
                <SelectValue placeholder="Select a product" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="avatar">Avatar (optional)</Label>
            <Select value={avatarId} onValueChange={handleAvatarChange}>
              <SelectTrigger id="avatar">
                <SelectValue placeholder="Select an avatar" />
              </SelectTrigger>
              <SelectContent>
                {avatars.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="prompt">Ad Concept *</Label>
          <Textarea
            id="prompt"
            placeholder="Describe your ad concept..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="platform">Platform</Label>
            <Select value={platform} onValueChange={(v: 'tiktok' | 'instagram' | 'youtube') => setPlatform(v)}>
              <SelectTrigger id="platform">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tiktok">TikTok</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="youtube">YouTube</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="language">Language</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger id="language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="de">German</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="tone">Tone (optional)</Label>
            <Input
              id="tone"
              placeholder="e.g., energetic, professional"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="targetAudience">Target Audience (optional)</Label>
            <Input
              id="targetAudience"
              placeholder="e.g., young adults, professionals"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cta">Call to Action (optional)</Label>
          <Input
            id="cta"
            placeholder="e.g., Shop Now, Learn More"
            value={cta}
            onChange={(e) => setCta(e.target.value)}
          />
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={onNext} disabled={!canProceed}>
            Generate Brief
            <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
