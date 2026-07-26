/** Step-by-step product docs for /docs-code — how AgentOX works end to end. */

export const DOCS_CODE_META = {
  kicker: "HOW IT WORKS",
  title: "AgentOX, explained step by step",
  intro:
    "This page is the functional map of the product: how a ticket becomes a PRD, code, tests, production signals, and Jira writeback — and which screens you use along the way.",
};

export const DOCS_CODE_TOC = [
  { id: "overview", label: "1. Big picture" },
  { id: "setup", label: "2. Setup & connect" },
  { id: "intake", label: "3. Ticket intake" },
  { id: "virin", label: "4. Virin — PRD" },
  { id: "ananta", label: "5. Ananta — code & push" },
  { id: "neel", label: "6. Neel — QA" },
  { id: "canary", label: "7. Canary" },
  { id: "logs", label: "8. Log Intelligence" },
  { id: "writeback", label: "9. Jira & GitHub writeback" },
  { id: "surfaces", label: "10. App surfaces" },
  { id: "gates", label: "11. Validation gates" },
];

export const DOCS_CODE_SECTIONS = [
  {
    id: "overview",
    title: "1. Big picture",
    paragraphs: [
      "AgentOX is a multi-agent SDLC pipeline. A Jira ticket enters the system; Virin (product) discovers and writes a PRD; Ananta (engineering) plans and implements against your real repo; Neel (QA) generates and runs tests; Canary probes live environments; Log Intelligence correlates production errors back to the pipeline that shipped the change.",
      "Between stages, validation gates score confidence and can pause for human review. Structured outputs are written back to Jira and GitHub (comments, PR, status).",
    ],
    steps: [
      {
        title: "Input",
        body: "Jira issue in your configured AI Worker column (or manual engineering handoff from Virin).",
      },
      {
        title: "Agents",
        body: "Virin → Ananta → Neel, with optional Canary and continuous Log Intelligence.",
      },
      {
        title: "Output",
        body: "PRD on the ticket, branch + draft PR, QA report, RCA summary, status transition when configured.",
      },
    ],
  },
  {
    id: "setup",
    title: "2. Setup & connect",
    paragraphs: [
      "Before the pipeline can run, your organization needs identity, Jira, and Git credentials.",
    ],
    steps: [
      {
        title: "Sign in",
        body: "Create an account or use Google sign-in. You land in onboarding if the org is not finished yet.",
      },
      {
        title: "Organization",
        body: "Onboarding creates or joins an org (slug becomes your app URL: /{orgSlug}/…). All tickets, pipelines, and log sources are org-scoped.",
      },
      {
        title: "Connect Jira",
        body: "Settings → Integrations → Jira. OAuth or API token. Map the intake column (“AI Worker”), completion status (e.g. Done), and comment writeback toggles.",
      },
      {
        title: "Connect GitHub",
        body: "Settings → Integrations → GitHub. Install the app / PAT for the target repo. Codebase indexing and Ananta’s workspace clone use this connection.",
      },
      {
        title: "Optional ops env",
        body: "On the API host: FRONTEND_URL=https://agentox.io, LOG_INGESTION_ENABLED=1 for logs, OSS tools for Semgrep/Playwright on QA.",
      },
    ],
  },
  {
    id: "intake",
    title: "3. Ticket intake",
    paragraphs: [
      "Intake is how work enters the queue. The system prefers webhooks; polling is a fallback.",
    ],
    steps: [
      {
        title: "Webhook",
        body: "When an issue is created or moves into the mapped intake status, Jira calls AgentOX. Org credentials are resolved; the ticket is normalized and enqueued.",
      },
      {
        title: "Dedup & queue",
        body: "Duplicate in-flight keys are soft-skipped. Active pipelines run; others wait FIFO.",
      },
      {
        title: "Manual path",
        body: "From Virin, “Start engineering handoff” enqueues the classic pipeline with the generated PRD attached as PM context.",
      },
      {
        title: "Where to watch",
        body: "Open Pipelines in the app for live stage status, audit events, and pause/resume.",
      },
    ],
  },
  {
    id: "virin",
    title: "4. Virin — Product / PRD",
    paragraphs: [
      "Virin turns a raw ticket into a buildable PRD: discovery, gap analysis, acceptance criteria, edge cases, out of scope, and confidence scoring.",
    ],
    steps: [
      {
        title: "Discovery & enrichment",
        body: "Reads the ticket, retrieves similar past PRDs / codebase context, flags ambiguities and open questions.",
      },
      {
        title: "PRD generation",
        body: "Produces user stories, Given/When/Then criteria, NFRs, success metrics, and (when content mode) deliverable file paths.",
      },
      {
        title: "Quality gate",
        body: "PRD validation refuses thin or untestable specs. Thin criteria are not padded with fake ACs — the gate fails instead.",
      },
      {
        title: "Handoff package",
        body: "PM context (system design, task breakdown, affected files, where-not-to-touch) is stored for Ananta. Code snapshots and recent commits are attached when Git is available.",
      },
      {
        title: "UI",
        body: "Use PM Agents / Virin workspace to review analysis, PRD, and trigger engineering handoff.",
      },
    ],
  },
  {
    id: "ananta",
    title: "5. Ananta — Engineering (code & push)",
    paragraphs: [
      "Ananta implements the authoritative PRD against your repo: explore → edit → verify → summarize, then the orchestrator commits and pushes.",
    ],
    steps: [
      {
        title: "Context load",
        body: "Receives full PRD (stories, ACs, edge cases, out of scope, NFRs), implementation plan, verified paths, and PM handoff. Codebase intelligence (embeddings / graph) enriches retrieval.",
      },
      {
        title: "Coding loop",
        body: "Tools: list_dir, grep, read_file, edit_file, apply_aider_edits, write_file, run_command. Must mutate real files before finishing. Scope must match the PRD — not a shrunk MVP.",
      },
      {
        title: "Safety compile",
        body: "Optional typecheck/lint in the workspace. Failures still push but commit message is prefixed [compile-warnings].",
      },
      {
        title: "Commit & push",
        body: "Local git workspace: commit on agentos/<JIRA-KEY> (or configured target), push upstream. Fallback Git Data API path also opens a PR when possible.",
      },
      {
        title: "Pull request",
        body: "Draft PR titled with Jira key + PRD title. Branch state (PR number, SHA) is persisted for later QA PR updates.",
      },
      {
        title: "UI",
        body: "Ananta workspace / engineering views show coding events; Pipeline detail shows the engineering stage log.",
      },
    ],
  },
  {
    id: "neel",
    title: "6. Neel — QA",
    paragraphs: [
      "Neel clones the implementation branch, plans tests against acceptance criteria, runs sandbox/OSS suites, and produces an explainable recommendation.",
    ],
    steps: [
      {
        title: "Branch resolution",
        body: "Uses the branch Ananta pushed (with audit/env fallbacks) so QA tests the code that was shipped.",
      },
      {
        title: "Agent tools",
        body: "Generate test cases, run_tests, run_security_scan, produce QA report JSON mapped to criteria.",
      },
      {
        title: "Mandatory OSS suite",
        body: "Every ticket: Semgrep, Playwright, Cover-Agent, Hypothesis (host CLIs). Results are bridged into the pipeline report even if the LLM skipped tool calls.",
      },
      {
        title: "QA Center UI",
        body: "Workspace: ticket queue + report sections (Summary, Tests, Security & smoke, Gaps, OSS tools). Fleet: coverage/heatmap. Canary tab for live probes.",
      },
      {
        title: "Recommendation",
        body: "approve / approve_with_conditions / request_changes / block — with confidence breakdown and human-override flags when needed.",
      },
    ],
  },
  {
    id: "canary",
    title: "7. Canary — live adversarial probes",
    paragraphs: [
      "Canary runs after QA (or on demand) against a staging URL: hypotheses, HTTP probes, synthesis of findings, optional Playwright monitor / ZAP / Locust adapters.",
    ],
    steps: [
      {
        title: "Trigger",
        body: "Pipeline-driven after Neel, or “Run now” from QA Center → Canary.",
      },
      {
        title: "Phases",
        body: "Reconnaissance → hypotheses → exploration → synthesis → completed/failed (live SSE updates while a pipeline is selected).",
      },
      {
        title: "Feedback loop",
        body: "Critical findings can feed back into intelligence and ticket creation policies when configured.",
      },
    ],
  },
  {
    id: "logs",
    title: "8. Log Intelligence — link customer log systems",
    paragraphs: [
      "Production errors are ingested, fingerprinted, correlated to pipelines/Jira keys, and analysed for root cause and QA gaps.",
      "“Linking” means configuring a source that actually pulls or receives logs into AgentOX’s normalized schema — not only a deep link out.",
    ],
    steps: [
      {
        title: "Enable",
        body: "API env: LOG_INGESTION_ENABLED=1 and LOG_SOURCE_ENCRYPTION_KEY. Open /{org}/logs → Sources.",
      },
      {
        title: "First-class providers",
        body: "Guided forms for Render, Sentry, Datadog, CloudWatch, Grafana Loki, Railway. Test connection fetches sample lines; Save & link; Pull now for immediate fetch.",
      },
      {
        title: "Any other system",
        body: "OTLP or Custom (Vector/HTTP) push sources. After save, copy ingest URLs that include sourceId and organizationId.",
      },
      {
        title: "Health",
        body: "Each source shows Healthy / Error / Never pulled / Push only, plus lastError when a pull fails.",
      },
      {
        title: "Patterns & RCA",
        body: "Open patterns list errors; detail view runs acknowledge, resolve, and AI root-cause analysis correlated to pipelines.",
      },
    ],
  },
  {
    id: "writeback",
    title: "9. Jira & GitHub writeback",
    paragraphs: [
      "The pipeline closes the loop on the tools your team already uses.",
    ],
    steps: [
      {
        title: "After Ananta push",
        body: "Jira comment with branch, commit SHA, and PR link (when PR opened). Engineering plan comment (idempotent via label).",
      },
      {
        title: "After Neel",
        body: "QA report comment + labels. GitHub PR body updated with coverage/recommendation; draft marked ready via GraphQL when QA passes.",
      },
      {
        title: "Output stage",
        body: "Optional description update, RCA comment (idempotent), story points when configured, transition to completion status (e.g. Done).",
      },
      {
        title: "Formatting",
        body: "Comments are converted to Jira ADF (headings/lists/bold) so wiki/markdown is not shown as raw text.",
      },
    ],
  },
  {
    id: "surfaces",
    title: "10. App surfaces (where to click)",
    paragraphs: [
      "After login you work under /{orgSlug}/…",
    ],
    steps: [
      {
        title: "Pipelines",
        body: "Queue, stage timeline, resume/override when a gate pauses.",
      },
      {
        title: "PM Agents / Virin",
        body: "Discovery runs, PRD review, engineering handoff.",
      },
      {
        title: "Ananta",
        body: "Live coding status and engineering artifacts for the active ticket.",
      },
      {
        title: "QA (Neel)",
        body: "Inbox, full report workspace, fleet health, Canary.",
      },
      {
        title: "Logs",
        body: "Patterns, anomalies, Sources linking.",
      },
      {
        title: "Codebase",
        body: "Index status and semantic search over the connected repo.",
      },
      {
        title: "Settings",
        body: "Jira, GitHub, company profile, completion/writeback toggles.",
      },
    ],
  },
  {
    id: "gates",
    title: "11. Validation gates (why work pauses)",
    paragraphs: [
      "Gates exist so bad specs or incomplete implementations do not silently ship.",
    ],
    steps: [
      {
        title: "PRD gate",
        body: "Structural + testability checks. Low confidence can require human review before engineering.",
      },
      {
        title: "Implementation gate",
        body: "Criteria coverage / blockers. “Continue to Neel” resumes when you accept the handoff.",
      },
      {
        title: "QA gate",
        body: "Coverage %, failures, security criticals, human override for low-confidence triage.",
      },
      {
        title: "Override",
        body: "Pipeline override UI exists for operators when a gate is wrong or stuck — use deliberately.",
      },
    ],
  },
];
