/** Founder-level product + OSS architecture docs for /docs-code. */

export const DOCS_CODE_META = {
  kicker: "ARCHITECTURE · HOW IT WORKS",
  title: "AgentOX architecture map for founders",
  intro:
    "Everything a founder needs: the multi-agent SDLC pipeline, every open-source tool we run or vendor, when it fires, what artifact it leaves, and the honest gaps between marketing claims and runtime truth.",
};

export const DOCS_CODE_TOC = [
  { id: "overview", label: "1. Big picture" },
  { id: "stack", label: "2. Core stack" },
  { id: "arch-map", label: "3. Architecture map" },
  { id: "timing", label: "4. When tools run" },
  { id: "setup", label: "5. Setup & connect" },
  { id: "intake", label: "6. Ticket intake" },
  { id: "virin", label: "7. Virin — PRD" },
  { id: "ananta", label: "8. Ananta — code" },
  { id: "neel", label: "9. Neel — QA" },
  { id: "canary", label: "10. Canary" },
  { id: "logs", label: "11. Log Intelligence" },
  { id: "oss-catalog", label: "12. OSS tool catalog" },
  { id: "honesty", label: "13. Honest gaps" },
  { id: "writeback", label: "14. Jira & GitHub" },
  { id: "surfaces", label: "15. App surfaces" },
  { id: "gates", label: "16. Validation gates" },
  { id: "ops", label: "17. Ops & host requirements" },
];

