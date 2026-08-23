/**
 * Full product tour: one step per major app area.
 * `target` is a data-tour key on the sidebar or page; `fallbackTarget` is used when
 * the primary element isn't rendered (e.g. collapsed sub-navigation).
 * `segment` is the org-relative route the app navigates to for that step
 * ("" = org dashboard).
 */
export const PRODUCT_TOUR_STEPS = [
  {
    id: "dashboard",
    target: "dashboard",
    segment: "",
    title: "Dashboard",
    body: "Your workspace home. Ask Virin, Ananta, or Neel, review what is waiting on you, and jump into running pipelines from the chips and stream.",
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
    title: "Virin, Product agent",
    body: "Virin analyzes each ticket step by step: finds requirement gaps, checks similar past work, and writes a PRD with testable criteria before any code is written.",
  },
  {
    id: "ananta",
    target: "ananta",
    segment: "ananta",
    title: "Ananta, Engineering agent",
    body: "Ananta codes against your real repository, maps every acceptance criterion to implementation, and opens a draft PR on a branch.",
  },
  {
    id: "codebase",
    target: "codebase",
    fallbackTarget: "ananta",
    segment: "codebase",
    title: "Ananta Brain, Codebase intelligence",
    body: "A living map of your repository. Explore the semantic graph, search code by meaning, and see what the agents know about your codebase.",
  },
  {
    id: "neel",
    target: "neel",
    segment: "qa",
    title: "Neel, QA agent",
    body: "Neel generates happy-path, edge, error, and security tests, runs them in an isolated sandbox against the pushed branch, and maps failures to criteria.",
  },
  {
    id: "costs",
    target: "costs",
    segment: "costs",
    title: "Cost & ROI",
    body: "Track what each pipeline run costs and what rework it saved. Payback and net benefit update live.",
  },
  {
    id: "integrations",
    target: "integrations",
    fallbackTarget: "settings",
    segment: "settings/integrations",
    title: "Integrations",
    body: "Connect Jira, GitHub, or Bitbucket here. That's all the agents need to start running pipelines on your tickets and repository.",
  },
  {
    id: "settings",
    target: "settings",
    segment: "settings",
    title: "Configuration",
    body: "Billing, codebase indexing, quality gates, and team settings live here alongside integrations.",
  },
  {
    id: "done",
    target: null,
    segment: "",
    title: "You're ready",
    body: "That's the whole loop: ticket in, validated PR out, humans in control at every gate. Connect Jira and your repository in Integrations to run your first pipeline.",
  },
];
