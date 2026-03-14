const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function run() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : false
  });

  await client.connect();
  try {
    const dir = path.join(process.cwd(), 'infra', 'migrations');
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
    for (const file of files) {
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      console.log(`applying ${file}`);
      await client.query(sql);
    }
    console.log('MIGRATIONS_OK');
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error('MIGRATIONS_FAIL', err.message);
  process.exit(1);
});
