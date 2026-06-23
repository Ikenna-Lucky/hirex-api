/**
 * Programmatic migration runner.
 *
 * Used by CI/CD and Render deploy hooks:
 *   bun run src/db/migrate.ts
 *
 * This does NOT require drizzle-kit to be installed — only drizzle-orm,
 * which is already a production dependency.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import path from "path";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

// Use a single connection for migrations (not a pool)
const client = postgres(url, { max: 1 });
const db = drizzle(client);

const migrationsFolder = path.join(import.meta.dir, "../../drizzle");

console.log("[Migrate] Connecting to database...");

try {
  await migrate(db, {
    migrationsFolder,
    migrationsTable: "__drizzle_migrations",
    migrationsSchema: "public",
  });
  console.log("[Migrate] ✓ All migrations applied successfully.");
} catch (err) {
  console.error("[Migrate] ✗ Migration failed:", err);
  process.exit(1);
} finally {
  await client.end();
}
