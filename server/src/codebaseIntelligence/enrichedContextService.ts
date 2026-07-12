import { prisma } from "../db/client";
import { getGitCredentials } from "../git-integration/gitCredentialsStore";
import { fetchFilesAtRef } from "../integrations/git/githubGraphqlClient";
import { logger } from "../utils/logger";
import {
  getFileConnections,
  parseImports,
  type FileConnections,
  type ImportConnection,
} from "./directoryService";
import { searchCodebaseForEngineering, searchWorkFiles, type WorkFileHit } from "./fileRanker";
import { requireRepoScope } from "./repoScope";
import {
  CONTEXT_CONTENT_PREVIEW_CHARS,
  CONTEXT_GQL_MAX_FILES,
  CONTEXT_GRAPH_DEPTH,
  CONTEXT_SQL_TOP_N,
} from "./retrievalConfig";

const prismaAny = prisma as any;

export type EnrichedFileContext = {
  path: string;
  score: number;
  changeScope?: string;
  summary: string | null;
  patterns: string[];
  imports: ImportConnection[];
  incoming: ImportConnection[];
  contentPreview: string;
  contentSource: "prisma" | "github_graphql" | "chunk";
  neighbors: string[];
  matchReasons: string[];
};

export type CodebaseContextBundle = {
  workFiles: WorkFileHit[];
  files: EnrichedFileContext[];
  formatted: string;
};

export async function buildEnrichedCodebaseContext(input: {
  query: string;
  branchName: string;
  ticketText?: string;
  components?: string[];
  topN?: number;
  fetchFreshContent?: boolean;
  /** Engineering agent: looser semantic search, no work-threshold filter */
  forEngineering?: boolean;
}): Promise<CodebaseContextBundle> {
  const workFiles = input.forEngineering
    ? await searchCodebaseForEngineering({
        query: input.query,
        branchName: input.branchName,
        topN: input.topN ?? CONTEXT_SQL_TOP_N,
      })
    : await searchWorkFiles({
        query: input.query,
        branchName: input.branchName,
        ticketText: input.ticketText ?? input.query,
        components: input.components ?? [],
        topN: input.topN ?? CONTEXT_SQL_TOP_N,
      });

  if (workFiles.length === 0) {
    const emptyMessage = input.forEngineering
      ? "No semantic matches for this query. Use grep with concrete patterns (e.g. auth, OAuth, signIn, google) under src/ — do not rely on search_codebase alone."
      : "No candidate files to change (index may be empty or query too narrow)";
    return {
      workFiles: [],
      files: [],
      formatted: emptyMessage,
    };
  }

  const scope = requireRepoScope();
  const topPaths = workFiles.slice(0, CONTEXT_SQL_TOP_N).map((f) => f.path);
  const scoreByPath = new Map(workFiles.map((f) => [f.path, f]));

  const sqlRows = await prismaAny.codebaseFile.findMany({
    where: {
      repoOwner: scope.repoOwner,
      repoName: scope.repoName,
      branchName: input.branchName,
      filePath: { in: topPaths },
      isDeleted: false,
    },
    select: {
      filePath: true,
      summary: true,
      patterns: true,
      imports: true,
      content: true,
      indexedAt: true,
    },
  });

  const rowByPath = new Map(sqlRows.map((r: { filePath: string }) => [r.filePath, r]));

  const neighborSet = new Set<string>();
  const connectionsByPath = new Map<string, FileConnections>();

  for (const path of topPaths.slice(0, 6)) {
    try {
      const conn = await getFileConnections(input.branchName, path);
      connectionsByPath.set(path, conn);
      for (const o of conn.outgoing) neighborSet.add(o.path);
      for (const i of conn.incoming) neighborSet.add(i.path);
    } catch (err) {
      logger.debug({ err, path }, "getFileConnections skipped");
    }
  }

  const gqlPaths = topPaths
    .filter((path) => {
      const row = rowByPath.get(path) as { content?: string | null } | undefined;
      return input.fetchFreshContent !== false && (!row?.content || row.content.length < 200);
    })
    .slice(0, CONTEXT_GQL_MAX_FILES);

  let gqlBlobs = new Map<string, { content: string }>();
  if (gqlPaths.length > 0) {
    try {
      const creds = getGitCredentials();
      if (creds.provider === "github") {
        const blobs = await fetchFilesAtRef({
          owner: scope.repoOwner,
          repo: scope.repoName,
          ref: input.branchName,
          paths: gqlPaths,
        });
        gqlBlobs = new Map(
          [...blobs.entries()].map(([p, b]) => [p, { content: b.content }])
        );
      }
    } catch (err) {
      logger.debug({ err }, "GraphQL content fetch skipped in enriched context");
    }
  }

  const files: EnrichedFileContext[] = topPaths.map((path) => {
    const wf = scoreByPath.get(path)!;
    const row = rowByPath.get(path) as
      | {
          summary?: string | null;
          patterns?: unknown;
          imports?: unknown;
          content?: string | null;
        }
      | undefined;
    const conn = connectionsByPath.get(path);
    const gql = gqlBlobs.get(path);

    let contentPreview = "";
    let contentSource: EnrichedFileContext["contentSource"] = "chunk";

    if (gql?.content) {
      contentPreview = gql.content.slice(0, CONTEXT_CONTENT_PREVIEW_CHARS);
      contentSource = "github_graphql";
    } else if (row?.content) {
      contentPreview = row.content.slice(0, CONTEXT_CONTENT_PREVIEW_CHARS);
      contentSource = "prisma";
    } else if (wf.bestChunk) {
      contentPreview = wf.bestChunk.slice(0, CONTEXT_CONTENT_PREVIEW_CHARS);
      contentSource = "chunk";
    }

    const patterns = Array.isArray(row?.patterns)
      ? (row!.patterns as string[]).filter((p) => typeof p === "string")
      : [];

    const neighbors = [
      ...(conn?.outgoing.map((o) => o.path) ?? []),
      ...(conn?.incoming.map((i) => i.path) ?? []),
    ].slice(0, CONTEXT_GRAPH_DEPTH * 8);

    return {
      path,
      score: wf.score,
      changeScope: wf.changeScope,
      summary: row?.summary ?? wf.summary ?? null,
      patterns,
      imports: conn?.outgoing ?? parseImportsToConnections(path, row?.imports),
      incoming: conn?.incoming ?? [],
      contentPreview,
      contentSource,
      neighbors,
      matchReasons: wf.matchReasons,
    };
  });

  return {
    workFiles,
    files,
    formatted: await formatEnrichedContextBundleAsync(
      workFiles,
      files,
      [...neighborSet].slice(0, 30),
      input.query,
      input.branchName
    ),
  };
}

