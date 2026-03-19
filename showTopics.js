import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.DATABASE_URL);

async function showTopics() {
  const results = await sql`
    SELECT DISTINCT topic, category, COUNT(*) as count
    FROM feature_requests
    WHERE topic IS NOT NULL
    GROUP BY topic, category
    ORDER BY category, topic
  `;

  console.log('\n📊 All Topics by Category:\n');

  let currentCategory = '';
  results.forEach(r => {
    if (r.category !== currentCategory) {
      currentCategory = r.category;
      console.log(`\n${currentCategory}:`);
    }
    console.log(`  • ${r.topic} (${r.count} request${r.count > 1 ? 's' : ''})`);
  });

  console.log(`\n\nTotal unique topics: ${results.length}\n`);
}

showTopics();
