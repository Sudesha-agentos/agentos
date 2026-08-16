import { listDatabases, listTableCatalog, resolveCustomerDbOrganizationId } from "./store";

const MAX_CHARS = 8_000;

export async function buildDatabaseCatalogPromptBlock(pipelineId?: string): Promise<string> {
  const organizationId = await resolveCustomerDbOrganizationId(pipelineId);
  if (!organizationId) {
    return "CUSTOMER DATABASES: none in this workspace context.";
  }
  const databases = await listDatabases(organizationId);
  if (databases.length === 0) {
    return [
      "CUSTOMER DATABASES: none connected.",
      "Do not invent a database. If the ticket needs schema work, note that a database must be attached in Settings → Integrations.",
    ].join("\n");
  }

  const sections: string[] = [
    "CUSTOMER DATABASES (existing databases the customer attached — reference by database id + schema.table):",
    "Staging/dev with autoMigrate: apply DDL with db_migrate. Production: db_migrate queues for human confirm unless confirm=true after a human gate.",
    "Never DROP DATABASE. Never DELETE/UPDATE without WHERE unless the human confirmed.",
  ];

  for (const db of databases.slice(0, 8)) {
    const tables = await listTableCatalog(organizationId, db.id).catch(() => []);
    const tableBits = tables.slice(0, 40).map((table) => {
      const cols = table.columns
        .slice(0, 12)
        .map((c) => c.name)
        .join(", ");
      return `  - ${table.schemaName}.${table.tableName} (${cols || "no columns yet"})`;
    });
    sections.push(
      [
        `- [${db.id}] ${db.name} (${db.provider}, ${db.environment}) ${db.host}/${db.databaseName}`,
        `  autoMigrate=${db.autoMigrate} requireConfirm=${db.requireConfirmToApply} tables=${db.tableCount}`,
        ...(tableBits.length ? tableBits : ["  - schema not introspected yet — call db_schema"]),
      ].join("\n")
    );
  }

  const block = sections.join("\n");
  if (block.length <= MAX_CHARS) return block;
  return `${block.slice(0, MAX_CHARS)}\n…catalog truncated`;
}
