import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function waitForDatabase(retries = 5, delayMs = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query('SELECT 1');
      console.log('Database connected successfully.');
      return;
    } catch (error: any) {
      console.error(`Database connection failed: ${error.message}. Retrying in ${delayMs}ms... (${i + 1}/${retries})`);
      if (i === retries - 1) throw error;
      await new Promise(res => setTimeout(res, delayMs));
    }
  }
}
