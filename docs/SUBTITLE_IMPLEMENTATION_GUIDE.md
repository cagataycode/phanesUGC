# Subtitle Pipeline Implementation Guide

**Date:** 2026-03-28
**For:** IDE Agent / Implementation Engineer
**Status:** Ready for Implementation

---

## IMPORTANT: Corrections to Existing Plan Documents

The current PRD (`MVP_Technical_PRD.md`) section 2.4 and section 3.3 state that subtitle generation, audio extraction, transcription, forced alignment, and caption burn-in are **deferred** from the current delivery slice. **This is outdated.** These features are now in scope and must be implemented as part of the current build.

Additionally, the PRD references TTS generation in several places (sections 7, 8, 10, 18). **PhanesUGC does not use a separate TTS service.** Veo 3 generates video with embedded speech and audio. The subtitle pipeline starts by extracting audio from the Veo output — there is no standalone voiceover generation step.

The three reference documents you should also have in context are:

1. **`MVP_Technical_PRD (1).md`** — Full PRD. Sections 7.7, 7.8, 7.9, 8.2, 10.1, 12, 15, and 22 are most relevant.
2. **`firestore_schema.md`** — Firestore schema. The `projects/{projectId}` document defines `subtitleSegments`, `audioTrack`, and `output` fields.
3. **`firebase_firestore_setup.md`** — Firestore indexes, security rules, GCS CORS setup.

**Treat this guide as authoritative where it conflicts with the plan documents.**

---

## Architecture Context

```
Veo 3 Output (MP4 with embedded speech/audio)
  -> FFmpeg: extract + normalize audio
  -> faster-whisper: transcribe with word-level timestamps
  -> Forced alignment (optional refinement): aeneas or Gentle
  -> Subtitle chunker: phrase-aware segmentation
  -> Firestore: store subtitleSegments on project document
  -> Remotion: render burned-in captions with word highlighting
  -> Final MP4 export
```

---

## Phase 1: Audio Extraction from Veo Output

### Goal
Extract the speech/audio track from the Veo-generated MP4 and normalize it for transcription.

### Why
Veo 3 outputs video with embedded speech. There is no separate audio file. The transcription model needs clean mono 16kHz WAV input.

### Implementation

#### 1.1 Create the audio extraction service

**File:** `src/services/audio-extraction.service.ts` (NestJS service)

Responsibilities:
- Accept a GCS storage key pointing to a Veo-generated MP4
- Download the MP4 to a temp directory (or stream from signed URL)
- Run FFmpeg to extract and normalize audio
- Upload the resulting WAV to GCS
- Update the project document with `audioTrack` metadata
- Clean up temp files

**FFmpeg command:**
```bash
ffmpeg -i input.mp4 -vn -ac 1 -ar 16000 -c:a pcm_s16le output.wav
```

Flags:
- `-vn` — strip video
- `-ac 1` — mono
- `-ar 16000` — 16kHz sample rate
- `-c:a pcm_s16le` — 16-bit PCM WAV (required by faster-whisper)

#### 1.2 GCS upload path

Follow the convention from `firestore_schema.md`:
```
businesses/{bizId}/projects/{projectId}/audio/extracted.wav
```

#### 1.3 Firestore update

After successful extraction, update the project document:

```typescript
await projectRef.update({
  'audioTrack.storageKey': gcsPath,
  'audioTrack.format': 'wav',
  'audioTrack.sampleRateHz': 16000,
  'audioTrack.channels': 1,
  'stages.audio': 'done',
  updatedAt: FieldValue.serverTimestamp(),
});
```

#### 1.4 Error handling

- If FFmpeg exits non-zero, set `stages.audio = 'failed'` and store error in `errorMessage`
- If the input MP4 has no audio stream, this is a hard failure — Veo should always produce audio, so flag for investigation
- Retry up to 2 times on transient failures (download timeout, temp disk full)

#### 1.5 Dependencies

- `fluent-ffmpeg` npm package or direct `child_process.spawn` with system FFmpeg
- FFmpeg must be installed on the worker/container image

---

## Phase 2: Speech Transcription with Word-Level Timestamps

### Goal
Transcribe the extracted WAV and produce word-level timestamps.

