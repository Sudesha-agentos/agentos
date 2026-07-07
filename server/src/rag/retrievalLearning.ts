import { prisma } from "../db/client";
import { resolveRepoScope } from "../codebaseIntelligence/repoScope";
import { requireActiveOrganizationId } from "../organization/orgScope";
import { logger } from "../utils/logger";
import type { RetrospectiveOutput } from "../agents/pm/types";

const componentPatternBoosts = new Map<string, Set<string>>();
const ticketThresholdOffsets = new Map<string, number>();
const codebaseThresholdOffsets = new Map<string, number>();

const hydratedOrgs = new Set<string>();

const PATTERN_KEYWORDS: Record<string, string[]> = {
  billing: ["billing", "config", "api-route"],
  config: ["config", "utility"],
  auth: ["auth", "middleware"],
};

interface PersistedLearningState {
  componentPatternBoosts?: Record<string, string[]>;
  ticketThresholdOffsets?: Record<string, number>;
  codebaseThresholdOffsets?: Record<string, number>;
}

function orgScopedKey(organizationId: string, component: string): string {
  return `${organizationId}::${component}`;
}

function loadStateIntoMemory(organizationId: string, state: PersistedLearningState): void {
  for (const [component, patterns] of Object.entries(state.componentPatternBoosts ?? {})) {
    componentPatternBoosts.set(orgScopedKey(organizationId, component), new Set(patterns));
  }
  for (const [component, offset] of Object.entries(state.ticketThresholdOffsets ?? {})) {
    ticketThresholdOffsets.set(orgScopedKey(organizationId, component), offset);
  }
  for (const [component, offset] of Object.entries(state.codebaseThresholdOffsets ?? {})) {
    codebaseThresholdOffsets.set(orgScopedKey(organizationId, component), offset);
  }
}

function serializeMemoryForOrg(organizationId: string): PersistedLearningState {
  const prefix = `${organizationId}::`;
  const state: PersistedLearningState = {
    componentPatternBoosts: {},
    ticketThresholdOffsets: {},
    codebaseThresholdOffsets: {},
  };

  for (const [key, patterns] of componentPatternBoosts.entries()) {
    if (!key.startsWith(prefix)) continue;
    const component = key.slice(prefix.length);
    state.componentPatternBoosts![component] = [...patterns];
  }
  for (const [key, offset] of ticketThresholdOffsets.entries()) {
    if (!key.startsWith(prefix)) continue;
    state.ticketThresholdOffsets![key.slice(prefix.length)] = offset;
  }
  for (const [key, offset] of codebaseThresholdOffsets.entries()) {
    if (!key.startsWith(prefix)) continue;
    state.codebaseThresholdOffsets![key.slice(prefix.length)] = offset;
  }

  return state;
}

async function ensureRetrievalLearningHydrated(organizationId: string): Promise<void> {
  if (hydratedOrgs.has(organizationId)) return;
  hydratedOrgs.add(organizationId);

  try {
    const row = await prisma.retrievalLearningState.findUnique({
      where: { organizationId },
    });
    if (row?.state && typeof row.state === "object") {
      loadStateIntoMemory(organizationId, row.state as PersistedLearningState);
    }
  } catch (err) {
    logger.warn({ err, organizationId }, "retrieval learning hydrate failed");
    hydratedOrgs.delete(organizationId);
  }
}

async function persistLearningState(organizationId: string): Promise<void> {
  const state = serializeMemoryForOrg(organizationId);
  try {
    await prisma.retrievalLearningState.upsert({
      where: { organizationId },
      create: { organizationId, state: state as object },
      update: { state: state as object },
    });
  } catch (err) {
    logger.warn({ err, organizationId }, "retrieval learning persist failed");
  }
}

