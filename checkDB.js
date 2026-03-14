/**
 * Quick database check script
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

async function checkDatabase() {
  const sql = neon(process.env.DATABASE_URL);

  console.log('📊 Database Status Check\n');

  // Total count
  const total = await sql`SELECT COUNT(*) as count FROM feature_requests`;
  console.log(`Total records: ${total[0].count}`);

  // Count by channel
  const byChannel = await sql`
    SELECT channel, COUNT(*) as count
    FROM feature_requests
    GROUP BY channel
    ORDER BY channel
  `;
  console.log('\nRecords by channel:');
  byChannel.forEach(row => {
    console.log(`  ${row.channel}: ${row.count}`);
  });

  // Count workflow vs regular messages
  const byType = await sql`
    SELECT is_workflow, COUNT(*) as count
    FROM feature_requests
    GROUP BY is_workflow
    ORDER BY is_workflow
  `;
  console.log('\nRecords by type:');
  byType.forEach(row => {
    console.log(`  ${row.is_workflow ? 'Workflow' : 'Regular'}: ${row.count}`);
  });

  // Show a few recent records
  const recent = await sql`
    SELECT id, merchant, category, request_group, channel, is_workflow, date
    FROM feature_requests
    ORDER BY date DESC
    LIMIT 5
  `;
  console.log('\nMost recent 5 records:');
  recent.forEach(row => {
    console.log(`  ${row.id} | ${row.merchant} | ${row.category} | ${row.channel} | ${row.is_workflow ? 'workflow' : 'regular'}`);
  });

  process.exit(0);
}

checkDatabase().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
