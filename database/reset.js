/**
 * Database Reset Script
 * Drops and recreates the feature_requests table with correct schema
 *
 * Usage:
 *   node database/reset.js
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

async function resetDatabase() {
  console.log('🔄 Resetting Feature Request Board database...\n');

  if (!process.env.DATABASE_URL) {
    console.error('❌ Error: DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  try {
    const sql = neon(process.env.DATABASE_URL);

    console.log('🗑️  Dropping existing table...');
    await sql`DROP TABLE IF EXISTS feature_requests`;
    console.log('  ✓ Table dropped\n');

    console.log('📋 Creating new schema...\n');

    console.log('  Creating feature_requests table...');
    await sql`
      CREATE TABLE feature_requests (
        id VARCHAR(50) PRIMARY KEY,
        merchant VARCHAR(255) NOT NULL,
        app_id VARCHAR(255),
        mrr INTEGER DEFAULT 0,
        arr INTEGER DEFAULT 0,
        type VARCHAR(50) NOT NULL CHECK (type IN ('feature', 'integration')),
        category VARCHAR(100) NOT NULL,
        request_group VARCHAR(255) NOT NULL,
        request TEXT NOT NULL,
        context TEXT,
        submitted_by VARCHAR(255),
        date DATE NOT NULL,
        status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent_to_slack', 'asana_created')),
        asana_id VARCHAR(100),
        slack_ts VARCHAR(50),
        slack_user VARCHAR(50),
        channel VARCHAR(50) DEFAULT '#product',
        is_workflow BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('  ✓ Table created');

    console.log('  Creating indexes...');
    await sql`CREATE INDEX idx_channel ON feature_requests(channel)`;
    await sql`CREATE INDEX idx_status ON feature_requests(status)`;
    await sql`CREATE INDEX idx_date ON feature_requests(date DESC)`;
    await sql`CREATE INDEX idx_request_group ON feature_requests(request_group)`;
    console.log('  ✓ 4 indexes created');

    console.log('\n✅ Database reset complete\n');
    console.log('📊 Database is empty and ready for fresh data\n');

  } catch (error) {
    console.error('\n❌ Error resetting database:');
    console.error(error);
    process.exit(1);
  }

  process.exit(0);
}

resetDatabase();