### Why
Word-level timing is required for karaoke-style and kinetic subtitle highlighting in Remotion.

### Tool Choice: faster-whisper

**Why faster-whisper over alternatives:**
- CTranslate2 backend — 4x faster than OpenAI Whisper, lower VRAM
- Native word-level timestamp support (`word_timestamps=True`)
- Runs locally — no API costs, no data leaving EU infrastructure
- Apache 2.0 license
- `large-v3` model gives best accuracy; `medium` is acceptable for MVP if GPU-constrained

**Alternatives considered and rejected:**
- OpenAI Whisper API — sends audio to US servers, violates EU data residency
- Google Speech-to-Text — viable fallback but adds API cost; faster-whisper is preferred for MVP
- whisper.cpp — good for CPU-only but fewer Python integrations

### Implementation

#### 2.1 Create the transcription service

**File:** `src/services/transcription.service.ts`

This service will call a Python sidecar/worker (faster-whisper is Python-only). Two approaches:

**Option A — Python microservice (recommended):**
A lightweight FastAPI service that accepts a WAV file URL and returns transcription JSON. Deploy as a separate Cloud Run service or container in the same cluster.

**Option B — Python child process:**
Shell out to a Python script from NestJS. Simpler but harder to scale independently.

#### 2.2 Python transcription worker

```python
from faster_whisper import WhisperModel

model = WhisperModel("large-v3", device="cuda", compute_type="float16")
# For CPU-only: device="cpu", compute_type="int8"

def transcribe(audio_path: str) -> dict:
    segments, info = model.transcribe(
        audio_path,
        word_timestamps=True,
        language="en",  # or detect from project.language
        vad_filter=True,
        vad_parameters=dict(min_silence_duration_ms=500),
    )

    words = []
    for segment in segments:
        for word in segment.words:
            words.append({
                "word": word.word.strip(),
                "start": round(word.start, 3),
                "end": round(word.end, 3),
                "confidence": round(word.probability, 3),
            })

    return {
        "language": info.language,
        "language_probability": round(info.language_probability, 3),
        "words": words,
    }
```

#### 2.3 Output format

The transcription service returns a flat word list:

```json
{
  "language": "en",
  "language_probability": 0.98,
  "words": [
    {"word": "Creating", "start": 0.42, "end": 0.88, "confidence": 0.95},
    {"word": "ad", "start": 0.89, "end": 1.12, "confidence": 0.97},
    {"word": "videos", "start": 1.13, "end": 1.95, "confidence": 0.93}
  ]
}
```

This raw word list is the input for Phase 3 (forced alignment) and Phase 4 (chunking).

#### 2.4 Infrastructure notes

- The transcription worker needs GPU for acceptable speed (~10s for a 30s clip with `large-v3` on T4)
- On CPU with `int8` quantization, expect ~60s for a 30s clip — acceptable for MVP
- Model file is ~3GB for `large-v3` — bake into the container image, do not download at runtime
- For MVP, a single worker instance is fine. Queue ensures serial processing.

#### 2.5 Error handling

- If confidence across all words averages below 0.5, flag the transcription as low quality
- If faster-whisper produces no words (silent audio), set `stages.subtitles = 'failed'`
- Store raw transcription JSON in GCS as a debug artifact:
  ```
  businesses/{bizId}/projects/{projectId}/audio/transcription_raw.json
  ```

---

## Phase 3: Forced Alignment (Timing Refinement)

### Goal
Refine word-level timestamps from faster-whisper using forced alignment against the known script text.

### Why
Whisper's word timestamps can drift by 50-200ms. For karaoke-style highlighting where a word lights up as it is spoken, even 100ms of drift is visually noticeable. Forced alignment reduces this to <50ms.

### When to apply
- **Always run** if the script text is available (it should be — it is generated in an earlier pipeline stage)
- If the script text is not available, skip alignment and use raw Whisper timestamps (graceful degradation)

### Tool Choice: aeneas

**Why aeneas:**
- Python library with C extensions — fast
- Accepts a text file + audio file, outputs per-fragment timing
- Proven for audiobook/subtitle alignment
- Works at sentence or word level
- No GPU required

