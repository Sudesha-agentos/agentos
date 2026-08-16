export type SqlStatementKind = "query" | "execute" | "migrate" | "forbidden";

export interface SqlGuardResult {
  kind: SqlStatementKind;
  needsConfirm: boolean;
  reason?: string;
  keyword: string;
}

const FORBIDDEN_ALWAYS = [
  /\bdrop\s+database\b/i,
  /\bdrop\s+schema\b/i,
  /\bdrop\s+user\b/i,
  /\bdrop\s+role\b/i,
  /\balter\s+system\b/i,
  /\bcreate\s+user\b/i,
  /\bcreate\s+role\b/i,
  /\bgrant\b/i,
  /\brevoke\b/i,
  /\bcopy\s+.+\s+to\s+program\b/i,
  /\binto\s+outfile\b/i,
  /\binto\s+dumpfile\b/i,
  /\bload_file\s*\(/i,
  /\bload\s+data\b/i,
  /\bpg_read_file\s*\(/i,
  /\bpg_ls_dir\s*\(/i,
  /\blo_import\s*\(/i,
  /\bdblink\s*\(/i,
  /\bset\s+role\b/i,
  /\bset\s+session\s+authorization\b/i,
];

const MIGRATE_KEYWORDS = new Set([
  "CREATE",
  "ALTER",
  "DROP",
  "COMMENT",
  "RENAME",
]);

const EXECUTE_KEYWORDS = new Set(["INSERT", "UPDATE", "DELETE", "TRUNCATE", "REPLACE", "MERGE"]);
const QUERY_KEYWORDS = new Set(["SELECT", "WITH", "EXPLAIN", "SHOW", "DESCRIBE", "DESC", "VALUES"]);

function stripComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
    .replace(/#[^\n]*/g, " ")
    .trim();
}

function firstKeyword(sql: string): string {
  const match = sql.match(/^\(?\s*([a-zA-Z]+)/);
  return (match?.[1] ?? "").toUpperCase();
}

function hasMultipleStatements(sql: string): boolean {
  const trimmed = sql.replace(/;\s*$/, "").trim();
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < trimmed.length; i += 1) {
    const ch = trimmed[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === ";" && !inSingle && !inDouble) return true;
  }
  return false;
}

function hasWhereClause(sql: string): boolean {
  return /\bwhere\b/i.test(sql);
}

export function classifySql(raw: string): SqlGuardResult {
  const sql = stripComments(raw);
  if (!sql) {
    return { kind: "forbidden", needsConfirm: false, reason: "SQL is empty", keyword: "" };
  }
  if (hasMultipleStatements(sql)) {
    return {
      kind: "forbidden",
      needsConfirm: false,
      reason: "Only a single SQL statement is allowed",
      keyword: firstKeyword(sql),
    };
  }

  for (const pattern of FORBIDDEN_ALWAYS) {
    if (pattern.test(sql)) {
      return {
        kind: "forbidden",
        needsConfirm: false,
        reason: "This statement is blocked for safety",
        keyword: firstKeyword(sql),
      };
    }
  }

  const keyword = firstKeyword(sql);
  if (QUERY_KEYWORDS.has(keyword)) {
    return { kind: "query", needsConfirm: false, keyword };
  }

  if (keyword === "TRUNCATE") {
    return {
      kind: "execute",
      needsConfirm: true,
      reason: "TRUNCATE requires explicit confirmation",
      keyword,
    };
  }

  if (keyword === "DELETE" || keyword === "UPDATE") {
    if (!hasWhereClause(sql)) {
      return {
        kind: "execute",
        needsConfirm: true,
        reason: `${keyword} without WHERE requires explicit confirmation`,
        keyword,
      };
    }
    return { kind: "execute", needsConfirm: false, keyword };
  }

  if (EXECUTE_KEYWORDS.has(keyword)) {
    return { kind: "execute", needsConfirm: false, keyword };
  }

  if (MIGRATE_KEYWORDS.has(keyword)) {
    const droppingTable = /\bdrop\s+(table|index|view|materialized\s+view)\b/i.test(sql);
    return {
      kind: "migrate",
      needsConfirm: droppingTable,
      reason: droppingTable ? "DROP requires explicit confirmation on production" : undefined,
      keyword,
    };
  }

  return {
    kind: "forbidden",
    needsConfirm: false,
    reason: `Unsupported statement type: ${keyword || "unknown"}`,
    keyword,
  };
}
