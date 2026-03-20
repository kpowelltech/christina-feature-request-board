-- Migration: Replace status values (pending, sent_to_slack, asana_created) with (pending, in_progress, qa, done, blocked)

-- Step 1: Migrate existing rows with old statuses to 'pending'
UPDATE feature_requests SET status = 'pending' WHERE status IN ('sent_to_slack', 'asana_created');

-- Step 2: Drop the old CHECK constraint
ALTER TABLE feature_requests DROP CONSTRAINT IF EXISTS feature_requests_status_check;

-- Step 3: Add the new CHECK constraint
ALTER TABLE feature_requests ADD CONSTRAINT feature_requests_status_check
  CHECK (status IN ('pending', 'in_progress', 'qa', 'done', 'blocked'));
