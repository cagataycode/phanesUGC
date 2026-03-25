# Phase 5 Implementation Plan: Security Rules and Deployment

## Overview
This phase focuses on implementing comprehensive security rules and deploying the complete Firestore database structure. We'll establish robust access controls and deploy all components to the production environment.

## Implementation Steps

### 1. Security Rules Implementation
- Implement Firestore security rules based on the schema specification
- Create access control for users collection:
  - Users can only read/write their own documents
- Create access control for businesses collection:
  - Read access for members only
  - Write access for owners and admins only
- Create access control for members subcollection:
  - Read access for members
  - Write access for owners and admins only
- Create access control for products subcollection:
  - Read/write access for all members
- Create access control for projects subcollection:
  - Read access for members
  - Create access for members
  - Update access for members
- Create access control for scenes subcollection:
  - Read/write access for members

### 2. Security Functions Implementation
- Implement `isMember(bizId)` function:
  - Check if user is authenticated
  - Verify user exists in members subcollection
- Implement `isOwnerOrAdmin(bizId)` function:
  - Check if user is authenticated
  - Retrieve user's role from members subcollection
  - Verify role is either 'owner' or 'admin'

### 3. Index Deployment
- Deploy required composite indexes:
  - Projects collection indexes for various query patterns
  - Scenes collection indexes for ordering
- Verify all indexes are properly built
- Test query performance with deployed indexes

### 4. GCS Configuration
- Configure GCS CORS settings:
  - Set up CORS for production domain
  - Set up CORS for localhost development
- Verify GCS storage key conventions implementation
- Test asset storage and retrieval

### 5. Deployment Process
- Deploy Firestore rules and indexes using Firebase CLI
- Verify deployment success
- Test access controls with different user roles
- Validate query performance with indexes

### 6. Migration Preparation
- Prepare migration scripts from existing `ads` collection
- Create mapping between old and new data structures
- Implement GCS path conversion (from signed URLs to storage keys)
- Plan for data validation during migration

## Technical Requirements
- Existing Firebase project with Firestore enabled
- All previous phases implemented in development environment
- Firebase CLI installed and configured
- Understanding of Firestore security rules syntax
- Knowledge of composite indexes and query optimization

## Expected Outcomes
- Comprehensive security rules protecting all data
- Properly deployed composite indexes for query performance
- Configured GCS CORS settings for asset access
- Production-ready deployment of the complete database structure
- Migration preparation for existing data

## Dependencies
- Phase 1, 2, 3, and 4 implementations completed
- Firebase project with Firestore enabled
- All data models implemented and tested
- GCS storage bucket configured
- Firebase CLI installed and authenticated

## Timeline
This phase should be completed within 2-3 days depending on team size and experience with Firebase security rules and deployment processes.