/**
 * Vercel Cron Function
 * Automatically syncs Slack channels to database every 5 minutes
 *
 * Security: Vercel cron jobs include an Authorization header with a secret
 * See: https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
 */

import { syncChannel, CHANNELS } from '../../slackSyncDB.js';

export default async function handler(req, res) {
  // Only allow POST requests from Vercel Cron
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify the request is from Vercel Cron
  // Vercel automatically sends the Authorization header with the CRON_SECRET
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error('[cron] Unauthorized request - invalid or missing CRON_SECRET');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('[cron] Starting scheduled Slack sync...');
  const startTime = Date.now();

  try {
    // Sync both channels
    const results = {};
    const channelKeys = Object.keys(CHANNELS);

    for (const key of channelKeys) {
      console.log(`[cron] Syncing channel: ${key}`);
      results[key] = await syncChannel(key);
    }

    // Calculate totals
    const totalAdded = Object.values(results).reduce((sum, r) => sum + r.added.length, 0);
    const totalSkipped = Object.values(results).reduce((sum, r) => sum + r.skipped, 0);
    const totalErrors = Object.values(results).reduce((sum, r) => sum + r.errors, 0);

    const duration = Date.now() - startTime;

    console.log(`[cron] Sync complete in ${duration}ms - ${totalAdded} added, ${totalSkipped} skipped, ${totalErrors} errors`);

    return res.status(200).json({
      success: true,
      message: 'Slack sync completed',
      duration: `${duration}ms`,
      results: {
        added: totalAdded,
        skipped: totalSkipped,
        errors: totalErrors
      },
      details: results
    });
  } catch (error) {
    console.error('[cron] Fatal error during sync:', error);
    return res.status(500).json({
      success: false,
      error: 'Sync failed',
      message: error.message
    });
  }
}
