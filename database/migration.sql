-- Migration Script for Feature Request Board
-- Adds new columns and populates topic field
-- Run this on existing database after schema.sql

-- Step 1: Add new columns if they don't exist
ALTER TABLE feature_requests ADD COLUMN IF NOT EXISTS app_id VARCHAR(255);
ALTER TABLE feature_requests ADD COLUMN IF NOT EXISTS topic VARCHAR(255);
ALTER TABLE feature_requests ADD COLUMN IF NOT EXISTS is_workflow BOOLEAN DEFAULT false;
ALTER TABLE feature_requests ADD COLUMN IF NOT EXISTS created_by_email VARCHAR(255);
ALTER TABLE feature_requests ADD COLUMN IF NOT EXISTS updated_by_email VARCHAR(255);

-- Step 2: Create index on topic if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_topic ON feature_requests(topic);

-- Step 3: Update category "Push Notifications" to "Push Flows"
UPDATE feature_requests
SET category = 'Push Flows'
WHERE category = 'Push Notifications';

-- Step 4: Populate topic field based on category and request_group

-- PUSH FLOWS TOPICS
UPDATE feature_requests SET topic = 'Welcome Flow'
WHERE category = 'Push Flows'
AND (
  request_group ILIKE '%welcome%'
  OR request ILIKE '%welcome push%'
);

UPDATE feature_requests SET topic = 'Abandon Cart Flow'
WHERE category = 'Push Flows'
AND (
  request_group ILIKE '%abandon%cart%'
  OR request_group ILIKE '%cart%abandon%'
  OR request_group ILIKE '%cart recovery%'
  OR request ILIKE '%abandon%cart%'
);

UPDATE feature_requests SET topic = 'Browse Abandonment Flow'
WHERE category = 'Push Flows'
AND (
  request_group ILIKE '%browse%abandon%'
  OR request ILIKE '%browse%abandon%'
);

UPDATE feature_requests SET topic = 'Winback Flow'
WHERE category = 'Push Flows'
AND (
  request_group ILIKE '%winback%'
  OR request ILIKE '%winback%'
);

UPDATE feature_requests SET topic = 'Push Performance'
WHERE category = 'Push Flows'
AND (
  request_group ILIKE '%performance%'
  OR request_group ILIKE '%analytics%'
  OR request_group ILIKE '%attribution%'
  OR request_group ILIKE '%ROI%'
  OR request ILIKE '%conversion%'
  OR request ILIKE '%performance%'
  OR request ILIKE '%analytics%'
);

UPDATE feature_requests SET topic = 'AI Tuning'
WHERE category = 'Push Flows'
AND (
  request_group ILIKE '%tuning%'
  OR request_group ILIKE '%AI%control%'
  OR request_group ILIKE '%guardrail%'
  OR request_group ILIKE '%audience%'
  OR request_group ILIKE '%feedback%control%'
  OR request_group ILIKE '%user exclusion%'
  OR request ILIKE '%tuning%'
  OR request ILIKE '%guardrail%'
);

UPDATE feature_requests SET topic = 'Discount Codes'
WHERE category = 'Push Flows'
AND (
  request_group ILIKE '%discount%'
  OR request_group ILIKE '%code%'
  OR request ILIKE '%discount%'
  OR request ILIKE '%promo%code%'
);

UPDATE feature_requests SET topic = 'Translations'
WHERE category = 'Push Flows'
AND (
  request_group ILIKE '%translat%'
  OR request ILIKE '%translat%'
  OR request ILIKE '%spanish%'
  OR request ILIKE '%language%'
);

UPDATE feature_requests SET topic = 'Time Restrictions / Options'
WHERE category = 'Push Flows'
AND (
  request_group ILIKE '%quiet%hour%'
  OR request_group ILIKE '%time%restrict%'
  OR request_group ILIKE '%timing%'
  OR request ILIKE '%quiet%hour%'
  OR request ILIKE '%time%window%'
  OR request ILIKE '%send%time%'
  OR request ILIKE '%1 am%'
  OR request ILIKE '%9pm%'
);

-- ANALYTICS TOPICS
UPDATE feature_requests SET topic = 'AI Push Analytics'
WHERE category = 'Analytics'
AND (
  request_group ILIKE '%push%analytic%'
  OR request_group ILIKE '%dashboard%'
  OR request_group ILIKE '%date range%'
  OR request ILIKE '%push%analytic%'
  OR request ILIKE '%dashboard%'
);

UPDATE feature_requests SET topic = 'Attribution & Data Accuracy'
WHERE category = 'Analytics'
AND (
  request_group ILIKE '%attribution%'
  OR request_group ILIKE '%CVR%'
  OR request_group ILIKE '%discrepancy%'
  OR request_group ILIKE '%credit%tracking%'
  OR request ILIKE '%attribution%'
  OR request ILIKE '%accuracy%'
);

UPDATE feature_requests SET topic = 'Flow-Specific Analytics'
WHERE category = 'Analytics'
AND (
  request_group ILIKE '%winback%analytic%'
  OR request_group ILIKE '%cart recovery%'
  OR request_group ILIKE '%migration%'
  OR request ILIKE '%winback%'
  OR request ILIKE '%cart recovery%'
);

UPDATE feature_requests SET topic = 'Dashboard Visibility'
WHERE category = 'Analytics'
AND (
  request_group ILIKE '%dashboard%visibility%'
  OR request_group ILIKE '%can''t see%'
  OR request ILIKE '%can''t see%'
  OR request ILIKE '%visibility%'
);

-- MEDIA TOPICS
UPDATE feature_requests SET topic = 'AI Video'
WHERE category = 'Media'
AND request_group ILIKE '%video%'
AND NOT (
  request_group ILIKE '%UI%'
  OR request_group ILIKE '%edit%'
  OR request_group ILIKE '%generat%'
);

UPDATE feature_requests SET topic = 'AI Video UI'
WHERE category = 'Media'
AND request_group ILIKE '%video%'
AND request_group ILIKE '%UI%';

UPDATE feature_requests SET topic = 'AI Video Editing'
WHERE category = 'Media'
AND request_group ILIKE '%video%'
AND request_group ILIKE '%edit%';

UPDATE feature_requests SET topic = 'AI Video Generation'
WHERE category = 'Media'
AND request_group ILIKE '%video%'
AND request_group ILIKE '%generat%';

UPDATE feature_requests SET topic = 'AI Images'
WHERE category = 'Media'
AND request_group ILIKE '%image%';

-- API/DEV TOPICS
UPDATE feature_requests SET topic = 'CLI Access'
WHERE category = 'API/Dev'
AND request_group ILIKE '%CLI%';

UPDATE feature_requests SET topic = 'Security'
WHERE category = 'API/Dev'
AND request_group ILIKE '%security%';

-- Set default topic for Push Flows entries without a topic
UPDATE feature_requests SET topic = 'Push Performance'
WHERE category = 'Push Flows' AND topic IS NULL;

-- Set default topic for Analytics entries without a topic
UPDATE feature_requests SET topic = 'Dashboard Visibility'
WHERE category = 'Analytics' AND topic IS NULL;
