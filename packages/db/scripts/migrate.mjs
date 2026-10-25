// Applies migrations with drizzle-orm's migrator. Replaces `drizzle-kit migrate`,
// which exits 1 without printing the database error (seen on Render pre-deploy).
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.PG_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("PG_URL (or DATABASE_URL) is required to run migrations");
  process.exit(1);
}

const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));
const target = new URL(url);
console.log(`Migrating ${target.hostname}:${target.port || 5432}${target.pathname}`);

const sql = postgres(url, { max: 1, connect_timeout: 30, onnotice: () => {} });

/** Postgres errors carry code/detail/hint/where; network errors carry code only. */
function report(stage, error) {
  console.error(`Migration failed while ${stage}: ${error instanceof Error ? error.message : String(error)}`);
  for (const key of ["code", "severity", "detail", "hint", "where", "table_name", "constraint_name"]) {
    if (error?.[key]) console.error(`  ${key}: ${error[key]}`);
  }
}

let stage = "connecting";
try {
  const [server] = await sql`
    select current_setting('server_version') as version,
      exists (select 1 from pg_available_extensions where name = 'vector') as vector,
      exists (select 1 from pg_available_extensions where name = 'timescaledb') as timescaledb`;
  console.log(`Postgres ${server.version} · pgvector ${server.vector ? "available" : "MISSING"} · timescaledb ${server.timescaledb ? "available" : "absent"}`);

  stage = "applying migrations";
  await migrate(drizzle(sql), { migrationsFolder });
  console.log("Migrations applied");
} catch (error) {
  report(stage, error);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
