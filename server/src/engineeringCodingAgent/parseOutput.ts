import { extractJsonObjectByKey, tryParseJsonObject } from "../llm/parseJson";
import type { CodeChange } from "../types/agents";

export interface CodingAgentJsonOutput {
  codingSummary: string;
  codeChanges: CodeChange[];
  confidenceScore?: number;
  confidenceReason?: string;
  blockers?: string[];
}

const ACTIONS = new Set(["create", "modify", "delete"]);

function asCodeChange(value: unknown): CodeChange | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const filePath = String(item.filePath ?? "").trim();
  if (!filePath) return null;
  const action = ACTIONS.has(String(item.action))
    ? (item.action as CodeChange["action"])
    : "modify";
  return {
    filePath,
    action,
    summary: String(item.summary ?? "").trim() || `${action} ${filePath}`,
    linesChanged: typeof item.linesChanged === "number" ? item.linesChanged : 0,
  };
}

function normalize(parsed: Record<string, unknown>): CodingAgentJsonOutput {
  const codeChanges = Array.isArray(parsed.codeChanges)
    ? parsed.codeChanges.map(asCodeChange).filter((item): item is CodeChange => Boolean(item))
    : [];
  return {
    codingSummary: String(parsed.codingSummary ?? "").trim(),
    codeChanges,
    confidenceScore:
      typeof parsed.confidenceScore === "number" ? parsed.confidenceScore : undefined,
    confidenceReason:
      typeof parsed.confidenceReason === "string" ? parsed.confidenceReason : undefined,
    blockers: Array.isArray(parsed.blockers)
      ? parsed.blockers.map((item) => String(item)).filter(Boolean)
      : undefined,
  };
}

export function parseCodingAgentOutput(raw: string): CodingAgentJsonOutput | undefined {
  const direct = tryParseJsonObject(raw);
  if (direct && typeof direct === "object" && direct !== null) {
    const record = direct as Record<string, unknown>;
    if (typeof record.codingSummary === "string" || Array.isArray(record.codeChanges)) {
      return normalize(record);
    }
  }
  const keyed = extractJsonObjectByKey(raw, "codingSummary");
  if (keyed && typeof keyed === "object" && keyed !== null) {
    return normalize(keyed as Record<string, unknown>);
  }
  return undefined;
}

export function mergeCodingChanges(
  reported: CodeChange[] | undefined,
  fallbacks: CodeChange[][]
): CodeChange[] {
  if (reported?.length) return reported;
  for (const group of fallbacks) {
    if (group.length) return group;
  }
  return [];
}

export function codingSummaryFromChanges(
  parsed: CodingAgentJsonOutput | undefined,
  codeChanges: CodeChange[],
  jiraKey: string
): string {
  if (parsed?.codingSummary) return parsed.codingSummary;
  if (codeChanges.length) {
    return `Ananta finished on the workspace for ${jiraKey} (${codeChanges.length} file${codeChanges.length === 1 ? "" : "s"}).`;
  }
  return "";
}
