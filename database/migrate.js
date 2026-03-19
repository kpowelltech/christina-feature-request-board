/**
 * Database Migration Script
 * Run this to apply schema changes and data migrations to existing database
 *
 * Usage:
 *   node database/migrate.js
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log('🔄 Running database migration...\n');

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

    console.log('📋 Reading migration script...\n');

    // Read migration file
    const migrationPath = path.join(__dirname, 'migration.sql');
    const migration = fs.readFileSync(migrationPath, 'utf8');

    // Split into individual statements (handle multi-line statements)
    const statements = migration
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📝 Found ${statements.length} migration statements\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];

      // Show progress for major operations
      if (stmt.includes('ALTER TABLE')) {
        console.log(`  ✓ Adding column...`);
      } else if (stmt.includes('CREATE INDEX')) {
        console.log(`  ✓ Creating index...`);
      } else if (stmt.includes('UPDATE') && stmt.includes('category')) {
        console.log(`  ✓ Updating category names...`);
      } else if (stmt.includes('UPDATE') && stmt.includes('topic')) {
        console.log(`  ✓ Populating topics...`);
      }

      await sql(stmt + ';');
    }

    console.log('\n✅ Migration completed successfully!\n');

    // Verify results
    console.log('🔍 Verifying migration...');

    const categoryCount = await sql`
      SELECT category, COUNT(*) as count
      FROM feature_requests
      WHERE category = 'Push Flows'
      GROUP BY category
    `;

    const topicCount = await sql`
      SELECT topic, COUNT(*) as count
      FROM feature_requests
      WHERE topic IS NOT NULL
      GROUP BY topic
      ORDER BY count DESC
    `;

    console.log('\n📊 Migration Results:');
    if (categoryCount.length > 0) {
      console.log(`  Push Flows entries: ${categoryCount[0].count}`);
    }

    console.log(`\n  Topics created: ${topicCount.length}`);
    topicCount.forEach(row => {
      console.log(`    - ${row.topic}: ${row.count} entries`);
    });

    console.log('\n✨ Database migration complete!');
    console.log('🎉 Your database is ready with new features.\n');

  } catch (error) {
    console.error('\n❌ Error running migration:');
    console.error(error);
    process.exit(1);
  }

  process.exit(0);
}

// Run migration
runMigration();
