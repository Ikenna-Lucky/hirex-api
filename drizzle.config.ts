import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  migrations: {
    // Migration history is tracked in this table (created automatically)
    table: "__drizzle_migrations",
    schema: "public",
  },
  verbose: true,
  strict: true,
} satisfies Config;
