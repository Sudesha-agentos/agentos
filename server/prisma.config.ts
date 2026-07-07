import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Migrations need direct Postgres (Supabase db.*.supabase.co), not the transaction pooler.
    url:
      process.env.DIRECT_DATABASE_URL?.trim() ||
      process.env.DATABASE_URL?.trim() ||
      env("DATABASE_URL"),
  },
});
