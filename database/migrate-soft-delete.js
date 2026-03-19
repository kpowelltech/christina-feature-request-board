/**
 * Soft Delete Migration Script
 * Adds deleted_at and deleted_by_email columns to prevent Slack re-hydration
 *
 * Usage:
 *   node database/migrate-soft-delete.js
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log('🔄 Running soft delete migration...\n');

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
    const migrationPath = path.join(__dirname, 'soft-delete-migration.sql');
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
      if (stmt.includes('ALTER TABLE') && stmt.includes('deleted_by_email')) {
        console.log(`  ✓ Adding deleted_by_email column...`);
      } else if (stmt.includes('ALTER TABLE') && stmt.includes('deleted_at')) {
        console.log(`  ✓ Adding deleted_at column...`);
      } else if (stmt.includes('CREATE INDEX') && stmt.includes('idx_deleted_at')) {
        console.log(`  ✓ Creating deleted_at index...`);
      }

      await sql(stmt + ';');
    }

    console.log('\n✅ Migration completed successfully!\n');

    // Verify results
    console.log('🔍 Verifying migration...');

    const columnCheck = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'feature_requests'
      AND column_name IN ('deleted_at', 'deleted_by_email')
      ORDER BY column_name
    `;

    console.log('\n📊 Migration Results:');
    console.log('  New columns added:');
    columnCheck.forEach(col => {
      console.log(`    - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
    });

    const indexCheck = await sql`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'feature_requests'
      AND indexname = 'idx_deleted_at'
    `;

    if (indexCheck.length > 0) {
      console.log('  ✓ Index idx_deleted_at created');
    }

    console.log('\n✨ Soft delete migration complete!');
    console.log('🎉 Deleted records will now be preserved to prevent Slack re-hydration.\n');

  } catch (error) {
    console.error('\n❌ Error running migration:');
    console.error(error);
    process.exit(1);
  }

  process.exit(0);
}

// Run migration
runMigration();
