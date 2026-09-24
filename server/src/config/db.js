import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Supabase's pooler periodically drops idle connections; without this listener
// that surfaces as an uncaught 'error' event on the Pool and crashes the process.
pool.on('error', (err) => {
  console.error('Unexpected idle client error on pg pool:', err.message);
});
