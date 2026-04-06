/**
 * Cloud Function for rate limit cleanup
 * 
 * This function is triggered by Cloud Scheduler every hour
 * to clean up stale rate limit entries older than 1 hour.
 * 
 * Schedule: 0 * * * * (At minute 0 of every hour)
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

export const cleanupRateLimits = functions.pubsub
  .schedule('0 * * * *')
  .timeZone('UTC')
  .onRun(async (context) => {
    const firestore = admin.firestore();
    
    console.log('Starting rate limit cleanup');
    
    try {
      const cutoffTime = new Date(Date.now() - 3600000); // 1 hour ago
      
      // Query for stale rate limit documents
      const staleDocsSnapshot = await firestore
        .collectionGroup('rate_limits')
        .where('updatedAt', '<', cutoffTime)
        .get();
      
      if (staleDocsSnapshot.empty) {
        console.log('No stale rate limit entries found');
        return null;
      }
      
      // Delete stale documents in batches (Firestore limit: 500 ops per batch)
      const maxBatchSize = 500;
      const staleDocs = staleDocsSnapshot.docs;
      let deleteCount = 0;
      
      for (let i = 0; i < staleDocs.length; i += maxBatchSize) {
        const batch = firestore.batch();
        const batchDocs = staleDocs.slice(i, i + maxBatchSize);
        
        batchDocs.forEach((doc) => {
          batch.delete(doc.ref);
          deleteCount++;
        });
        
        await batch.commit();
      }
      
      console.log(`Cleaned up ${deleteCount} stale rate limit entries`);
      
      // Log the cleanup event
      await firestore.collection('system_events').add({
        type: 'rate_limit_cleanup',
        deletedCount: deleteCount,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
      
      return null;
    } catch (error) {
      console.error('Failed to cleanup rate limits:', error);
      throw error;
    }
  });