function parseImportsToConnections(
  filePath: string,
  raw: unknown
): ImportConnection[] {
  const result: ImportConnection[] = [];
  for (const imp of parseImports(raw)) {
    result.push({ path: imp.from, items: imp.items });
  }
  return result;
}

export function formatEnrichedContextBundle(
  workFiles: WorkFileHit[],
  files: EnrichedFileContext[],
  graphNeighbors: string[]
): string {
  const lines: string[] = [];

  lines.push("## Work files (vector-ranked)");
  for (const f of workFiles) {
    const prefix = f.changeScope === "create_new" ? "+" : "~";
    lines.push(
      `${prefix} ${f.path} (${f.changeScope}, score ${f.score.toFixed(2)}) [${f.matchReasons.join(", ")}]`
    );
    if (f.summary) lines.push(`  Summary: ${f.summary}`);
  }

  lines.push("\n## File intelligence (SQL + graph)");
  for (const f of files) {
    lines.push(`\n### ${f.path} (score ${f.score.toFixed(2)}, source: ${f.contentSource})`);
    if (f.summary) lines.push(`Summary: ${f.summary}`);
    if (f.patterns.length) lines.push(`Patterns: ${f.patterns.join(", ")}`);
    if (f.imports.length) {
      lines.push(
        `Imports: ${f.imports.map((i) => `${i.path} (${i.items.slice(0, 3).join(", ")})`).join("; ")}`
      );
    }
    if (f.incoming.length) {
      lines.push(`Imported by: ${f.incoming.map((i) => i.path).join(", ")}`);
    }
    if (f.neighbors.length) {
      lines.push(`Neighbors: ${f.neighbors.join(", ")}`);
    }
    if (f.contentPreview) {
      lines.push(`Preview:\n${f.contentPreview.slice(0, 1200)}`);
    }
  }

  if (graphNeighbors.length) {
    lines.push(`\n## Graph neighbors\n${graphNeighbors.join("\n")}`);
  }

  return lines.join("\n");
}

async function formatEnrichedContextBundleAsync(
  workFiles: WorkFileHit[],
  files: EnrichedFileContext[],
  graphNeighbors: string[],
  query: string,
  branchName: string
): Promise<string> {
  let text = formatEnrichedContextBundle(workFiles, files, graphNeighbors);
  try {
    const { gnQuery, gnDetectChanges, isGitNexusGraphEnabled } = await import("./gitnexus");
    if (!isGitNexusGraphEnabled()) return text;

    const [q, changes] = await Promise.all([
      gnQuery({ query, branchName, limit: 5 }).catch(() => null),
      gnDetectChanges({
        changedFiles: workFiles.map((f) => f.path),
        branchName,
        scope: "work_files",
      }).catch(() => null),
    ]);

    const gnLines: string[] = ["\n## Knowledge graph (GitNexus)"];
    if (q?.processes?.length) {
      gnLines.push("### Process-grouped query");
      for (const p of q.processes.slice(0, 5)) {
        gnLines.push(
          `- ${p.summary} (${p.process_type}, priority ${Number(p.priority).toFixed(3)}, ${p.step_count} steps)`
        );
      }
    }
    if (changes?.summary) {
      gnLines.push(
        `### Detect changes\nrisk=${changes.summary.risk_level}; symbols=${changes.summary.changed_count}; processes=${changes.summary.affected_count}`
      );
      if (changes.affected_processes?.length) {
        gnLines.push(`Affected processes: ${changes.affected_processes.slice(0, 8).join(", ")}`);
      }
    }
    if (gnLines.length > 1) text = `${text}\n${gnLines.join("\n")}`;
  } catch {
    /* graph optional */
  }
  return text;
}

export async function enrichWorkFilePaths(
  paths: string[],
  branchName: string,
  scores?: Map<string, number>
): Promise<EnrichedFileContext[]> {
  const bundle = await buildEnrichedCodebaseContext({
    query: paths.join(" "),
    branchName,
    topN: paths.length,
    fetchFreshContent: true,
  });
  return bundle.files.filter((f) => paths.includes(f.path));
}
