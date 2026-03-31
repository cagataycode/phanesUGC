import { VeoScenePrompt } from './veo-scene-prompt';
import * as admin from 'firebase-admin';

export interface SceneDocument {
  id: string;
  projectId: string;
  sceneOrder: number;
  durationSec: number;

  // Visual instructions
  visualType: 'ai_video';
  visualPrompt: string; // Serialized prompt string
  cameraMotion: string;
  overlayText: string | null;
  transitionIn: string;
  transitionOut: string;

  // Generated asset
  assetStorageKey: string | null;
  assetType: 'video';
  generationStatus: 'pending' | 'generating' | 'completed' | 'failed';
  generationError: string | null;

  // Store structured prompt for regeneration
  structuredPrompt: VeoScenePrompt['prompt'];
  negativePrompt: string;
  generationConfig: VeoScenePrompt['generation_config'];

  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}
