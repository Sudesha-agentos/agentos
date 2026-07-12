export interface AgentMetadata {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
}

export interface AgentOutput<TParsed = Record<string, unknown>> {
  raw: string;
  parsed: TParsed;
  metadata: AgentMetadata;
}

export interface PrdOutput {
  title: string;
  problemStatement: string;
  proposedSolution: string;
  userStories: string[];
  acceptanceCriteria: string[];
  outOfScope: string[];
  edgeCases: string[];
  dependencies: string[];
  successMetrics: string[];
  openQuestions: string[];
  confidenceScore: number;
  confidenceReason: string;
}

export interface ImplementationComponent {
  name: string;
  description: string;
  estimatedDays: number;
}

export interface ImplementationRisk {
  description: string;
  severity: "low" | "medium" | "high";
  mitigation: string;
}

export interface CriterionMapping {
  criterion: string;
  implementation: string;
}

export interface CodeChange {
  filePath: string;
  action: "create" | "modify" | "delete";
  summary: string;
  linesChanged?: number;
}

export type ImplementationMode = "code" | "content";

export interface ImplementationOutput {
  summary: string;
  technicalApproach: string;
  components: ImplementationComponent[];
  apiChanges: string[];
  databaseChanges: string[];
  dependencies: string[];
  risks: ImplementationRisk[];
  totalEstimateDays: number;
  criteriaMapping: CriterionMapping[];
  blockers: string[];
  confidenceScore: number;
  confidenceReason: string;
  implementationMode?: ImplementationMode;
  targetFiles?: string[];
  codeChanges?: CodeChange[];
  codingSummary?: string;
}

export interface TestCaseCitation {
  /** PRD acceptance criterion (exact or normalized) */
  criterion: string;
  /** Code / API / DOM chunk this test was derived from */
  sourceRef: string;
  sourceType?: "code" | "api" | "dom" | "prd" | "other";
}

export interface TestCase {
  id: string;
  title: string;
  type: "unit" | "integration" | "e2e" | "security" | "performance";
  linkedCriterion: string;
  preconditions: string[];
  steps: string[];
  expectedResult: string;
  priority: "critical" | "high" | "medium" | "low";
  /** Required for new Neel output — cites criterion + retrieved source */
  citations?: TestCaseCitation[];
}

export interface CoverageReport {
  totalCriteria: number;
  coveredCriteria: number;
  coveragePercent: number;
  uncoveredCriteria: string[];
}

export interface QaConfidenceBreakdownItem {
  id: string;
  label: string;
  value: number;
  weight: number;
  contribution: number;
}

export interface QaOutput {
  testSummary: string;
  testCases: TestCase[];
  coverageReport: CoverageReport;
  riskAreas: string[];
  automationRecommendations: string[];
  confidenceScore: number;
  confidenceReason: string;
  /** Explainable multi-factor confidence (preferred over LLM-only score) */
  confidenceBreakdown?: {
    score: number;
    scorePercent: number;
    components: Record<string, number>;
    breakdown: QaConfidenceBreakdownItem[];
    testsNotExecuted: boolean;
  };
  /** Ranked gaps from change mapper */
  coverageGaps?: Array<{
    id: string;
    criterion: string;
    severity: string;
    reason: string;
    suggestedTestType: string;
    relatedFiles: string[];
  }>;
  /** Lightweight req → code → test edges */
  traceability?: Array<{
    requirement: string;
    codePaths: string[];
    testIds: string[];
    testFiles: string[];
    lastRunStatus?: string;
  }>;
  playwrightSmoke?: {
    attempted: boolean;
    skipped: boolean;
    skipReason?: string;
    passed: boolean;
  };
  locatorHealProposals?: Array<{
    testFile: string;
    testName: string;
    oldPrimary: string;
    proposedPrimary: string;
    confidence: number;
    requiresHumanReview: boolean;
    rationale: string;
  }>;
}
