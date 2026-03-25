# Phase 3 Implementation Plan: Product and Project Management

## Overview
This phase focuses on implementing product entities and the core project management system. We'll establish the data structures for advertising products and the comprehensive ad generation pipeline with all its components.

## Implementation Steps

### 1. Product Entity Implementation
- Implement the `businesses/{bizId}/products/{productId}` subcollection
- Create product document schema with required fields:
  - `id` (string, required)
  - `businessId` (string, required)
  - `name` (string, required)
  - `description` (string, optional)
  - `benefits` (array<string>, optional)
  - `urls` (array<string>, optional)
  - `brandAssets` (array<map>, optional)
  - `defaults` (map, optional)
  - `createdAt` (timestamp, required)
  - `updatedAt` (timestamp, required)
  - `deletedAt` (timestamp, optional)

- Implement brand assets structure:
  - `storageKey` (string, required)
  - `type` (string, required) - image | video | logo
  - `filename` (string, required)

- Implement product defaults:
  - `tone` (string, optional)
  - `targetAudience` (string, optional)
  - `language` (string, optional)
  - `cta` (string, optional)

### 2. Project Entity Implementation
- Implement the `businesses/{bizId}/projects/{projectId}` subcollection
- Create comprehensive project document schema with all required fields:

#### Input Parameters
- `prompt` (string, required)
- `platform` (string, required) - tiktok | instagram_reels | youtube_shorts
- `aspectRatio` (string, required) - 9:16 | 1:1
- `durationSec` (number, required)
- `language` (string, required)
- `tone` (string, optional)
- `targetAudience` (string, optional)
- `cta` (string, optional)
- `subtitleStyle` (string, optional) - standard | kinetic | karaoke
- `voiceId` (string, optional)

#### Scrape Result Structure
- `sourceUrl` (string, required)
- `status` (string, required) - success | failed | skipped
- `extractedData` (map, optional) with multiple sub-fields

#### Creative Brief Structure
- Multiple fields for product name, offer, audience, pain points, benefits, tone, language, duration, platform, CTA, visual style, and aspect ratio

#### Script Structure
- `title` (string, required)
- `hook` (string, required)
- `voiceoverLines` (array<map>, required) with scene numbers and text
- `cta` (string, required)

#### Pipeline State Management
- `status` (string, required) - created | processing | completed | failed
- `progress` (number, required) - 0-100 percentage
- `stages` (map, required) with status tracking for all pipeline stages
- `failedStage` (string, optional)
- `errorMessage` (string, optional)

#### Output Management
- `videoStorageKey` (string, required)
- `thumbnailStorageKey` (string, optional)

#### Audio Track Management
- `storageKey` (string, required)
- `format` (string, required) - wav | mp3
- `sampleRateHz` (number, optional)
- `channels` (number, optional)

#### Subtitle Segments
- Complex structure with timing, text, and word-level highlighting data

### 3. Data Relationships
- Establish proper references between projects and products
- Implement cascade delete functionality for soft-deleted entities
- Create helper functions for querying projects by various criteria

## Technical Requirements
- Existing Firebase project with Firestore enabled
- Business and user management from Phase 2 implemented
- Understanding of Firestore subcollections
- Knowledge of complex data relationships in NoSQL databases

## Expected Outcomes
- Fully functional product catalog system
- Comprehensive project management with complete ad generation pipeline
- Proper data relationships between businesses, products, and projects
- Query capabilities for filtering projects by various criteria

## Dependencies
- Phase 1 and 2 implementations completed
- Firebase project with Firestore enabled
- Business and user data models in place
- GCS storage configured for asset storage

## Timeline
This phase is the most complex and should be completed within 3-5 days depending on team size and experience with complex Firestore data modeling.