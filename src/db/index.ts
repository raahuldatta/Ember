import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

export function hasPostgres() {
  return Boolean(process.env.DATABASE_URL || process.env.SQL_HOST);
}

export const createPool = () => {
  if (!global._postgresPool) {
    const connectionString = process.env.DATABASE_URL;
    global._postgresPool = connectionString
      ? new Pool({
          connectionString,
          max: 10,
          connectionTimeoutMillis: 15000,
          ssl: connectionString.includes('localhost') ? undefined : { rejectUnauthorized: false },
        })
      : new Pool({
          host: process.env.SQL_HOST,
          user: process.env.SQL_USER,
          password: process.env.SQL_PASSWORD,
          database: process.env.SQL_DB_NAME,
          max: 10,
          connectionTimeoutMillis: 15000,
        });

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

export const db = hasPostgres() ? drizzle(createPool(), { schema }) : (null as any);
