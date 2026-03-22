export enum AdStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  RENDERING = 'rendering',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum PipelineStage {
  SCRAPE = 'scrape',
  BRIEF = 'brief',
  SCRIPT = 'script',
  ASSETS = 'assets',
  VOICE = 'voice',
  SUBTITLES = 'subtitles',
  RENDER = 'render',
}

export enum StageStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  DONE = 'done',
  FAILED = 'failed',
}

export class StageProgress {
  scrape: StageStatus = StageStatus.PENDING;
  brief: StageStatus = StageStatus.PENDING;
  script: StageStatus = StageStatus.PENDING;
  assets: StageStatus = StageStatus.PENDING;
  voice: StageStatus = StageStatus.PENDING;
  subtitles: StageStatus = StageStatus.PENDING;
  render: StageStatus = StageStatus.PENDING;
}

export class CreateAdResponseDto {
  id: string;
  status: AdStatus;
}

export class AdStatusResponseDto {
  id: string;
  status: AdStatus;
  progress: number;
  stages: StageProgress;
  error_message?: string;
}

// Script related types
export class VoiceoverLine {
  scene: number;
  text: string;
}

export class ScriptDto {
  title: string;
  hook: string;
  voiceover_lines: VoiceoverLine[];
  cta: string;
}

// Scene related types
export class SceneDto {
  scene_id: number;
  duration_sec: number;
  visual_type: 'stock_video' | 'user_upload' | 'generated' | 'image';
  visual_prompt?: string;
  overlay_text?: string;
  camera_motion?: string;
  transition_in?: string;
  transition_out?: string;
  asset_url?: string;
}

// Subtitle related types
export class SubtitleSegment {
  start: number;
  end: number;
  text: string;
}

// Audio related types
export class AudioSegment {
  text: string;
  start: number;
  end: number;
  words: { word: string; start: number; end: number }[];
}

export class AudioTrackDto {
  audio_url: string;
  segments: AudioSegment[];
}

// Creative Brief types
export class CreativeBriefDto {
  product_name: string;
  offer: string;
  audience: string;
  pain_points: string[];
  benefits: string[];
  tone: string;
  language: string;
  duration_sec: number;
  platform: string;
  cta: string;
  visual_style: string;
  aspect_ratio: string;
}

// Full result types
export class AdResultDto {
  video_url: string;
  thumbnail_url: string;
  script: ScriptDto;
  subtitles: SubtitleSegment[];
  transcript: AudioSegment[];
  metadata: {
    platform: string;
    aspect_ratio: string;
    duration_sec: number;
    language: string;
    created_at: string;
  };
}
