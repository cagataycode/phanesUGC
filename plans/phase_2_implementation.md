# Phase 2 Implementation Plan: Business and User Management

## Overview
This phase focuses on implementing business entities and the relationship between users and businesses. We'll establish the many-to-many relationship model and implement subscription management for both individual users and business entities.

## Implementation Steps

### 1. Business Entity Implementation
- Implement the `businesses/{bizId}` collection structure
- Create business document schema with required fields:
  - `id` (string, required)
  - `name` (string, required)
  - `subscription` (map, optional)
  - `usage` (map, required)
  - `brandKit` (map, optional)
  - `defaults` (map, optional)
  - `ownerId` (string, required)
  - `createdAt` (timestamp, required)
  - `updatedAt` (timestamp, required)
  - `deletedAt` (timestamp, optional)

### 2. User-Business Relationship Model
- Implement the `businesses/{bizId}/members/{uid}` subcollection
- Create member document schema with required fields:
  - `uid` (string, required)
  - `email` (string, required)
  - `role` (string, required) - owner | admin | member
  - `joinedAt` (timestamp, required)

### 3. Subscription Management
- Implement user-level subscription handling:
  - `tier` (string) - free | pro
  - `status` (string) - active | canceled | past_due | trialing
  - `currentPeriodStart` (timestamp, optional)
  - `currentPeriodEnd` (timestamp, optional)
  - `stripeCustomerId` (string, optional)
  - `stripeSubscriptionId` (string, optional)
  
- Implement business-level subscription handling:
  - `tier` (string) - free | pro | enterprise
  - `status` (string) - active | canceled | past_due | trialing
  - `currentPeriodStart` (timestamp, optional)
  - `currentPeriodEnd` (timestamp, optional)
  - `stripeCustomerId` (string, optional)
  - `stripeSubscriptionId` (string, optional)
  - `seats` (number, optional) - Max allowed members (enterprise)

### 4. Usage Tracking Implementation
- Implement business usage tracking:
  - `adsGeneratedThisMonth` (number, required)
  - `adsGeneratedTotal` (number, required)
  - `currentPeriodStart` (timestamp, required)

### 5. Access Control Functions
- Implement helper functions for checking membership:
  - `isMember(bizId)` - Check if user is a member of a business
  - `isOwnerOrAdmin(bizId)` - Check if user has owner or admin privileges

## Technical Requirements
- Existing Firebase project with Firestore enabled
- User data model from Phase 1 implemented
- Firebase Security Rules understanding
- Stripe integration knowledge (for subscription handling)

## Expected Outcomes
- Fully functional business entity management
- User-business relationship model established
- Subscription management for both users and businesses
- Usage tracking implementation for businesses
- Access control functions for security rules

## Dependencies
- Phase 1 implementation completed
- Firebase project with Firestore enabled
- User authentication system in place
- Stripe account for subscription management (if implementing payment features)

## Timeline
This phase should be completed within 2-3 days depending on team size and experience with Firebase security rules and subscription management.