import { getActiveOrganizationId } from "../../organization/context";
import { listWorkspaceConnections } from "./store";
import { getWorkspaceProvider } from "./catalog";

const MAX_CHARS = 4_000;

export async function buildWorkspaceConnectionsPromptBlock(
  organizationId?: string | null
): Promise<string> {
  const orgId = organizationId || getActiveOrganizationId();
  if (!orgId) {
    return "BUSINESS DATA INTEGRATIONS: none in this workspace context.";
  }
  const connections = await listWorkspaceConnections(orgId).catch(() => []);
  if (connections.length === 0) {
    return "BUSINESS DATA INTEGRATIONS: none connected.";
  }

  const lines = [
    "BUSINESS DATA INTEGRATIONS (read-only context from connected workspace apps):",
  ];
  for (const connection of connections) {
    const catalog = getWorkspaceProvider(connection.provider);
    const meta = Object.entries(connection.metadata)
      .filter(([, value]) => value)
      .map(([key, value]) => `${key}=${value}`)
      .join(", ");
    lines.push(
      `- ${catalog?.displayName ?? connection.provider}: connected${meta ? ` (${meta})` : ""}`
    );
  }
  lines.push(
    "Use these sources as supporting customer/business context. Do not invent CRM, support, or analytics facts that are not in the ticket or this block."
  );
  const block = lines.join("\n");
  if (block.length <= MAX_CHARS) return block;
  return `${block.slice(0, MAX_CHARS)}\n…truncated`;
}
