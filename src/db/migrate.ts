/**
 * Migration runner — usable two ways:
 *
 * 1. Imported by index.ts to run on every startup (free-tier Render workaround
 *    since Pre-Deploy Command requires a paid plan):
 *       await runMigrations();
 *
 * 2. Run directly as a standalone script when you need to migrate manually:
 *       bun run db:migrate:deploy
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import path from "path";

const migrationsFolder = path.join(import.meta.dir, "../../drizzle");

export async function runMigrations(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  // Single connection — migrations don't need a pool
  const client = postgres(url, { max: 1 });
  const db = drizzle(client);

  try {
    console.log("[Migrate] Running pending migrations...");
    await migrate(db, {
      migrationsFolder,
      migrationsTable: "__drizzle_migrations",
      migrationsSchema: "public",
    });
    console.log("[Migrate] ✓ Database is up to date.");
  } catch (err) {
    console.error("[Migrate] ✗ Migration failed:", err);
    throw err; // re-throw so the server doesn't start with a broken schema
  } finally {
    await client.end();
  }
}

// Allow running as a standalone script: bun run db:migrate:deploy
if (import.meta.main) {
  try {
    await runMigrations();
    process.exit(0);
  } catch {
    process.exit(1);
  }
}
