-- ========================================
-- Soft Delete Migration
-- ========================================
-- Adds soft delete columns to prevent Slack re-hydration of deleted entries
-- Run with: node database/migrate-soft-delete.js

-- Add deleted_by_email column (tracks who deleted the record)
ALTER TABLE feature_requests ADD COLUMN IF NOT EXISTS deleted_by_email VARCHAR(255);

-- Add deleted_at column (tracks when the record was deleted)
ALTER TABLE feature_requests ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Create index on deleted_at for efficient filtering of active/deleted records
CREATE INDEX IF NOT EXISTS idx_deleted_at ON feature_requests(deleted_at);
