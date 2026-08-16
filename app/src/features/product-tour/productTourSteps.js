/**
 * Full product tour — one step per major app area.
 * `target` is a data-tour key on the sidebar; `fallbackTarget` is used when the
 * primary element isn't rendered (e.g. collapsed sub-navigation).
 * `segment` is the org-relative route the app navigates to for that step
 * ("" = org dashboard).
 */
export const PRODUCT_TOUR_STEPS = [
  {
    id: "dashboard",
    target: "dashboard",
    segment: "",
    title: "Dashboard",
    body: "Your mission control. See every pipeline at a glance — what the agents are working on, what's waiting for your review, and what shipped.",
  },
  {
    id: "pipelines",
    target: "pipelines",
    segment: "pipelines",
    title: "Pipelines",
    body: "Every ticket that enters AgentOX becomes a pipeline. Track active runs, approve items in the Review Queue, and browse history.",
  },
  {
    id: "virin",
    target: "virin",
    segment: "pm-agents",
    title: "Virin — Product agent",
    body: "Virin analyzes each ticket step by step: finds requirement gaps, checks similar past work, and writes a PRD with testable criteria before any code is written.",
  },
  {
    id: "ananta",
    target: "ananta",
    segment: "ananta",
    title: "Ananta — Engineering agent",
    body: "Ananta codes against your real repository, maps every acceptance criterion to implementation, and opens a draft PR on a branch.",
  },
  {
    id: "codebase",
    target: "codebase",
    fallbackTarget: "ananta",
    segment: "codebase",
    title: "Ananta Brain — Codebase intelligence",
    body: "A living map of your repository. Explore the semantic graph, search code by meaning, and see what the agents know about your codebase.",
  },
  {
    id: "neel",
    target: "neel",
    segment: "qa",
    title: "Neel — QA agent",
    body: "Neel generates happy-path, edge, error, and security tests, runs them in an isolated sandbox against the pushed branch, and maps failures to criteria.",
  },
  {
    id: "costs",
    target: "costs",
    segment: "costs",
    title: "Cost & ROI",
    body: "Track what each pipeline run costs and what rework it saved — payback and net benefit, updated live.",
  },
  {
    id: "logs",
    target: "logs",
    segment: "logs",
    title: "Log Intelligence",
    body: "Production signals in one place. Surface anomalies from your logs and route them back into the pipeline as tickets.",
  },
  {
    id: "settings",
    target: "settings",
    segment: "settings",
    title: "Configuration & integrations",
    body: "Connect Jira and GitHub or Bitbucket here — that's all the agents need to start. Billing, indexing, and quality gates live here too.",
  },
  {
    id: "audit",
    target: "audit",
    segment: "audit",
    title: "Audit Trail",
    body: "Every agent action is recorded: which ticket triggered it, which gates passed, and who approved. Compliance-ready provenance.",
  },
  {
    id: "done",
    target: null,
    segment: "",
    title: "You're ready",
    body: "That's the whole loop: ticket in, validated PR out, humans in control at every gate. Connect Jira and your repository in Configuration to run your first pipeline.",
  },
];
