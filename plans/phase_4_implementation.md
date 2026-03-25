# Phase 4 Implementation Plan: Scene Management and Pipeline

## Overview
This phase focuses on implementing scene management and the complete ad generation pipeline. We'll establish the data structures for individual scenes and implement the workflow management for the entire ad generation process.

## Implementation Steps

### 1. Scene Entity Implementation
- Implement the `businesses/{bizId}/projects/{projectId}/scenes/{sceneId}` subcollection
- Create scene document schema with required fields:
  - `id` (string, required)
  - `projectId` (string, required)
  - `sceneOrder` (number, required)
  - `durationSec` (number, required)

#### Visual Instructions Structure
- `visualType` (string, required) - ai_video | ai_image | uploaded
- `visualPrompt` (string, optional)
- `cameraMotion` (string, optional)
- `overlayText` (string, optional)
- `transitionIn` (string, optional) - cut | fade | slide
- `transitionOut` (string, optional) - cut | fade | slide

#### Generated Asset Management
- `assetStorageKey` (string, optional)
- `assetType` (string, optional) - video | image
- `generationStatus` (string, required) - pending | generating | completed | failed
- `generationError` (string, optional)

#### Timestamps
- `createdAt` (timestamp, required)
- `updatedAt` (timestamp, required)

### 2. Pipeline Stage Implementation
- Implement comprehensive pipeline state management:
  - `scrape` stage - pending | running | done | failed | skipped
  - `brief` stage - pending | running | done | failed
  - `script` stage - pending | running | done | failed
  - `scenes` stage - pending | running | done | failed
  - `assets` stage - pending | running | done | failed
  - `audio` stage - pending | running | done | failed
  - `subtitles` stage - pending | running | done | failed
  - `render` stage - pending | running | done | failed

### 3. Workflow Management
- Implement progress tracking (0-100 percentage)
- Create error handling for failed stages
- Implement retry mechanisms for individual stages
- Establish status transitions (created -> processing -> completed/failed)

### 4. Scene Sequencing
- Implement scene ordering functionality
- Create utilities for reordering scenes
- Establish proper numbering system (1-based integers)
- Implement validation for scene sequence integrity

### 5. Asset Generation Integration
- Connect scene generation with Veo 3.1 API
- Implement asset storage in GCS with proper path conventions
- Create monitoring for generation status
- Handle generation failures and retries

## Technical Requirements
- Existing Firebase project with Firestore enabled
- Project management system from Phase 3 implemented
- Understanding of Firestore deeply nested subcollections
- Knowledge of video generation APIs (Veo 3.1)
- Experience with GCS storage conventions

## Expected Outcomes
- Fully functional scene management system
- Complete ad generation pipeline with all stages
- Proper workflow management and progress tracking
- Integration with external video generation services
- Robust error handling and retry mechanisms

## Dependencies
- Phase 1, 2, and 3 implementations completed
- Firebase project with Firestore enabled
- Project data model in place
- GCS storage configured for asset storage
- Access to Veo 3.1 or similar video generation API

## Timeline
This phase should be completed within 3-4 days depending on team size and experience with video generation APIs and complex workflow management.