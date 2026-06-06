import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { intakeConfig } from "./config";

let db: Database.Database | undefined;

export function initIntakeDb(): Database.Database {
  const dbPath = path.resolve(intakeConfig.sqlitePath);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  db = new Database(dbPath);
  const schema = fs.readFileSync(
    path.join(__dirname, "db", "schema.sql"),
    "utf8"
  );
  db.exec(schema);
  migrateGitCredentialsTable(db);
  migratePipelineJiraCredentialsTable(db);
  return db;
}

function migrateGitCredentialsTable(database: Database.Database): void {
  const columns = database.prepare("PRAGMA table_info(git_credentials)").all() as Array<{
    name: string;
  }>;
  const names = new Set(columns.map((col) => col.name));
  if (!names.has("installation_id")) {
    database.exec("ALTER TABLE git_credentials ADD COLUMN installation_id TEXT");
  }
  if (!names.has("auth_method")) {
    database.exec(
      "ALTER TABLE git_credentials ADD COLUMN auth_method TEXT NOT NULL DEFAULT 'pat'"
    );
  }
}

function migratePipelineJiraCredentialsTable(database: Database.Database): void {
  const table = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='pipeline_jira_credentials'"
    )
    .get() as { name?: string } | undefined;
  if (!table?.name) return;

  const columns = database
    .prepare("PRAGMA table_info(pipeline_jira_credentials)")
    .all() as Array<{ name: string }>;
  const names = new Set(columns.map((col) => col.name));
  if (!names.has("board_id")) {
    database.exec("ALTER TABLE pipeline_jira_credentials ADD COLUMN board_id TEXT");
  }
  if (!names.has("ai_worker_column_name")) {
    database.exec(
      "ALTER TABLE pipeline_jira_credentials ADD COLUMN ai_worker_column_name TEXT"
    );
  }
  if (!names.has("ai_worker_statuses_json")) {
    database.exec(
      "ALTER TABLE pipeline_jira_credentials ADD COLUMN ai_worker_statuses_json TEXT"
    );
  }
}

export function getDb(): Database.Database {
  if (!db) initIntakeDb();
  return db!;
}