**Alternatives:**
- Gentle — good accuracy but requires a running server, heavier setup
- Montreal Forced Aligner (MFA) — academic-grade but complex installation, overkill for short clips
- For MVP, aeneas is the simplest path. Can swap to Gentle later if accuracy is insufficient.

### Implementation

#### 3.1 Alignment logic

```python
from aeneas.executetask import ExecuteTask
from aeneas.task import Task
import json

def forced_align(audio_path: str, script_text: str) -> list:
    """
    script_text: full narration text (from project.script.voiceoverLines joined)
    Returns refined word-level timestamps.
    """
    words = script_text.split()
    text_path = "/tmp/align_input.txt"
    with open(text_path, "w") as f:
        for word in words:
            f.write(word + "\n")

    output_path = "/tmp/align_output.json"

    config = (
        "task_language=eng"
        "|is_text_type=plain"
        "|os_task_file_format=json"
    )

    task = Task(config_string=config)
    task.audio_file_path_absolute = audio_path
    task.text_file_path_absolute = text_path
    task.sync_map_file_path_absolute = output_path

    ExecuteTask(task).execute()
    task.output_sync_map_file()

    with open(output_path) as f:
        sync_map = json.load(f)

    aligned_words = []
    for fragment in sync_map["fragments"]:
        aligned_words.append({
            "word": fragment["lines"][0],
            "start": float(fragment["begin"]),
            "end": float(fragment["end"]),
        })

    return aligned_words
```

#### 3.2 Merging alignment with transcription

After forced alignment, merge the refined timestamps with the Whisper confidence scores:

```python
def merge_alignment(whisper_words: list, aligned_words: list) -> list:
    """Use aligned timestamps but keep Whisper confidence scores."""
    merged = []
    for i, aw in enumerate(aligned_words):
        entry = {
            "word": aw["word"],
            "start": aw["start"],
            "end": aw["end"],
        }
        if i < len(whisper_words):
            entry["confidence"] = whisper_words[i].get("confidence", 1.0)
        merged.append(entry)
    return merged
```

#### 3.3 Fallback

If aeneas fails (e.g., audio/text mismatch too large), fall back to raw Whisper timestamps. Log a warning but do not block the pipeline.

---

## Phase 4: Subtitle Chunking

### Goal
Convert the flat word list into phrase-aware subtitle segments suitable for display.

### Why
Raw word-by-word display is unreadable. Subtitles must be grouped into readable phrases with sensible line breaks.

### Rules (from PRD section 7.8)

1. **Phrase-aware breaking** — break at punctuation and natural clause boundaries
2. **Max ~42 characters per line** (standard for mobile vertical video)
3. **Max 2 lines per segment**
4. **Minimum display duration: 1.0 seconds** per segment
5. **No orphan single-word lines** where avoidable
6. **Punctuation-aware splitting** — prefer breaks after commas, periods, dashes

### Implementation

#### 4.1 Chunking algorithm

```python
import math

def chunk_subtitles(
    words: list,
    max_chars_per_line: int = 42,
    max_lines: int = 2,
    min_duration_sec: float = 1.0,
) -> list:
    segments = []
    current_words = []
    current_text = ""

    for word_entry in words:
        test_text = (current_text + " " + word_entry["word"]).strip()
        lines_needed = max(1, math.ceil(len(test_text) / max_chars_per_line))

        is_punctuation_break = current_text and current_text[-1] in ".!?;:"
        exceeds_lines = lines_needed > max_lines

        if exceeds_lines or (is_punctuation_break and len(current_words) >= 2):
            if current_words:
                segments.append(build_segment(current_words))
            current_words = [word_entry]
            current_text = word_entry["word"]
        else:
            current_words.append(word_entry)
            current_text = test_text

    if current_words:
        segments.append(build_segment(current_words))

    segments = merge_short_segments(segments, min_duration_sec, max_chars_per_line, max_lines)
    return segments


def build_segment(words: list) -> dict:
    return {
        "start": words[0]["start"],
        "end": words[-1]["end"],
        "text": " ".join(w["word"] for w in words),
        "words": [
            {"word": w["word"], "start": w["start"], "end": w["end"]}
            for w in words
        ],
    }


def merge_short_segments(segments, min_dur, max_chars, max_lines):
    merged = []
    for seg in segments:
        if (merged
            and (seg["end"] - seg["start"]) < min_dur
            and max(1, math.ceil(
                len(merged[-1]["text"] + " " + seg["text"]) / max_chars
            )) <= max_lines):
            merged[-1]["end"] = seg["end"]
            merged[-1]["text"] += " " + seg["text"]
            merged[-1]["words"].extend(seg["words"])
        else:
            merged.append(seg)
    return merged
```

