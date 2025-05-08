import { Pool } from 'pg';
import type { PoolClient } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Test database connection on startup
pool.connect((err, client, release) => {
  if (err) {
    return console.error('Error acquiring client', err.stack);
  }
  if (client) {
    client.query('SELECT NOW()', (err, result) => {
      release();
      if (err) {
        return console.error('Error executing query', err.stack);
      }
      console.log('Connected to PostgreSQL database at:', result.rows[0].now);
    });
  } else {
    console.error('Client is undefined');
    release();
  }
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

/**
 * Execute a query with a client from the pool
 * @param text SQL query text
 * @param params Query parameters
 * @returns Query result
 */
export const query = async (text: string, params: any[] = []) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  
  if (process.env.NODE_ENV !== 'production') {
    console.log('Executed query', { text, duration, rows: res.rowCount });
  }
  
  return res;
};

/**
 * Get a client from the pool for transactions
 * @returns Client and release function
 */
export const getClient = async (): Promise<{ client: PoolClient; done: () => void }> => {
  const client = await pool.connect();
  const done = () => {
    client.release();
  };
  
  // Monkey patch the client to keep track of queries
  const query = client.query.bind(client);
  client.query = async (...args: any[]) => {
    const start = Date.now();
    const result = await query(...(args as [string, ...any[]]));
    const duration = Date.now() - start;
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('Executed query', { text: args[0], duration});
    }
    
    return result;
  };
  
  return { client, done };
};

// Export the pool for direct access if needed
export default pool;
