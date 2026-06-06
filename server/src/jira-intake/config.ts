import path from "path";

const serverRoot = path.join(__dirname, "..", "..");

function resolveSqlitePath(envPath: string | undefined): string {
  const p = envPath || "./data/jira-intake.db";
  return path.isAbsolute(p) ? p : path.join(serverRoot, p);
}

export const intakeConfig = {
  logLevel: process.env.LOG_LEVEL || "info",
  sqlitePath: resolveSqlitePath(process.env.SQLITE_PATH),
};