#### 4.2 Output format

Matches the schema from `firestore_schema.md` (`subtitleSegments`):

```json
[
  {
    "start": 0.42,
    "end": 1.95,
    "text": "Creating ad videos",
    "words": [
      {"word": "Creating", "start": 0.42, "end": 0.88},
      {"word": "ad", "start": 0.89, "end": 1.12},
      {"word": "videos", "start": 1.13, "end": 1.95}
    ]
  },
  {
    "start": 1.96,
    "end": 3.01,
    "text": "should not take days.",
    "words": [
      {"word": "should", "start": 1.96, "end": 2.21},
      {"word": "not", "start": 2.22, "end": 2.39},
      {"word": "take", "start": 2.40, "end": 2.65},
      {"word": "days.", "start": 2.66, "end": 3.01}
    ]
  }
]
```

---

## Phase 5: Firestore Persistence

### Goal
Store the subtitle segments on the project document.

### Schema Reference

From `firestore_schema.md`, the `projects/{projectId}` document has:

| Field | Type | Description |
|---|---|---|
| `subtitleSegments` | `array<map>` | Chunked subtitle segments with word-level timing |
| `subtitleSegments[].start` | `number` | Segment start time (seconds) |
| `subtitleSegments[].end` | `number` | Segment end time (seconds) |
| `subtitleSegments[].text` | `string` | Display text for this segment |
| `subtitleSegments[].words` | `array<map>` | Per-word timing for highlighting |
| `subtitleSegments[].words[].word` | `string` | Individual word |
| `subtitleSegments[].words[].start` | `number` | Word start time (seconds) |
| `subtitleSegments[].words[].end` | `number` | Word end time (seconds) |

### Implementation

#### 5.1 Write subtitle data to Firestore

```typescript
async function persistSubtitles(
  bizId: string,
  projectId: string,
  segments: SubtitleSegment[],
): Promise<void> {
  const projectRef = firestore
    .collection('businesses').doc(bizId)
    .collection('projects').doc(projectId);

  await projectRef.update({
    subtitleSegments: segments,
    'stages.subtitles': 'done',
    updatedAt: FieldValue.serverTimestamp(),
  });
}
```

#### 5.2 Also store raw transcription as a GCS artifact

For debugging and potential re-chunking without re-transcribing:

```
businesses/{bizId}/projects/{projectId}/audio/transcription_raw.json
```

---

## Phase 6: Remotion Subtitle Rendering

### Goal
Render burned-in subtitles with active-word highlighting in the final video using Remotion.

### Subtitle Style Presets (from PRD)

1. **Standard** — white bold text, dark outline/shadow, no word highlighting
2. **Kinetic** — words animate in (scale/fade), active word is emphasized
3. **Karaoke** — all words visible, active word changes color (e.g., white -> yellow)

### Implementation

#### 6.1 Remotion subtitle component