export const DOCS_CODE_SECTIONS = [
  {
    id: "overview",
    title: "1. Big picture",
    paragraphs: [
      "AgentOX is a multi-agent SDLC platform. A Jira ticket enters; Virin writes a PRD; Ananta implements against your real repo; Neel runs tests and security; Canary probes staging; Log Intelligence correlates production errors back to the pipeline that shipped the change.",
      "Open-source tools are not decoration. They run as adapters that always attempt work and persist ToolArtifact rows (memory + optional disk). Missing CLIs soft-skip in dev or fail hard when OSS_TOOLS_REQUIRED=1.",
      "Between stages, validation gates score confidence and can pause for human review. Structured outputs write back to Jira and GitHub.",
    ],
    steps: [
      {
        title: "Input",
        body: "Jira issue in the AI Worker column, or manual engineering handoff from Virin with PRD attached.",
      },
      {
        title: "Agents",
        body: "Virin → Ananta → Neel, plus optional Canary and continuous Log Intelligence.",
      },
      {
        title: "OSS spine",
        body: "Index-time: Tree-sitter + embeddings + GitNexus-shaped graph. Per-ticket engineering: Tree-sitter symbols + Aider editblocks. QA: Semgrep, Playwright, Cover-Agent, Hypothesis. Canary: Playwright monitor, ZAP, Locust.",
      },
      {
        title: "Output",
        body: "PRD on the ticket, branch + draft PR, QA report with bridged OSS fields, RCA, status transition when configured.",
      },
    ],
  },
  {
    id: "stack",
    title: "2. Core product stack",
    paragraphs: [
      "Before the OSS catalog: the runtime AgentOX owns end-to-end.",
    ],
    stack: [
      {
        layer: "Frontend",
        items:
          "React app (Vite), org-scoped routes under /{orgSlug}/…, marketing at agentox.io, QA Center, Log Intelligence Sources, Pipelines, Virin / Ananta / Neel workspaces.",
      },
      {
        layer: "API",
        items:
          "Express TypeScript server, Prisma → Postgres, org context, Jira/GitHub OAuth + webhooks, pipeline orchestrator, agentic loops with OpenAI function calling.",
      },
      {
        layer: "Agents",
        items:
          "Virin (PM/PRD), Ananta (engineering coding loop), Neel (QA agent + mandatory OSS suite), Canary (hypotheses + live probes). LLM stack is OpenAI (gpt-5.x family); Anthropic SDK may exist as unused shim.",
      },
      {
        layer: "Intelligence",
        items:
          "Codebase index (files + AI summaries), semantic chunks via Tree-sitter, embeddings in Supabase pgvector (codebase_embeddings), GitNexus-shaped knowledge graph via Graphology Louvain, RAG over tickets/PRDs.",
      },
      {
        layer: "Persistence of tool runs",
        items:
          "ToolArtifact store (in-memory Map + data/tool-artifacts/). Bridged into QA report fields (securityScan, playwrightSmoke) so the UI never depends solely on the LLM calling tools.",
      },
    ],
  },
  {
    id: "arch-map",
    title: "3. Architecture map",
    paragraphs: [
      "One composition from ticket to production signal. Each arrow is a real handoff in the orchestrator — not a slide-deck metaphor.",
    ],
    mapRows: [
      {
        from: "Jira issue",
        via: "Webhook / poll → ticket normalizer → FIFO queue",
        to: "Pipeline run",
      },
      {
        from: "Virin",
        via: "Discovery → PRD gate → PM handoff package (+ code snapshots)",
        to: "Ananta context",
      },
      {
        from: "Repo index",
        via: "GitHub fetch → Tree-sitter chunks → embeddings → graph bridge",
        to: "Retrieval for agents",
      },
      {
        from: "Ananta",
        via: "ACI tools + Aider SEARCH/REPLACE → commit/push → draft PR",
        to: "Engineering artifacts",
      },
      {
        from: "Neel",
        via: "QA agent + Semgrep/Playwright/Cover-Agent/Hypothesis → bridge artifacts",
        to: "QA Center report",
      },
      {
        from: "Canary",
        via: "Hypotheses → HTTP probes → Playwright / ZAP / Locust",
        to: "Live findings + optional tickets",
      },
      {
        from: "Customer logs",
        via: "Pull adapters or OTLP/Vector push → fingerprint → correlate",
        to: "RCA ↔ pipeline / Jira key",
      },
      {
        from: "Writeback",
        via: "Jira ADF comments + labels; GitHub PR body + undraft",
        to: "Team tools of record",
      },
    ],
    callouts: [
      {
        tone: "info",
        title: "Index-time vs per-ticket",
        body: "GitNexus graph + embeddings build when you index/re-index a repo — not on every Jira ticket. Per-ticket engineering only remaps symbols on changed files. Confusing those two is the #1 architecture mistake.",
      },
    ],
  },
  {
    id: "timing",
    title: "4. When every tool runs",
    paragraphs: [
      "Founders should memorize this table. It is the operational contract between product surface and host binaries.",
    ],
    phases: [
      {
        name: "Index-time",
        when: "GitHub connect / re-index / analyze",
        tools: "Tree-sitter AST chunking, OpenAI embeddings → Supabase pgvector, GitNexus-shaped graph (Graphology Louvain bridge)",
        surface: "Codebase page, semantic search, agent retrieval",
      },
      {
        name: "Engineering (per ticket)",
        when: "After Ananta coding loop completes",
        tools: "Tree-sitter symbol map of changed files, Aider capability artifact, mini-SWE/ACI note (prompt influence, not Python runtime)",
        surface: "Ananta ToolArtifactsPanel · lane=engineering",
      },
      {
        name: "QA (per ticket)",
        when: "After Neel agent loop; also forced via runQaOssAdapters",
        tools: "Semgrep, Playwright smoke or vendored monitor, Cover-Agent, Hypothesis/pytest",
        surface: "QA Center · Security & smoke · OSS tools · lane=qa",
      },
      {
        name: "Canary",
        when: "After QA or Run now against staging URL",
        tools: "Playwright monitor → ZAP baseline → Locust load",
        surface: "QA Center → Canary tab · live SSE",
      },
      {
        name: "Continuous",
        when: "Webhook push / scheduled pull / OTLP ingest",
        tools: "Provider adapters (Render, Sentry, Datadog, CloudWatch, Loki, Railway) + OTLP + Vector/HTTP custom",
        surface: "Logs → Sources / Patterns / RCA",
      },
    ],
  },
  {
    id: "setup",
    title: "5. Setup & connect",
    paragraphs: [
      "Pipeline work requires identity, Jira, Git, and (for real OSS) a host with RAM and CLIs.",
    ],
    steps: [
      {
        title: "Sign in",
        body: "Account or Google OAuth. FRONTEND_URL must be https://agentox.io in production so post-login redirects are not stuck on legacy Vercel hosts.",
      },
      {
        title: "Organization",
        body: "Onboarding creates/joins an org; slug becomes /{orgSlug}/…. Tickets, pipelines, and log sources are org-scoped.",
      },
      {
        title: "Jira",
        body: "Settings → Integrations. Map AI Worker intake column, Done/completion status, comment writeback toggles.",
      },
      {
        title: "GitHub",
        body: "App install or PAT. Indexing and Ananta workspace clone use this connection.",
      },
      {
        title: "API ops env",
        body: "FRONTEND_URL, LOG_INGESTION_ENABLED, LOG_SOURCE_ENCRYPTION_KEY, OSS_TOOLS_REQUIRED, optional CODEBASE_GITNEXUS_GRAPH (commercial rights pending for production).",
      },
    ],
  },
  {
    id: "intake",
    title: "6. Ticket intake",
    paragraphs: [
      "Webhooks preferred; polling is fallback. Dedup soft-skips duplicate in-flight keys.",
    ],
    steps: [
      {
        title: "Webhook",
        body: "Issue created or moved into intake status → normalize → enqueue.",
      },
      {
        title: "Queue",
        body: "Active pipelines run; others wait FIFO. Watch Pipelines for stage status and audit events.",
      },
      {
        title: "Manual handoff",
        body: "Virin “Start engineering handoff” enqueues classic pipeline with PRD as PM context.",
      },
    ],
  },
  {
    id: "virin",
    title: "7. Virin — Product / PRD",
    paragraphs: [
      "Virin turns a raw ticket into a buildable PRD. It is LLM-native; OSS here is retrieval (similar PRDs, codebase hits), not Semgrep.",
    ],
    steps: [
      {
        title: "Discovery",
        body: "Ticket + similar past PRDs / codebase context; ambiguities flagged.",
      },
      {
        title: "PRD generation",
        body: "Stories, Given/When/Then ACs, edge cases, OOS, NFRs, metrics. Thin criteria are not padded with fake ACs — the gate fails.",
      },
      {
        title: "Handoff",
        body: "Full PRD + system design + task breakdown + affected files + code snapshots / recent commits for Ananta.",
      },
    ],
  },
  {
    id: "ananta",
    title: "8. Ananta — Engineering",
    paragraphs: [
      "Ananta implements the authoritative PRD: explore → edit → verify → summarize. The orchestrator then commits and pushes.",
      "The coding loop is a TypeScript re-implementation of mini-SWE-style ACI (agent-computer interface) over OpenAI tools — the vendored Python mini-swe-agent is not executed.",
    ],
    steps: [
      {
        title: "Context",
        body: "Full PRD (not a shrunk summary), plan, verified paths, embeddings/graph retrieval.",
      },
      {
        title: "Tools",
        body: "list_dir, grep, read_file, edit_file, apply_aider_edits (SEARCH/REPLACE port of Aider), write_file, run_command, get_file_symbols.",
      },
      {
        title: "Post-coding OSS",
        body: "runEngineeringOssAdapters: Tree-sitter symbol map of changed files + Aider capability artifact + ACI note.",
      },
      {
        title: "Push",
        body: "Branch agentos/<JIRA-KEY>, commit (optional [compile-warnings]), push, draft PR, persist branch state for QA.",
      },
    ],
  },
  {
    id: "neel",
    title: "9. Neel — QA",
    paragraphs: [
      "Neel clones the implementation branch, plans against ACs, runs sandbox + mandatory OSS, bridges ToolArtifacts into the pipeline report so Semgrep/Playwright show even if the LLM skipped tool calls.",
    ],
    steps: [
      {
        title: "Branch",
        body: "Resolves Ananta’s pushed branch (with audit/env fallbacks).",
      },
      {
        title: "Agent tools",
        body: "Generate cases, run_tests, run_security_scan, produce explainable QA JSON.",
      },
      {
        title: "Mandatory suite",
        body: "Semgrep → Playwright (repo @smoke or vendored monitor) → Cover-Agent on ≤2 changed sources → Hypothesis. Kill switch: QA_OSS_ADAPTERS=0.",
      },
      {
        title: "UI",
        body: "QA Center master–detail: queue, Summary / Tests / Security & smoke / Gaps / OSS tools, Fleet, Canary.",
      },
    ],
  },
  {
    id: "canary",
    title: "10. Canary — live probes",
    paragraphs: [
      "Canary is adversarial exploration against a staging base URL, then a fixed OSS order: Playwright monitor → ZAP → Locust.",
    ],
    steps: [
      {
        title: "Phases",
        body: "Reconnaissance → hypotheses → exploration → synthesis (SSE while pipeline selected).",
      },
      {
        title: "OSS order",
        body: "Synthetic browser monitor, OWASP ZAP baseline (local or Docker image), Locust with vendored locustfile. Kill switch: CANARY_OSS_ADAPTERS=0.",
      },
      {
        title: "Feedback",
        body: "Critical findings can create tickets / feed intelligence when policies are on.",
      },
    ],
  },
  {
    id: "logs",
    title: "11. Log Intelligence",
    paragraphs: [
      "“Linking” means real pull or push into AgentOX’s normalized schema — not a deep-link out to Datadog.",
    ],
    steps: [
      {
        title: "Enable",
        body: "LOG_INGESTION_ENABLED=1 + LOG_SOURCE_ENCRYPTION_KEY. UI: /{org}/logs → Sources.",
      },
      {
        title: "First-class pull",
        body: "Render, Sentry, Datadog, CloudWatch, Loki, Railway — Test connection, Save & link, Pull now, health badges.",
      },
      {
        title: "Universal push",
        body: "OTLP and Custom/Vector HTTP sinks with sourceId + organizationId query params.",
      },
      {
        title: "Intelligence",
        body: "Fingerprint → patterns → anomalies → deployment/pipeline/criteria correlators → AI RCA.",
      },
    ],
  },
  {
    id: "oss-catalog",
    title: "12. Open-source tool catalog",
    paragraphs: [
      "Every tool AgentOX touches. Status is runtime truth: Executed means the binary or in-process port runs; Inspired means design influence only; Gated means env/commercial flag; Vendored reference means source sits in tree for upgrade path.",
    ],
    tools: [
      {
        name: "Tree-sitter",
        upstream: "tree-sitter + language grammars (npm)",
        phase: "Index-time + Engineering",
        mode: "In-process",
        status: "executed",
        paths: "server/src/codebaseIntelligence/astChunker.ts · runEngineeringOssAdapters",
        produces: "Semantic chunks, symbol findings on changed files",
        howUsed:
          "Cursor-style AST spans for embeddings and Mentat-style structure maps after coding. Grammars for TS/JS/Python/Go/JSON and optional Ruby/Java/etc.",
        gaps: "Binary/non-parseable files fall back; empty change sets yield an empty-but-completed artifact.",
      },
      {
        name: "Aider (editblock)",
        upstream: "Aider-AI/aider (Apache-2.0) — SEARCH/REPLACE algorithm",
        phase: "Engineering (live tool + post-suite)",
        mode: "In-process TS port",
        status: "executed",
        paths: "server/vendor/aider · integrations/aider/editblock.ts · apply_aider_edits tool",
        produces: "Applied patches; capability ToolArtifact",
        howUsed:
          "Whitespace-tolerant SEARCH/REPLACE matching ported from editblock_coder.py. Ananta applies patches without shelling to Python Aider.",
        gaps: "Fuzzy edit-distance fallback from upstream omitted by design.",
      },
      {
        name: "mini-SWE-agent",
        upstream: "SWE-agent / mini-swe-agent YAMLs",
        phase: "Engineering (design)",
        mode: "Vendored prompts",
        status: "inspired",
        paths: "server/vendor/mini-swe-agent · Ananta tool surface",
        produces: "ACI-shaped tool list artifact (informational)",
        howUsed:
          "Shapes bash-style tools (list_dir, grep, edit_file…). AgentOX re-implements the loop in TypeScript via OpenAI function calling.",
        gaps: "Python mini-SWE runtime is never invoked. Do not claim “runs mini-SWE”.",
      },
      {
        name: "GitNexus (bridge)",
        upstream: "abhigyanpatwari/GitNexus (PolyForm Noncommercial)",
        phase: "Index-time",
        mode: "AgentOX bridge",
        status: "gated",
        paths: "server/src/codebaseIntelligence/gitnexus/* · vendor/gitnexus*",
        produces: "Knowledge graph (symbols, relations, Louvain clusters)",
        howUsed:
          "After file/embedding index, buildKnowledgeGraphFromIndexedFiles uses Tree-sitter + Graphology Louvain to produce a GitNexus-shaped graph for retrieval/wiki tools.",
        gaps: "CODEBASE_GITNEXUS_GRAPH must be on. Native Ladybug run-analyze (vendor) is NOT enabled; commercial rights PENDING for SaaS. See vendor/COMMERCIAL.md.",
      },
      {
        name: "Graphology + Louvain",
        upstream: "graphology / graphology-communities-louvain",
        phase: "Index-time (with GitNexus bridge)",
        mode: "In-process",
        status: "executed",
        paths: "gitnexus/graphBuilder.ts",
        produces: "Community clusters on import/symbol graph",
        howUsed: "Same family of clustering GitNexus uses; runs entirely in AgentOX Node process.",
        gaps: "Depends on indexed CodebaseFile rows — garbage in, garbage out if index incomplete.",
      },
      {
        name: "pgvector (Supabase)",
        upstream: "pgvector via Supabase codebase_embeddings",
        phase: "Index-time + retrieval",
        mode: "External DB",
        status: "executed",
        paths: "codebaseIntelligence/vectorStore.ts · rag/*",
        produces: "Embedding rows for semantic search",
        howUsed: "OpenAI embeddings written outside Prisma schema; agents query similar code/tickets.",
        gaps: "If table missing, semantic search soft-skips with logged warning — index “succeeds” without vectors.",
      },
      {
        name: "Semgrep",
        upstream: "semgrep CLI (pip)",
        phase: "QA",
        mode: "Shell-out",
        status: "executed",
        paths: "integrations/semgrep/runSemgrep.ts · qa securityScanner",
        produces: "ToolArtifact findings → bridged securityScan",
        howUsed: "Mandatory QA adapter; scans workspace; soft-skip or fail per OSS_TOOLS_REQUIRED.",
        gaps: "Needs host install + RAM. Soft-skip looks “green” if you do not check artifact status.",
      },
      {
        name: "Playwright",
        upstream: "Microsoft Playwright / @playwright/test",
        phase: "QA + Canary",
        mode: "Shell-out",
        status: "executed",
        paths: "qa/testing/playwrightSmoke.ts · vendor/playwright-monitor · runPlaywrightMonitor",
        produces: "Smoke/monitor ToolArtifact → playwrightSmoke on report",
        howUsed:
          "QA: repo playwright.config @smoke first; else vendored monitor against base URL. Canary: always monitor against staging.",
        gaps: "Chromium + RAM heavy on 512MB hosts. Missing config falls back to monitor, not a silent pass.",
      },
      {
        name: "Cover-Agent",
        upstream: "CodiumAI / cover-agent (AGPL-3.0)",
        phase: "QA",
        mode: "Shell-out",
        status: "executed",
        paths: "integrations/coverAgent/runCoverAgent.ts",
        produces: "Coverage-oriented ToolArtifact",
        howUsed:
          "Up to 2 changed sources; may write minimal test stubs; runs cover-agent with vitest/pytest coverage commands.",
        gaps: "Needs its own LLM API key on the host — not bridged through AgentOX OpenAI client. AGPL obligations if you redistribute the CLI.",
      },
      {
        name: "Hypothesis",
        upstream: "Hypothesis (property-based testing) + pytest",
        phase: "QA",
        mode: "Shell-out",
        status: "executed",
        paths: "integrations/hypothesis/runHypothesis.ts",
        produces: "ToolArtifact with pass/fail/skip",
        howUsed: "Runs pytest/Hypothesis suite in workspace when present; soft-skips if missing.",
        gaps: "JS-only repos often skip — artifact status must be read, not assumed.",
      },
      {
        name: "OWASP ZAP",
        upstream: "zaproxy (zap-baseline.py or Docker ghcr.io/zaproxy/zaproxy:stable)",
        phase: "Canary",
        mode: "Shell-out / Docker",
        status: "executed",
        paths: "integrations/zap/runZap.ts",
        produces: "Baseline scan ToolArtifact",
        howUsed: "Second step in Canary OSS suite against targetUrl.",
        gaps: "Node-only Render without Docker effectively always skips/fails. Prefer Docker image on capable hosts.",
      },
      {
        name: "Locust",
        upstream: "locust.io",
        phase: "Canary",
        mode: "Shell-out",
        status: "executed",
        paths: "integrations/locust/runLocust.ts · vendor/locust/locustfile.py",
        produces: "Load ToolArtifact",
        howUsed: "Short load run (default ~5 users / 30s) against staging host.",
        gaps: "Not a full capacity test — smoke-level load signal only.",
      },
      {
        name: "OpenTelemetry (OTLP) + Vector",
        upstream: "OTLP HTTP + Vector remux patterns",
        phase: "Continuous logs",
        mode: "Ingest adapters",
        status: "executed",
        paths: "logIntelligence/adapters/otlpAdapter.ts · ingestion/vectorAdapter.ts",
        produces: "Normalized log entries",
        howUsed: "Universal “any other system” path when first-class pull adapters do not fit.",
        gaps: "Requires LOG_INGESTION_ENABLED and a saved push source with IDs in the URL.",
      },
      {
        name: "Provider log adapters",
        upstream: "Vendor APIs (Render, Sentry, Datadog, CloudWatch, Loki, Railway)",
        phase: "Continuous logs",
        mode: "Pull adapters",
        status: "executed",
        paths: "logIntelligence/adapters/* · adapterCatalog.ts",
        produces: "Normalized entries + source health",
        howUsed: "Guided UI: validate → save encrypted secrets → Pull now / webhook.",
        gaps: "Credentials encrypted at rest; wrong scopes show as health Error, not silent success.",
      },
      {
        name: "Prisma + Express + React",
        upstream: "prisma.io · expressjs · react",
        phase: "Always",
        mode: "Product core",
        status: "executed",
        paths: "server/ · app/",
        produces: "API, schema, UI",
        howUsed: "Canonical product runtime. Embeddings table lives in Supabase alongside Prisma Postgres usage.",
        gaps: "None — this is the product.",
      },
    ],
  },
  {
    id: "honesty",
    title: "13. Honest gaps (founder truth)",
    paragraphs: [
      "Investors and technical cofounders will ask these. Answer with the same wording the code uses.",
    ],
    callouts: [
      {
        tone: "critical",
        title: "mini-SWE is inspiration, not a subprocess",
        body: "vendor/mini-swe-agent informs tool design. The Python agent never runs. Claiming otherwise is a diligence miss.",
      },
      {
        tone: "critical",
        title: "GitNexus native Ladybug is not on",
        body: "Production path is AgentOX’s Tree-sitter + Graphology bridge. CODEBASE_GITNEXUS_NATIVE is not the live path. PolyForm Noncommercial means SaaS needs a commercial grant before enabling graph features in production — status PENDING in vendor/COMMERCIAL.md.",
      },
      {
        tone: "warn",
        title: "Soft-skip ≠ green QA",
        body: "Missing Semgrep/Playwright/ZAP produces skipped/failed ToolArtifacts. With OSS_TOOLS_REQUIRED=0, skips are quiet. Always read artifact status and GET /api/integrations/oss-status (or healthz ossTools.ready).",
      },
      {
        tone: "warn",
        title: "RAM kills Playwright + Semgrep",
        body: "Render 512MB cannot reliably run both. Use ≥1GB (2GB+ recommended). Install via scripts/install-oss-tools.sh on deploy.",
      },
      {
        tone: "warn",
        title: "Cover-Agent brings its own LLM bill",
        body: "AGPL CLI expects API keys on the host. Failures here are often credential/env, not AgentOX OpenAI quota.",
      },
      {
        tone: "info",
        title: "PR creation can still warn-only",
        body: "Push may succeed while PR open fails depending on GitHub app permissions — check engineering stage logs, not only branch SHA.",
      },
      {
        tone: "info",
        title: "Do not vendor full Semgrep/ZAP monorepos",
        body: "Policy in vendor/INTEGRATIONS.md: shell out to installed CLIs + small slices only. Fix the host, not the tree.",
      },
    ],
  },
  {
    id: "writeback",
    title: "14. Jira & GitHub writeback",
    paragraphs: [
      "Closing the loop on tools of record.",
    ],
    steps: [
      {
        title: "After Ananta",
        body: "Jira comment with branch, SHA, PR link; engineering plan comment (idempotent labels).",
      },
      {
        title: "After Neel",
        body: "QA comment + labels; PR body updated; draft marked ready via GraphQL when QA passes.",
      },
      {
        title: "Output stage",
        body: "Optional description update, RCA comment, story points, transition to Done.",
      },
      {
        title: "ADF",
        body: "Markdown-ish content converted to Jira ADF (headings/lists/bold) so comments are not raw wiki text.",
      },
    ],
  },
  {
    id: "surfaces",
    title: "15. App surfaces",
    paragraphs: ["After login, work under /{orgSlug}/…"],
    steps: [
      { title: "Pipelines", body: "Queue, stage timeline, gate pause/resume/override." },
      { title: "Virin / PM Agents", body: "Discovery, PRD, engineering handoff." },
      { title: "Ananta", body: "Coding events + engineering ToolArtifacts." },
      { title: "QA (Neel)", body: "Inbox, report workspace, fleet, Canary." },
      { title: "Logs", body: "Patterns, anomalies, Sources linking." },
      { title: "Codebase", body: "Index status, semantic search, graph-backed retrieval when enabled." },
      { title: "Settings", body: "Jira, GitHub, company profile, writeback toggles." },
      { title: "Docs", body: "This page: /docs-code." },
    ],
  },
  {
    id: "gates",
    title: "16. Validation gates",
    paragraphs: [
      "Gates stop thin specs and incomplete implementations from silently shipping.",
    ],
    steps: [
      {
        title: "PRD gate",
        body: "Structural + testability. Low confidence can require human review.",
      },
      {
        title: "Implementation gate",
        body: "Criteria coverage / blockers before Neel.",
      },
      {
        title: "QA gate",
        body: "Coverage, failures, security criticals, human override for low-confidence triage.",
      },
      {
        title: "Override",
        body: "Operator override exists — use deliberately; it is audited.",
      },
    ],
  },
  {
    id: "ops",
    title: "17. Ops & host requirements",
    paragraphs: [
      "Product quality is a host property as much as a model property.",
    ],
    steps: [
      {
        title: "Install CLIs",
        body: "Deploy build should run bash scripts/install-oss-tools.sh. Manual: pip install semgrep cover-agent pytest hypothesis locust; install Playwright chromium under vendor/playwright-monitor.",
      },
      {
        title: "RAM",
        body: "≥1GB API instance; 2GB+ if Semgrep + Playwright + Cover-Agent run in the same ticket window.",
      },
      {
        title: "Strict mode",
        body: "OSS_TOOLS_REQUIRED=1 in production so missing CLIs become failed artifacts, not quiet skips.",
      },
      {
        title: "Health",
        body: "GET /api/integrations/oss-status (auth) or /healthz → ossTools.ready.",
      },
      {
        title: "ZAP",
        body: "docker pull ghcr.io/zaproxy/zaproxy:stable or accept failed ZAP on Node-only hosts.",
      },
      {
        title: "Artifacts disk",
        body: "TOOL_ARTIFACTS_DATA_DIR / data/tool-artifacts — attach persistent disk if you need survival across deploys.",
      },
      {
        title: "Kill switches",
        body: "QA_OSS_ADAPTERS=0, CANARY_OSS_ADAPTERS=0, OSS_TOOLS_REQUIRED=0 (dev soft-skip).",
      },
    ],
    callouts: [
      {
        tone: "info",
        title: "Reference in-repo",
        body: "server/vendor/INTEGRATIONS.md and COMMERCIAL.md are the engineering source of truth this page summarizes for founders.",
      },
    ],
  },
];
