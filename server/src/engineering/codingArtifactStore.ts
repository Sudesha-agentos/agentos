export interface StagedSourceFile {
  filePath: string;
  content: string;
  branchName: string;
  action: "create" | "modify";
  summary: string;
}

export interface EngineeringCodingArtifacts {
  stagedFiles: StagedSourceFile[];
  readCache: Map<string, string>;
}

const store = new Map<string, EngineeringCodingArtifacts>();
const completedSnapshots = new Map<string, StagedSourceFile[]>();

function ensure(pipelineId: string): EngineeringCodingArtifacts {
  if (!store.has(pipelineId)) {
    store.set(pipelineId, { stagedFiles: [], readCache: new Map() });
  }
  return store.get(pipelineId)!;
}

export function getCodingArtifacts(pipelineId: string): EngineeringCodingArtifacts {
  return ensure(pipelineId);
}

export function cacheReadSourceFile(
  pipelineId: string,
  filePath: string,
  content: string
): void {
  ensure(pipelineId).readCache.set(filePath, content);
}

export function getCachedReadSourceFile(
  pipelineId: string,
  filePath: string
): string | undefined {
  return ensure(pipelineId).readCache.get(filePath);
}

export function snapshotCodingArtifacts(pipelineId: string): void {
  const files = ensure(pipelineId).stagedFiles;
  if (files.length) {
    completedSnapshots.set(pipelineId, files.map((f) => ({ ...f })));
  }
}

export function getStagedFilesForRun(pipelineId: string): StagedSourceFile[] {
  const live = ensure(pipelineId).stagedFiles;
  if (live.length) return live;
  return completedSnapshots.get(pipelineId) ?? [];
}

export function clearCodingArtifacts(pipelineId: string): void {
  store.delete(pipelineId);
}