```tsx
// src/remotion/components/Subtitles.tsx
import { useCurrentFrame, useVideoConfig } from 'remotion';

interface Word {
  word: string;
  start: number;
  end: number;
}

interface SubtitleSegment {
  start: number;
  end: number;
  text: string;
  words: Word[];
}

interface SubtitleProps {
  segments: SubtitleSegment[];
  style: 'standard' | 'kinetic' | 'karaoke';
}

export const Subtitles: React.FC<SubtitleProps> = ({ segments, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  const activeSegment = segments.find(
    (seg) => currentTime >= seg.start && currentTime <= seg.end,
  );

  if (!activeSegment) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 180,
        left: 40,
        right: 40,
        textAlign: 'center',
      }}
    >
      {style === 'standard' && (
        <StandardCaption segment={activeSegment} />
      )}
      {style === 'karaoke' && (
        <KaraokeCaption segment={activeSegment} currentTime={currentTime} />
      )}
      {style === 'kinetic' && (
        <KineticCaption segment={activeSegment} currentTime={currentTime} />
      )}
    </div>
  );
};

const StandardCaption: React.FC<{ segment: SubtitleSegment }> = ({ segment }) => (
  <span
    style={{
      color: 'white',
      fontSize: 48,
      fontWeight: 800,
      textShadow: '2px 2px 8px rgba(0,0,0,0.9)',
      lineHeight: 1.3,
    }}
  >
    {segment.text}
  </span>
);

const KaraokeCaption: React.FC<{
  segment: SubtitleSegment;
  currentTime: number;
}> = ({ segment, currentTime }) => (
  <span style={{ fontSize: 48, fontWeight: 800, lineHeight: 1.3 }}>
    {segment.words.map((word, i) => {
      const isActive = currentTime >= word.start && currentTime <= word.end;
      const isPast = currentTime > word.end;
      return (
        <span
          key={i}
          style={{
            color: isActive ? '#FFD700' : isPast ? '#FFFFFF' : 'rgba(255,255,255,0.5)',
            textShadow: '2px 2px 8px rgba(0,0,0,0.9)',
            transition: 'color 0.05s',
            marginRight: 8,
          }}
        >
          {word.word}
        </span>
      );
    })}
  </span>
);

const KineticCaption: React.FC<{
  segment: SubtitleSegment;
  currentTime: number;
}> = ({ segment, currentTime }) => (
  <span style={{ fontSize: 48, fontWeight: 800, lineHeight: 1.3 }}>
    {segment.words.map((word, i) => {
      const isActive = currentTime >= word.start && currentTime <= word.end;
      const isVisible = currentTime >= word.start;
      const progress = isVisible
        ? Math.min(1, (currentTime - word.start) / 0.15)
        : 0;
      return (
        <span
          key={i}
          style={{
            color: isActive ? '#FFD700' : 'white',
            textShadow: '2px 2px 8px rgba(0,0,0,0.9)',
            opacity: progress,
            transform: `scale(${0.8 + 0.2 * progress})`,
            display: 'inline-block',
            marginRight: 8,
          }}
        >
          {word.word}
        </span>
      );
    })}
  </span>
);
```

#### 6.2 Integration in the Remotion composition

```tsx
<AbsoluteFill>
  <SceneTimeline scenes={scenes} />
  <Audio src={audioUrl} />
  <Subtitles
    segments={project.subtitleSegments}
    style={project.subtitleStyle || 'karaoke'}
  />
</AbsoluteFill>
```

#### 6.3 Safe area positioning

For vertical 9:16 video on social platforms:
- **Top safe zone:** avoid top 120px (status bar, account info)
- **Bottom safe zone:** avoid bottom 150px (like/comment/share buttons, description)
- Subtitle `bottom` value of 180px keeps captions above the social UI

---

## Phase 7: FFmpeg Fallback (Optional)

### Goal
Provide a simpler fallback path that burns subtitles using FFmpeg + ASS format instead of Remotion.

### When to use
- Emergency fallback if Remotion render worker is down
- Quick local testing without spinning up Remotion
- NOT the primary path — Remotion is primary for MVP

### Implementation

#### 7.1 Generate ASS subtitle file

```python
def generate_ass(segments: list, style: str = "standard") -> str:
    header = """[Script Info]
Title: PhanesUGC Subtitles
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Inter,56,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,2,2,40,40,180,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = []
    for seg in segments:
        start = format_ass_time(seg["start"])
        end = format_ass_time(seg["end"])
        text = seg["text"].replace("\n", "\\N")
        events.append(f"Dialogue: 0,{start},{end},Default,,0,0,0,,{text}")

    return header + "\n".join(events) + "\n"


def format_ass_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    cs = int((seconds % 1) * 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"
```

#### 7.2 Burn with FFmpeg

```bash
ffmpeg -i input.mp4 -vf "ass=subtitles.ass" -c:a copy output.mp4
```

---

## Phase 8: Pipeline Integration

### Goal
Wire the subtitle pipeline into the existing async job processing flow.

