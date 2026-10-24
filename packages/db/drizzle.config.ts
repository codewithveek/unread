import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.PG_URL || process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("PG_URL (or DATABASE_URL) is required to run drizzle-kit");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./migrations",
  dbCredentials: { url: databaseUrl },
  casing: "snake_case",
  strict: true,
  verbose: true,
});
