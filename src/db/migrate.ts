import { pool } from './pool';
import fs from 'fs';
import path from 'path';

export async function runMigrations() {
  console.log('Running database migrations...');
  
  // 1. Create the migrations table if it doesn't exist.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMP DEFAULT now()
    );
  `);

  const migrationsDir = path.join(process.cwd(), 'src', 'db', 'migrations');
  
  // 2. Read all .sql files in db/migrations/, sorted alphabetically.
  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    // 3. Skip any file already recorded in migrations.
    const { rowCount } = await pool.query(
      'SELECT 1 FROM migrations WHERE filename = $1',
      [file]
    );

    if (rowCount && rowCount > 0) {
      continue;
    }

    console.log(`Applying migration: ${file}`);
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    // 4. Run and record the rest, in order, inside a transaction per file.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`Migration ${file} applied successfully.`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`Failed to apply migration ${file}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  console.log('Database migrations completed.');
}