### Pipeline stage sequence

```
... -> assets_ready -> audio_ready -> subtitles_ready -> composition_ready -> rendering -> completed
```

### Implementation

#### 8.1 Stage orchestration

After scene generation completes:

1. **Concatenate scene videos** (if multiple) or use the single Veo output
2. **Extract audio** (Phase 1) -> set `stages.audio = 'done'`
3. **Transcribe** (Phase 2) -> intermediate result
4. **Force-align** (Phase 3) -> intermediate result
5. **Chunk subtitles** (Phase 4) -> final segments
6. **Persist to Firestore** (Phase 5) -> set `stages.subtitles = 'done'`
7. **Pass segments to Remotion render** (Phase 6) -> set `stages.render = 'running'`

#### 8.2 Worker service structure

```typescript
// src/services/subtitle-pipeline.service.ts

@Injectable()
export class SubtitlePipelineService {
  constructor(
    private audioExtraction: AudioExtractionService,
    private transcription: TranscriptionService,
    private alignment: AlignmentService,
    private chunker: SubtitleChunkerService,
    private firestore: FirestoreService,
  ) {}

  async process(bizId: string, projectId: string): Promise<SubtitleSegment[]> {
    const project = await this.firestore.getProject(bizId, projectId);

    // 1. Extract audio
    await this.firestore.updateStage(bizId, projectId, 'audio', 'running');
    const audioPath = await this.audioExtraction.extract(
      project.output.videoStorageKey,
      bizId,
      projectId,
    );
    await this.firestore.updateStage(bizId, projectId, 'audio', 'done');

    // 2. Transcribe
    await this.firestore.updateStage(bizId, projectId, 'subtitles', 'running');
    const rawWords = await this.transcription.transcribe(audioPath);

    // 3. Force-align (if script available)
    let alignedWords = rawWords;
    if (project.script?.voiceoverLines) {
      const fullScript = project.script.voiceoverLines
        .map((l) => l.text)
        .join(' ');
      try {
        alignedWords = await this.alignment.align(audioPath, fullScript);
      } catch (err) {
        console.warn('Forced alignment failed, using raw timestamps', err);
      }
    }

    // 4. Chunk
    const segments = this.chunker.chunk(alignedWords);

    // 5. Persist
    await this.firestore.persistSubtitles(bizId, projectId, segments);
    await this.firestore.updateStage(bizId, projectId, 'subtitles', 'done');

    return segments;
  }
}
```

#### 8.3 Stage status tracking

| Stage | Status Values |
|---|---|
| `stages.audio` | `pending` -> `running` -> `done` / `failed` |
| `stages.subtitles` | `pending` -> `running` -> `done` / `failed` |
| `stages.render` | `pending` -> `running` -> `done` / `failed` |

#### 8.4 Progress calculation

| Stage | Progress % |
|---|---|
| Audio extraction complete | 55% |
| Transcription complete | 65% |
| Alignment complete | 70% |
| Chunking + persist complete | 75% |
| Render started | 80% |
| Render complete | 100% |

---

## Phase 9: Validation and QA

### Goal
Ensure subtitle quality meets the acceptance criteria from PRD section 15.2 and 16.1.

### Quality checks

#### 9.1 Automated validation (run after chunking, before persist)

```typescript
function validateSubtitles(segments: SubtitleSegment[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];

    if (seg.end <= seg.start) {
      errors.push(`Segment ${i}: end <= start`);
    }

    if (seg.end - seg.start < 0.5) {
      warnings.push(`Segment ${i}: duration < 0.5s`);
    }

    if (i < segments.length - 1 && seg.end > segments[i + 1].start) {
      errors.push(`Segment ${i}: overlaps with segment ${i + 1}`);
    }

    for (const word of seg.words) {
      if (word.start < seg.start || word.end > seg.end) {
        errors.push(`Segment ${i}: word "${word.word}" outside segment bounds`);
      }
    }

    const reconstructed = seg.words.map(w => w.word).join(' ');
    if (reconstructed !== seg.text) {
      warnings.push(`Segment ${i}: text mismatch`);
    }

    if (seg.text.length > 84) {
      warnings.push(`Segment ${i}: text exceeds 2-line max`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
```

