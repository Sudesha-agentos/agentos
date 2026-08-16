import type Anthropic from "@anthropic-ai/sdk";

export const CUSTOMER_DB_TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: "list_databases",
    description: `
List customer databases attached to this workspace.
Use before db_schema / db_query / db_migrate so you have the database id.
Returns id, name, provider, environment, and table counts — never passwords.
    `.trim(),
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "db_schema",
    description: `
Return stored schema catalog for a customer database (schema.table, columns, PKs, FKs).
Pass database_id from list_databases. Optionally filter to one schema or table.
If the catalog is empty, the user may need to click Introspect in Settings.
    `.trim(),
    input_schema: {
      type: "object" as const,
      properties: {
        database_id: { type: "string", description: "OrganizationDatabase id" },
        schema: { type: "string", description: "Optional schema name filter" },
        table: { type: "string", description: "Optional table name filter" },
      },
      required: ["database_id"],
    },
  },
  {
    name: "db_query",
    description: `
Run a read-only SQL statement (SELECT / WITH / EXPLAIN / SHOW) on a customer database.
Results are capped. Do not use this for INSERT/UPDATE/DELETE or DDL.
    `.trim(),
    input_schema: {
      type: "object" as const,
      properties: {
        database_id: { type: "string" },
        sql: { type: "string", description: "Single SELECT (or WITH/EXPLAIN/SHOW) statement" },
      },
      required: ["database_id", "sql"],
    },
  },
  {
    name: "db_execute",
    description: `
Run DML (INSERT / UPDATE / DELETE) on a customer database.
Production and unscoped DELETE/UPDATE/TRUNCATE require confirm=true after a human gate.
    `.trim(),
    input_schema: {
      type: "object" as const,
      properties: {
        database_id: { type: "string" },
        sql: { type: "string" },
        confirm: {
          type: "boolean",
          description: "Required for production writes and DELETE/UPDATE without WHERE",
        },
      },
      required: ["database_id", "sql"],
    },
  },
  {
    name: "db_migrate",
    description: `
Apply a single DDL statement (CREATE / ALTER / COMMENT; DROP TABLE needs confirm) to a customer database.
If the ticket changes schema, update the customer DB — not only application code.
Staging/dev with autoMigrate applies immediately. Production queues awaiting_confirm unless confirm=true.
    `.trim(),
    input_schema: {
      type: "object" as const,
      properties: {
        database_id: { type: "string" },
        sql: { type: "string", description: "Single DDL statement" },
        confirm: {
          type: "boolean",
          description: "Set true only after a human confirmed a production/destructive migration",
        },
      },
      required: ["database_id", "sql"],
    },
  },
];

export const CUSTOMER_DB_READ_TOOL_DEFINITIONS: Anthropic.Tool[] =
  CUSTOMER_DB_TOOL_DEFINITIONS.filter(
    (tool) => tool.name === "list_databases" || tool.name === "db_schema" || tool.name === "db_query"
  );
