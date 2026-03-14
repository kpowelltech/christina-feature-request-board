/**
 * Database Initialization Script
 * Run this to set up your Neon database schema and seed with initial data
 *
 * Usage:
 *   node database/init.js
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initDatabase() {
  console.log('🚀 Initializing Feature Request Board database...\n');

  // Check for DATABASE_URL
  if (!process.env.DATABASE_URL) {
    console.error('❌ Error: DATABASE_URL environment variable is not set');
    console.error('   Please set DATABASE_URL in your .env file or environment');
    console.error('   Example: DATABASE_URL="postgresql://user:password@host/database"\n');
    process.exit(1);
  }

  try {
    // Initialize Neon client
    const sql = neon(process.env.DATABASE_URL);

    console.log('📋 Creating database schema...\n');

    // Create table
    console.log('  Creating feature_requests table...');
    await sql`
      CREATE TABLE IF NOT EXISTS feature_requests (
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
        created_by_email VARCHAR(255),
        updated_by_email VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('  ✓ Table created');

    // Add columns to existing table if they don't exist (for existing databases)
    console.log('  Adding auth tracking columns (if needed)...');
    try {
      await sql`ALTER TABLE feature_requests ADD COLUMN IF NOT EXISTS created_by_email VARCHAR(255)`;
      await sql`ALTER TABLE feature_requests ADD COLUMN IF NOT EXISTS updated_by_email VARCHAR(255)`;
      console.log('  ✓ Auth tracking columns ensured');
    } catch (error) {
      console.log('  ⚠ Columns may already exist (this is fine)');
    }

    // Create indexes
    console.log('  Creating indexes...');
    await sql`CREATE INDEX IF NOT EXISTS idx_channel ON feature_requests(channel)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_status ON feature_requests(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_date ON feature_requests(date DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_request_group ON feature_requests(request_group)`;
    console.log('  ✓ 4 indexes created');

    console.log('\n✅ Schema created successfully\n');

    // Seed data
    console.log('📦 Seeding database with initial data...');

    // Read seed file
    const seedPath = path.join(__dirname, 'seed.sql');
    const seed = fs.readFileSync(seedPath, 'utf8');

    // Extract and execute INSERT statements
    const insertMatches = seed.match(/INSERT INTO feature_requests[\s\S]+?ON CONFLICT[\s\S]+?;/gi) || [];

    for (let i = 0; i < insertMatches.length; i++) {
      const stmt = insertMatches[i];
      await sql(stmt);
      console.log(`  ✓ Batch ${i + 1}/${insertMatches.length} inserted`);
    }

    console.log('\n✅ Database seeded successfully\n');

    // Verify data
    console.log('🔍 Verifying data...');
    const rows = await sql`
      SELECT channel, COUNT(*) as count
      FROM feature_requests
      GROUP BY channel
      ORDER BY channel
    `;

    console.log('\n📊 Database Summary:');
    rows.forEach(row => {
      console.log(`  ${row.channel}: ${row.count} requests`);
    });

    console.log('\n✨ Database initialization complete!');
    console.log('🎉 Your Feature Request Board is ready to use.\n');

  } catch (error) {
    console.error('\n❌ Error initializing database:');
    console.error(error);
    process.exit(1);
  }

  process.exit(0);
}

// Run initialization
initDatabase();
