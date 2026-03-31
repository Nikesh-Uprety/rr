import * as dotenv from "dotenv";
dotenv.config();
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Please configure your Postgres connection string.",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? true : { rejectUnauthorized: false },
  // Neon pooler can take longer to establish connections, especially with SSL
  // Increased to 15s to handle network latency and SSL handshake
  connectionTimeoutMillis: 15000,
  // Query timeout to prevent hanging queries
  query_timeout: 10000,
});

export const db = drizzle(pool, { schema });

export type DbClient = typeof db;

