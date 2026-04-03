'use client';

import { createContext, useContext, useReducer, useCallback, type ReactNode } from 'react';
import type { CreativeBrief, GeneratedScript, VeoScenePrompt } from '@/lib/api';
import type { ProductData, AvatarData } from '@/lib/firebase/hooks';
import { INITIAL_WIZARD_STATE, type WizardState, type WizardContextValue, type Platform, type AspectRatio } from './types';

type WizardAction =
  | { type: 'SET_STEP'; payload: number }
  | { type: 'SET_BUSINESS_ID'; payload: string }
  | { type: 'SET_PRODUCT_ID'; payload: string }
  | { type: 'SET_AVATAR_ID'; payload: string }
  | { type: 'SET_PRODUCT'; payload: ProductData | null }
  | { type: 'SET_AVATAR'; payload: AvatarData | null }
  | { type: 'SET_PROMPT'; payload: string }
  | { type: 'SET_PLATFORM'; payload: Platform }
  | { type: 'SET_ASPECT_RATIO'; payload: AspectRatio }
  | { type: 'SET_LANGUAGE'; payload: string }
  | { type: 'SET_TONE'; payload: string }
  | { type: 'SET_TARGET_AUDIENCE'; payload: string }
  | { type: 'SET_CTA'; payload: string }
  | { type: 'SET_BRIEF'; payload: CreativeBrief | null }
  | { type: 'SET_SCRIPT'; payload: GeneratedScript | null }
  | { type: 'SET_SCENE'; payload: VeoScenePrompt | null }
  | { type: 'SET_IS_GENERATING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'INVALIDATE_FROM_STEP'; payload: number }
  | { type: 'RESET' };

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, step: action.payload };
    case 'SET_BUSINESS_ID':
      return { ...state, businessId: action.payload };
    case 'SET_PRODUCT_ID':
      return { ...state, productId: action.payload };
    case 'SET_AVATAR_ID':
      return { ...state, avatarId: action.payload };
    case 'SET_PRODUCT':
      return { ...state, product: action.payload };
    case 'SET_AVATAR':
      return { ...state, avatar: action.payload };
    case 'SET_PROMPT':
      return { ...state, prompt: action.payload };
    case 'SET_PLATFORM':
      return { ...state, platform: action.payload };
    case 'SET_ASPECT_RATIO':
      return { ...state, aspectRatio: action.payload };
    case 'SET_LANGUAGE':
      return { ...state, language: action.payload };
    case 'SET_TONE':
      return { ...state, tone: action.payload };
    case 'SET_TARGET_AUDIENCE':
      return { ...state, targetAudience: action.payload };
    case 'SET_CTA':
      return { ...state, cta: action.payload };
    case 'SET_BRIEF':
      return { ...state, brief: action.payload };
    case 'SET_SCRIPT':
      return { ...state, script: action.payload };
    case 'SET_SCENE':
      return { ...state, scene: action.payload };
    case 'SET_IS_GENERATING':
      return { ...state, isGenerating: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'INVALIDATE_FROM_STEP':
      const invalidated: WizardState = { ...state };
      if (action.payload <= 1) {
        invalidated.brief = null;
        invalidated.script = null;
        invalidated.scene = null;
      }
      if (action.payload <= 2) {
        invalidated.script = null;
        invalidated.scene = null;
      }
      if (action.payload <= 3) {
        invalidated.scene = null;
      }
      return invalidated;
    case 'RESET':
      return INITIAL_WIZARD_STATE;
    default:
      return state;
  }
}

const WizardContext = createContext<WizardContextValue | null>(null);

export function WizardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(wizardReducer, INITIAL_WIZARD_STATE);

  const setStep = useCallback((step: number) => dispatch({ type: 'SET_STEP', payload: step }), []);
  const setBusinessId = useCallback((businessId: string) => dispatch({ type: 'SET_BUSINESS_ID', payload: businessId }), []);
  const setProductId = useCallback((id: string) => dispatch({ type: 'SET_PRODUCT_ID', payload: id }), []);
  const setAvatarId = useCallback((id: string) => dispatch({ type: 'SET_AVATAR_ID', payload: id }), []);
  const setProduct = useCallback((product: ProductData | null) => dispatch({ type: 'SET_PRODUCT', payload: product }), []);
  const setAvatar = useCallback((avatar: AvatarData | null) => dispatch({ type: 'SET_AVATAR', payload: avatar }), []);
  const setPrompt = useCallback((prompt: string) => dispatch({ type: 'SET_PROMPT', payload: prompt }), []);
  const setPlatform = useCallback((platform: Platform) => dispatch({ type: 'SET_PLATFORM', payload: platform }), []);
  const setAspectRatio = useCallback((ratio: AspectRatio) => dispatch({ type: 'SET_ASPECT_RATIO', payload: ratio }), []);
  const setLanguage = useCallback((language: string) => dispatch({ type: 'SET_LANGUAGE', payload: language }), []);
  const setTone = useCallback((tone: string) => dispatch({ type: 'SET_TONE', payload: tone }), []);
  const setTargetAudience = useCallback((audience: string) => dispatch({ type: 'SET_TARGET_AUDIENCE', payload: audience }), []);
  const setCta = useCallback((cta: string) => dispatch({ type: 'SET_CTA', payload: cta }), []);
  const setBrief = useCallback((brief: CreativeBrief | null) => dispatch({ type: 'SET_BRIEF', payload: brief }), []);
  const setScript = useCallback((script: GeneratedScript | null) => dispatch({ type: 'SET_SCRIPT', payload: script }), []);
  const setScene = useCallback((scene: VeoScenePrompt | null) => dispatch({ type: 'SET_SCENE', payload: scene }), []);
  const setIsGenerating = useCallback((isGenerating: boolean) => dispatch({ type: 'SET_IS_GENERATING', payload: isGenerating }), []);
  const setError = useCallback((error: string | null) => dispatch({ type: 'SET_ERROR', payload: error }), []);
  const invalidateFromStep = useCallback((step: number) => dispatch({ type: 'INVALIDATE_FROM_STEP', payload: step }), []);
  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  const value: WizardContextValue = {
    ...state,
    setStep,
    setBusinessId,
    setProductId,
    setAvatarId,
    setProduct,
    setAvatar,
    setPrompt,
    setPlatform,
    setAspectRatio,
    setLanguage,
    setTone,
    setTargetAudience,
    setCta,
    setBrief,
    setScript,
    setScene,
    setIsGenerating,
    setError,
    invalidateFromStep,
    reset,
  };

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
}

export function useWizard(): WizardContextValue {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within a WizardProvider');
  }
  return context;
}
