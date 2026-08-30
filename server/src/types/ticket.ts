import type { PmPipelineContext } from "../agents/pm/pmPipelineContext";

export interface NormalizedTicket {
  jiraTicketId: string;
  jiraKey: string;
  summary: string;
  description: string;
  issueType: string;
  priority: string;
  reporter: string;
  assignee: string | null;
  labels: string[];
  epicLink: string | null;
  storyPoints: number | null;
  components: string[];
  createdAt: Date;
  projectKey: string;
  /** Populated when pipeline is started from completed PM analysis with PRD. */
  pmContext?: PmPipelineContext;
  intakeSourceKey?: string;
  parentStoryKey?: string;
  /** Structured answers to Virin discovery questions — sent to later LLM stages as JSON. */
  humanAnswers?: import("../discovery/persistedContext").HumanDiscoveryAnswer[];
  /** Frozen original ask — gates compare against this, not the drifted PRD. */
  originalTicket?: {
    summary: string;
    description: string;
    comments?: string;
  };
}

export interface IntentClassification {
  requiresPipeline: boolean;
  skipReason?: string;
  confidence?: number;
}