export async function recordRetrospectiveLearning(
  retrospective: RetrospectiveOutput,
  ticketComponents: string[] = []
): Promise<void> {
  const organizationId = requireActiveOrganizationId();
  await ensureRetrievalLearningHydrated(organizationId);

  for (const component of ticketComponents) {
    const key = orgScopedKey(organizationId, component);
    if (!componentPatternBoosts.has(key)) {
      componentPatternBoosts.set(key, new Set());
    }
    const boosts = componentPatternBoosts.get(key)!;
    for (const [patternKey, patterns] of Object.entries(PATTERN_KEYWORDS)) {
      if (component.toLowerCase().includes(patternKey)) {
        patterns.forEach((p) => boosts.add(p));
      }
    }
  }

  for (const signal of retrospective.learningSignals ?? []) {
    const lower = signal.toLowerCase();
    for (const [patternKey, patterns] of Object.entries(PATTERN_KEYWORDS)) {
      if (lower.includes(patternKey)) {
        for (const component of ticketComponents) {
          const key = orgScopedKey(organizationId, component);
          if (!componentPatternBoosts.has(key)) {
            componentPatternBoosts.set(key, new Set());
          }
          patterns.forEach((p) => componentPatternBoosts.get(key)!.add(p));
        }
      }
    }
  }

  if (retrospective.patternFlag && retrospective.patternFlag !== "none") {
    logger.info(
      { patternFlag: retrospective.patternFlag },
      "retrospective pattern recorded for retrieval boosts"
    );
  }

  if (retrospective.fileDetectionAccuracy?.toLowerCase().includes("missed")) {
    for (const component of ticketComponents) {
      const key = orgScopedKey(organizationId, component);
      const prevTicket = ticketThresholdOffsets.get(key) ?? 0;
      ticketThresholdOffsets.set(key, Math.min(prevTicket - 0.02, 0));
      const prevCode = codebaseThresholdOffsets.get(key) ?? 0;
      codebaseThresholdOffsets.set(key, Math.min(prevCode - 0.02, 0));
    }
  }
  if (retrospective.fileDetectionAccuracy?.toLowerCase().includes("accurate")) {
    for (const component of ticketComponents) {
      const key = orgScopedKey(organizationId, component);
      const prevTicket = ticketThresholdOffsets.get(key) ?? 0;
      ticketThresholdOffsets.set(key, Math.max(prevTicket + 0.01, 0));
      const prevCode = codebaseThresholdOffsets.get(key) ?? 0;
      codebaseThresholdOffsets.set(key, Math.max(prevCode + 0.01, 0));
    }
  }

  await persistLearningState(organizationId);
}

export function getTicketThresholdOffset(components: string[]): number {
  let organizationId: string | undefined;
  try {
    organizationId = requireActiveOrganizationId();
    if (!hydratedOrgs.has(organizationId)) {
      void ensureRetrievalLearningHydrated(organizationId);
    }
  } catch {
    organizationId = undefined;
  }

  let offset = 0;
  for (const component of components) {
    const key = organizationId ? orgScopedKey(organizationId, component) : component;
    offset += ticketThresholdOffsets.get(key) ?? 0;
  }
  return Math.max(-0.08, Math.min(0.08, offset));
}

export function getCodebaseThresholdOffset(components: string[]): number {
  let organizationId: string | undefined;
  try {
    organizationId = requireActiveOrganizationId();
    if (!hydratedOrgs.has(organizationId)) {
      void ensureRetrievalLearningHydrated(organizationId);
    }
  } catch {
    organizationId = undefined;
  }

  let offset = 0;
  for (const component of components) {
    const key = organizationId ? orgScopedKey(organizationId, component) : component;
    offset += codebaseThresholdOffsets.get(key) ?? 0;
  }
  return Math.max(-0.08, Math.min(0.08, offset));
}

export function getBoostedPatternTags(components: string[]): string[] {
  let organizationId: string | undefined;
  try {
    organizationId = requireActiveOrganizationId();
    if (!hydratedOrgs.has(organizationId)) {
      void ensureRetrievalLearningHydrated(organizationId);
    }
  } catch {
    organizationId = undefined;
  }

  const tags = new Set<string>();
  for (const component of components) {
    const key = organizationId ? orgScopedKey(organizationId, component) : component;
    const boosted = componentPatternBoosts.get(key);
    if (boosted) boosted.forEach((t) => tags.add(t));
    for (const [patternKey, patterns] of Object.entries(PATTERN_KEYWORDS)) {
      if (component.toLowerCase().includes(patternKey)) {
        patterns.forEach((p) => tags.add(p));
      }
    }
  }
  return [...tags];
}

/** Append pattern tags to codebase files mentioned in retrospective file-detection notes. */
export async function applyFilePatternBoostsFromRetrospective(
  retrospective: RetrospectiveOutput,
  affectedFilePaths: string[],
  branchName: string
): Promise<void> {
  const scope = resolveRepoScope();
  if (!scope || affectedFilePaths.length === 0) return;

  const note = retrospective.fileDetectionAccuracy ?? "";
  const tags = getBoostedPatternTags([]);
  if (note.toLowerCase().includes("config")) tags.push("config");
  if (note.toLowerCase().includes("billing")) tags.push("billing");

  if (tags.length === 0) return;

  for (const filePath of affectedFilePaths.slice(0, 10)) {
    try {
      const organizationId = requireActiveOrganizationId();
      const row = await prisma.codebaseFile.findUnique({
        where: {
          organizationId_repoOwner_repoName_filePath_branchName: {
            organizationId,
            repoOwner: scope.repoOwner,
            repoName: scope.repoName,
            filePath,
            branchName,
          },
        },
      });
      if (!row) continue;

      const existing = Array.isArray(row.patterns) ? (row.patterns as string[]) : [];
      const merged = [...new Set([...existing, ...tags])];
      await prisma.codebaseFile.update({
        where: { id: row.id },
        data: { patterns: merged },
      });
    } catch (err) {
      logger.warn({ err, filePath }, "retrospective pattern boost failed");
    }
  }
}
