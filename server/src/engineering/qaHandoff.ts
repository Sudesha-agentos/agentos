/**
 * Ananta → Neel handshake. QA only starts after a successful GitHub push
 * on a per-ticket branch (HTTP 200).
 */

export const QA_HANDOFF_OK = 200 as const;

export type QaHandoff = {
  status: typeof QA_HANDOFF_OK;
  readyForQa: true;
  jiraKey: string;
  implementationBranch: string;
  commitSha: string;
  filesChanged: number;
  codingSummary: string;
  compileFailed: boolean;
};

export function buildReadyQaHandoff(input: {
  jiraKey: string;
  implementationBranch: string;
  commitSha: string;
  filesChanged: number;
  codingSummary: string;
  compileFailed?: boolean;
}): QaHandoff {
  const branch = input.implementationBranch.trim();
  const sha = input.commitSha.trim();
  if (!branch) {
    throw new Error("QA handoff requires a GitHub implementation branch");
  }
  if (!sha) {
    throw new Error("QA handoff requires a pushed commit SHA");
  }
  return {
    status: QA_HANDOFF_OK,
    readyForQa: true,
    jiraKey: input.jiraKey,
    implementationBranch: branch,
    commitSha: sha,
    filesChanged: input.filesChanged,
    codingSummary: input.codingSummary.trim() || "Engineering agent changes",
    compileFailed: Boolean(input.compileFailed),
  };
}

export function assertQaHandoffReady(handoff: QaHandoff | null | undefined): QaHandoff {
  if (!handoff || handoff.status !== QA_HANDOFF_OK || !handoff.readyForQa) {
    throw new Error(
      "QA agent cannot start: Ananta has not passed status 200 (code is not on a GitHub branch yet)."
    );
  }
  if (!handoff.implementationBranch.trim()) {
    throw new Error("QA agent cannot start: implementation branch is missing from the 200 handoff.");
  }
  return handoff;
}

export function formatQaHandoffForPrompt(handoff: QaHandoff): string {
  return [
    "## Ananta coding handoff (status 200 — start generating test cases)",
    `status: ${handoff.status}`,
    `readyForQa: ${handoff.readyForQa}`,
    `branch: ${handoff.implementationBranch}`,
    `commit: ${handoff.commitSha}`,
    `filesChanged: ${handoff.filesChanged}`,
    handoff.compileFailed
      ? "compileFailed: true — write tests against the pushed branch; note build risk in the report."
      : "compileFailed: false",
    `codingSummary: ${handoff.codingSummary}`,
  ].join("\n");
}
