import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const client = postgres(process.env.DATABASE_URL, {
  max: 3, // keep pool small on free tier
  idle_timeout: 20, // close idle connections after 20s so Neon doesn't drop them first
  connect_timeout: 10, // fail fast if DB unreachable — prevents requests hanging forever
});

export const db = drizzle(client, { schema });

export type DB = typeof db;
