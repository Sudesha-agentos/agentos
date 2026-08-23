import { prisma } from "../../db/client";
import {
  decryptSourceConfig,
  encryptSourceConfig,
} from "../../logIntelligence/crypto/sourceSecrets";
import { ValidationError } from "../../utils/errors";
import { getWorkspaceProvider } from "./catalog";
import { collectConfig, validateWorkspaceConfig } from "./validate";

export type PublicWorkspaceConnection = {
  id: string;
  provider: string;
  displayName: string;
  connected: true;
  metadata: Record<string, string>;
  lastVerifiedAt: string | null;
  lastError: string | null;
  createdAt: string;
  secretHints: Record<string, string>;
};

function hintFor(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 4) return "••••";
  return `…${trimmed.slice(-4)}`;
}

function asStringMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (item == null) continue;
    out[key] = String(item);
  }
  return out;
}

function toPublic(row: {
  id: string;
  provider: string;
  displayName: string;
  configEnc: unknown;
  metadata: unknown;
  lastVerifiedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
}): PublicWorkspaceConnection {
  const provider = getWorkspaceProvider(row.provider);
  const secrets = decryptSourceConfig(row.configEnc);
  const secretHints: Record<string, string> = {};
  for (const field of provider?.configSchema ?? []) {
    if (!field.secret) continue;
    const raw = secrets[field.key];
    if (typeof raw === "string" && raw.trim()) {
      secretHints[field.key] = hintFor(raw);
    }
  }
  return {
    id: row.id,
    provider: row.provider,
    displayName: row.displayName,
    connected: true,
    metadata: asStringMap(row.metadata),
    lastVerifiedAt: row.lastVerifiedAt?.toISOString() ?? null,
    lastError: row.lastError,
    createdAt: row.createdAt.toISOString(),
    secretHints,
  };
}

export async function listWorkspaceConnections(
  organizationId: string
): Promise<PublicWorkspaceConnection[]> {
  const rows = await prisma.workspaceConnection.findMany({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toPublic);
}

export async function upsertWorkspaceConnection(
  organizationId: string,
  providerId: string,
  rawConfig: unknown,
  displayName?: string
): Promise<PublicWorkspaceConnection> {
  const provider = getWorkspaceProvider(providerId);
  if (!provider) {
    throw new ValidationError(`Unknown integration: ${providerId}`);
  }
  const config = collectConfig(provider, rawConfig);
  const checked = await validateWorkspaceConfig(providerId, config);
  if (!checked.valid) {
    throw new ValidationError(checked.error || "Could not verify those credentials.");
  }

  const metadata = checked.metadata ?? {};
  const name =
    displayName?.trim() ||
    metadata.organization ||
    metadata.team ||
    metadata.name ||
    provider.displayName;
  const encrypted = encryptSourceConfig(config);
  const now = new Date();

  const row = await prisma.workspaceConnection.upsert({
    where: {
      organizationId_provider: { organizationId, provider: providerId },
    },
    create: {
      organizationId,
      provider: providerId,
      displayName: name,
      configEnc: encrypted as object,
      metadata,
      lastVerifiedAt: now,
      lastError: null,
    },
    update: {
      displayName: name,
      configEnc: encrypted as object,
      metadata,
      lastVerifiedAt: now,
      lastError: null,
    },
  });
  return toPublic(row);
}

export async function deleteWorkspaceConnection(
  organizationId: string,
  providerId: string
): Promise<boolean> {
  const result = await prisma.workspaceConnection.deleteMany({
    where: { organizationId, provider: providerId },
  });
  return result.count > 0;
}

export async function getWorkspaceConnectionSecrets(
  organizationId: string,
  providerId: string
): Promise<Record<string, string> | null> {
  const row = await prisma.workspaceConnection.findUnique({
    where: {
      organizationId_provider: { organizationId, provider: providerId },
    },
  });
  if (!row) return null;
  const decrypted = decryptSourceConfig(row.configEnc);
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(decrypted)) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}
