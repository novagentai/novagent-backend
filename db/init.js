require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function initDB() {
  console.log('=== Initializing Novagent Backend DB ===');
  
  // Read and execute schema
  const schema = require('fs').readFileSync('./db/schema.sql', 'utf8');
  
  try {
    await pool.query('BEGIN');
    await pool.query(schema);
    await pool.query('COMMIT');
    console.log('✓ Schema created');
    
    // Verify
    const listings = await pool.query('SELECT COUNT(*) FROM listings');
    console.log(`✓ Listings seeded: ${listings.rows[0].count}`);
    
    const contacts = await pool.query('SELECT COUNT(*) FROM contacts');
    console.log(`✓ Contacts table ready: ${contacts.rows[0].count} rows`);
    
    await pool.end();
    console.log('\n✓ DB initialization complete');
    console.log(`✓ Host: ${process.env.DATABASE_URL.match(/@([^/]+)/)?.[1] || 'unknown'}`);
    
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('✗ DB init failed:', err.message);
    process.exit(1);
  }
}

initDB();
