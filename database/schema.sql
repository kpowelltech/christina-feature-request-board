-- Feature Request Board Database Schema
-- For Neon PostgreSQL on Vercel

-- Create feature_requests table
CREATE TABLE IF NOT EXISTS feature_requests (
  id VARCHAR(50) PRIMARY KEY,
  merchant VARCHAR(255) NOT NULL,
  app_id VARCHAR(255),
  mrr INTEGER DEFAULT 0,
  arr INTEGER DEFAULT 0,
  type VARCHAR(50) NOT NULL CHECK (type IN ('feature', 'integration')),
  category VARCHAR(100) NOT NULL,
  request_group VARCHAR(255) NOT NULL,
  topic VARCHAR(255),
  request TEXT NOT NULL,
  context TEXT,
  submitted_by VARCHAR(255),
  date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'qa', 'done', 'blocked')),
  asana_id VARCHAR(100),
  slack_ts VARCHAR(50),
  slack_user VARCHAR(50),
  channel VARCHAR(50) DEFAULT 'product' CHECK (channel IN ('product', 'ai')),
  is_workflow BOOLEAN DEFAULT false,
  created_by_email VARCHAR(255),
  updated_by_email VARCHAR(255),
  deleted_by_email VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Create index on channel for faster queries
CREATE INDEX IF NOT EXISTS idx_channel ON feature_requests(channel);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_status ON feature_requests(status);

-- Create index on date for sorting
CREATE INDEX IF NOT EXISTS idx_date ON feature_requests(date DESC);

-- Create index on request_group for grouping
CREATE INDEX IF NOT EXISTS idx_request_group ON feature_requests(request_group);

-- Create index on topic for grouping
CREATE INDEX IF NOT EXISTS idx_topic ON feature_requests(topic);

-- Create index on deleted_at for filtering active/deleted records
CREATE INDEX IF NOT EXISTS idx_deleted_at ON feature_requests(deleted_at);
