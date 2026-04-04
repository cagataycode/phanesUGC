/**
 * Cloud Function for monthly quota reset
 * 
 * This function is triggered by Cloud Scheduler on the 1st of each month
 * to reset monthly video quotas for all businesses.
 * 
 * Schedule: 0 0 1 * * (At 00:00 on day-of-month 1)
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

export const resetMonthlyQuotas = functions.pubsub
  .schedule('0 0 1 * *')
  .timeZone('UTC')
  .onRun(async (context) => {
    const firestore = admin.firestore();
    
    console.log('Starting monthly quota reset');
    
    try {
      // The quota reset happens automatically by using month-based keys
      // in the usage collection. Old usage documents are kept for historical tracking.
      // We just log the reset event here.
      
      const resetDate = new Date();
      const resetMonth = `${resetDate.getFullYear()}-${String(resetDate.getMonth() + 1).padStart(2, '0')}`;
      
      // Log the reset event
      await firestore.collection('system_events').add({
        type: 'quota_reset',
        month: resetMonth,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        message: 'Monthly quotas reset automatically via month-based keys',
      });
      
      console.log(`Monthly quota reset completed for ${resetMonth}`);
      
      return null;
    } catch (error) {
      console.error('Failed to reset monthly quotas:', error);
      throw error;
    }
  });