#### 9.2 Acceptance criteria (from PRD)

- [ ] Subtitles are visibly synchronized in final render
- [ ] No severe desync (>300ms drift)
- [ ] No overlapping subtitle chunks
- [ ] No captions outside safe display region
- [ ] Line breaks are readable
- [ ] No unrendered placeholder text in subtitle layer
- [ ] Audio and video durations match within 500ms tolerance

#### 9.3 Manual QA checklist

1. Play final MP4 — do words highlight at the right moment?
2. Check first 2 seconds — is the first subtitle timed correctly?
3. Check last 2 seconds — does the last subtitle end cleanly?
4. Check a mid-point transition — no flash of wrong text?
5. View on mobile — are subtitles within safe area?

---

## Phase 10: Infrastructure and Deployment

### Goal
Ensure the subtitle pipeline runs reliably in production.

### Requirements

#### 10.1 Container / worker setup

- The transcription worker needs either:
  - A GPU instance (T4 minimum) for fast inference, OR
  - A CPU instance with `int8` quantized model (slower but cheaper for MVP)
- FFmpeg must be available in the worker container
- aeneas requires `espeak` and `ffmpeg` as system dependencies

**Dockerfile additions for the subtitle worker:**
```dockerfile
RUN apt-get update && apt-get install -y \
    ffmpeg \
    espeak \
    libespeak-dev \
    && rm -rf /var/lib/apt/lists/*

RUN pip install faster-whisper aeneas
```

#### 10.2 GCS paths used by the subtitle pipeline

```
businesses/{bizId}/projects/{projectId}/audio/extracted.wav
businesses/{bizId}/projects/{projectId}/audio/transcription_raw.json
businesses/{bizId}/projects/{projectId}/output/final.mp4
businesses/{bizId}/projects/{projectId}/output/thumbnail.jpg
```

#### 10.3 Signed URL handling

- Workers access GCS using service account credentials directly — no signed URLs needed server-side
- Frontend playback uses short-lived signed URLs generated by the backend on demand

#### 10.4 Retry strategy

| Stage | Max Retries | Retry Delay |
|---|---|---|
| Audio extraction | 2 | 5s |
| Transcription | 2 | 10s |
| Forced alignment | 1 | 5s (then fallback to raw) |
| Chunking | 0 | Deterministic, no retry needed |
| Firestore write | 3 | Exponential backoff |

#### 10.5 Monitoring

Log the following metrics:
- Audio extraction duration (ms)
- Transcription duration (ms)
- Number of words transcribed
- Average word confidence
- Forced alignment success/failure
- Number of subtitle segments produced
- Validation errors/warnings count

---

## Implementation Order

Implement in this order:

1. **Phase 1** — Audio extraction service (FFmpeg wrapper)
2. **Phase 4** — Subtitle chunking (pure logic, easy to unit test with mock word data)
3. **Phase 5** — Firestore persistence (simple Firestore update)
4. **Phase 2** — Transcription service (requires Python sidecar setup)
5. **Phase 3** — Forced alignment (can defer to post-MVP if blocking)
6. **Phase 8** — Pipeline integration (wire everything together)
7. **Phase 6** — Remotion subtitle component
8. **Phase 9** — Validation and QA
9. **Phase 7** — FFmpeg fallback (lowest priority, nice-to-have)
10. **Phase 10** — Infrastructure hardening (deployment config, monitoring)

---

## Summary of Key Decisions

| Decision | Choice | Reason |
|---|---|---|
| Audio source | Extract from Veo output | Veo embeds speech in video, no separate TTS |
| Transcription engine | faster-whisper (large-v3) | Fast, local, EU-compliant, word timestamps |
| Forced alignment | aeneas | Simple, proven, no GPU needed |
| Subtitle rendering | Remotion (primary) | Supports karaoke/kinetic word highlighting |
| Subtitle burn-in | Yes, in MVP | PRD requirement |
| Fallback render | FFmpeg + ASS | Emergency path only |
| Storage | GCS paths, not signed URLs | Firestore stores paths; backend generates signed URLs on demand |
| Subtitle schema | `subtitleSegments` on project doc | Matches `firestore_schema.md` exactly |
