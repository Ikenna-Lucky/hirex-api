/**
 * Baseline migration bootstrapper.
 *
 * Run this ONCE after generating the initial migration on an existing database
 * (one that was previously managed with `db:push`).
 *
 * What it does:
 *   1. Reads the generated drizzle/meta/_journal.json
 *   2. Creates the __drizzle_migrations tracking table if it doesn't exist
 *   3. Marks every existing migration file as already applied WITHOUT running
 *      their SQL — because the tables already exist from db:push
 *
 * After running this once, use `db:migrate` / `db:migrate:deploy` for all
 * future schema changes going forward.
 *
 * Usage:
 *   bun run db:baseline
 */
import postgres from "postgres";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const client = postgres(url, { max: 1 });

const migrationsFolder = path.join(import.meta.dir, "../../drizzle");
const journalPath = path.join(migrationsFolder, "meta/_journal.json");

if (!fs.existsSync(journalPath)) {
  console.error(
    "[Baseline] No migration journal found at",
    journalPath,
    "\nRun `bun run db:generate` first to generate the initial migration.",
  );
  process.exit(1);
}

const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8")) as {
  entries: { idx: number; tag: string; when: number }[];
};

try {
  // Create the migrations tracking table if it doesn't exist
  await client`
    CREATE TABLE IF NOT EXISTS public."__drizzle_migrations" (
      id        SERIAL PRIMARY KEY,
      hash      TEXT NOT NULL,
      created_at BIGINT
    )
  `;
  console.log("[Baseline] ✓ Migrations table ready.");

  // Get already-applied hashes so we don't double-insert
  const applied = await client<
    { hash: string }[]
  >`SELECT hash FROM public."__drizzle_migrations"`;
  const appliedSet = new Set(applied.map((r) => r.hash));

  let marked = 0;
  for (const entry of journal.entries) {
    const sqlFile = path.join(migrationsFolder, `${entry.tag}.sql`);
    if (!fs.existsSync(sqlFile)) {
      console.warn(`[Baseline] SQL file not found for ${entry.tag} — skipping`);
      continue;
    }

    // drizzle-orm computes the hash from the SQL content
    const sql = fs.readFileSync(sqlFile, "utf-8");
    const hash = crypto.createHash("sha256").update(sql).digest("hex");

    if (appliedSet.has(hash)) {
      console.log(`[Baseline]   Already marked: ${entry.tag}`);
      continue;
    }

    await client`
      INSERT INTO public."__drizzle_migrations" (hash, created_at)
      VALUES (${hash}, ${entry.when})
    `;
    console.log(`[Baseline] ✓ Marked as applied: ${entry.tag}`);
    marked++;
  }

  if (marked === 0) {
    console.log("[Baseline] All migrations already marked — nothing to do.");
  } else {
    console.log(
      `[Baseline] ✓ Done. ${marked} migration(s) marked as applied without running SQL.`,
    );
    console.log(
      "[Baseline] You can now use `bun run db:migrate:deploy` for all future changes.",
    );
  }
} catch (err) {
  console.error("[Baseline] ✗ Failed:", err);
  process.exit(1);
} finally {
  await client.end();
}
