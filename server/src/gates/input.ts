import type { GeneratedPRD } from "../prd/prdGenerator";
import type { PmAnalysisRecord } from "../agents/pm/types";
import type { QaExecutionReport } from "../qa/report/reportGenerator";
import type {
  ImplementationOutput,
  PrdOutput,
  QaOutput,
} from "../types/agents";
import type { NormalizedTicket } from "../types/ticket";
import type { OriginalTicketEvidence } from "./originalTicket";
import type { DiffUnit } from "./diffQuality/parseDiff";

export interface DuplicateSearchHit {
  filePath: string;
  similarity: number;
  snippet?: string;
}

export type DuplicateSearcher = (
  query: string
) => Promise<DuplicateSearchHit[]>;

export interface GateInput {
  prd?: PrdOutput;
  generatedPrd?: GeneratedPRD;
  implementation?: ImplementationOutput;
  qa?: QaOutput;
  qaExecutionReport?: QaExecutionReport;
  ticket?: OriginalTicketEvidence;
  normalizedTicket?: NormalizedTicket;
  pmRecord?: PmAnalysisRecord;
  virinMode?: "interactive" | "auto";
  implementationMode?: "code" | "content";
  targetFiles?: string[];
  prdSource?: "discovery" | "pm_agents";
  workspaceDiff?: string;
  changedFiles?: Array<{ path: string; status?: string }>;
  diffUnits?: DiffUnit[];
  canaryCriticals?: Array<{ title: string; description: string }>;
  canarySkipped?: boolean;
  canarySkipReason?: string;
  ticketText?: string;
  duplicateSearcher?: DuplicateSearcher;
}
