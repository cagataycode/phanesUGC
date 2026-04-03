import type { CreativeBrief, GeneratedScript, VeoScenePrompt } from '@/lib/api';
import type { ProductData, AvatarData } from '@/lib/firebase/hooks';

export type Platform = 'tiktok' | 'instagram' | 'youtube';
export type AspectRatio = '9:16' | '1:1' | '16:9';

export interface WizardState {
  step: number;
  businessId: string;
  productId: string;
  avatarId: string;
  product: ProductData | null;
  avatar: AvatarData | null;
  prompt: string;
  platform: Platform;
  aspectRatio: AspectRatio;
  language: string;
  tone: string;
  targetAudience: string;
  cta: string;
  brief: CreativeBrief | null;
  script: GeneratedScript | null;
  scene: VeoScenePrompt | null;
  isGenerating: boolean;
  error: string | null;
}

export const WIZARD_STEPS = ['Product', 'Brief', 'Script', 'Scene', 'Review'] as const;
export type WizardStepName = (typeof WIZARD_STEPS)[number];

export const INITIAL_WIZARD_STATE: WizardState = {
  step: 0,
  businessId: '',
  productId: '',
  avatarId: '',
  product: null,
  avatar: null,
  prompt: '',
  platform: 'tiktok',
  aspectRatio: '9:16',
  language: 'en',
  tone: '',
  targetAudience: '',
  cta: '',
  brief: null,
  script: null,
  scene: null,
  isGenerating: false,
  error: null,
};

export interface WizardContextValue extends WizardState {
  setStep: (step: number) => void;
  setBusinessId: (businessId: string) => void;
  setProductId: (id: string) => void;
  setAvatarId: (id: string) => void;
  setProduct: (product: ProductData | null) => void;
  setAvatar: (avatar: AvatarData | null) => void;
  setPrompt: (prompt: string) => void;
  setPlatform: (platform: Platform) => void;
  setAspectRatio: (ratio: AspectRatio) => void;
  setLanguage: (language: string) => void;
  setTone: (tone: string) => void;
  setTargetAudience: (audience: string) => void;
  setCta: (cta: string) => void;
  setBrief: (brief: CreativeBrief | null) => void;
  setScript: (script: GeneratedScript | null) => void;
  setScene: (scene: VeoScenePrompt | null) => void;
  setIsGenerating: (isGenerating: boolean) => void;
  setError: (error: string | null) => void;
  invalidateFromStep: (step: number) => void;
  reset: () => void;
}
