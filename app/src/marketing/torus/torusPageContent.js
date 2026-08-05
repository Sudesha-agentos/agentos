/** AgentOX marketing copy — Torus-style layout (usetorus.com structure).
 *  SEO-optimised strings; layout/components unchanged.
 */

export const BRAND = {
  name: "AGENTOX",
  tagline: "AI SDLC AUTOMATION · JIRA TO PRODUCTION",
  footerTagline:
    "The AI pipeline for engineering teams who ship features right the first time.",
  email: "hello@agentox.io",
};

export const NAV_LINKS = [
  { label: "INTELLIGENCE", href: "#platform" },
  { label: "AUTOMATION", href: "#email" },
  { label: "ROI", href: "#roi" },
];

export const HERO = {
  headline:
    "The AI pipeline that goes from Jira ticket to shipped code — without losing what you actually meant.",
  description:
    "AgentOX orchestrates Product, Engineering, and QA AI agents through your software development lifecycle. Requirement gaps caught. Code written against your real codebase. Tests run. Draft PR opened — all from the Jira ticket you already created. No credit card · Setup in 30 minutes · Works with Jira and GitHub.",
  primaryCta: "REQUEST EARLY ACCESS",
  primaryHref: "/login",
  secondaryCta: "SEE THE PIPELINE",
  secondaryHref: "#platform",
  fallback: "or email",
};

export const SECTION_01 = {
  id: "platform",
  label: "ENGINEERING INTELLIGENCE",
  intro:
    "Three agents. One pipeline. Zero lost context. Connect Jira and GitHub — AgentOX runs Product discovery, Engineering implementation, and QA validation in sequence, with human gates between every handoff. Automated PRD generation, an AI engineering agent that reads your codebase, and an AI QA agent that executes real tests. Same ticket. Same pipeline. Full audit trail.",
  mockup: {
    projectTitle: "AUTH-2847 OAuth Scope Expansion",
    engineerMeta: {
      flags: "2 critical · 5 warnings",
      coverage: "9/12 acceptance criteria",
    },
    pmMeta: {
      flags: "PRD 94% · QA 45/47",
      coverage: "Pipeline ready for review",
    },
    engineerFlags: [
      {
        icon: "⚠",
        segments: [
          { text: "Acceptance criterion missing for " },
          { text: "token refresh failure path", hl: true },
          { text: " (Jira AUTH-2847)" },
        ],
        secondary: "vs. similar ticket AUTH-2103 (had explicit Given/When/Then)",
        rule: "acceptance_criteria_completeness",
      },
      {
        icon: "⚠",
        segments: [
          { text: "Scope mentions " },
          { text: '"admin users only"', hl: true },
          { text: ' but ticket label says "all users"' },
        ],
        secondary: "vs. product brief Q2-Auth-Scope.pdf",
        rule: "scope_alignment",
      },
      {
        icon: "⚠",
        segments: [
          { text: "Rate limit policy referenced in PRD but not in " },
          { text: "implementation plan", hl: true },
        ],
        secondary: "vs. org policy API-RATE-LIMITS.md",
        rule: "policy_coverage",
      },
    ],
    pmBlock: {
      title: "Pipeline Approval, Draft #3",
      meta: ["GENERATED 2m AGO", "SOURCE: Jira AUTH-2847", "CONFIDENCE: 0.91"],
      memo: {
        to: "Sarah Chen, Engineering Lead",
        re: "AUTH-2847 OAuth Scope Expansion",
        recommendation: "PROCEED TO MERGE",
        body: [
          "PRD: 15 acceptance criteria · PR #847 · QA: 45/47 passed",
          "2 non-blocking failures flagged for human review.",
        ],
        chain: [
          { label: "PRD gate (Virin)", done: true },
          { label: "Implementation gate (Ananta)", done: true },
          { label: "Human review (Sarah Chen)", done: false },
        ],
      },
    },
    engineerSidebar: {
      documents: [
        { label: "Jira ticket AUTH-2847", dot: "live", active: true },
        { label: "Similar tickets (4)", dot: "live" },
        { label: "Product brief Q2", dot: "live" },
        { label: "Implementation plan draft", dot: "learning" },
        { label: "Org policy API-RATE-LIMITS.md", dot: "live" },
      ],
      missing: ["Error handling spec", "Rate limit policy"],
      stat: "847 CODEBASE SYMBOLS INDEXED",
    },
    pmSidebar: {
      live: [
        { label: "prd-validation", dot: "live", active: true },
        { label: "implementation-plan", dot: "live" },
      ],
      learning: [
        { label: "test-scaffolding", dot: "learning" },
        { label: "canary-run", dot: "learning" },
      ],
      ready: [
        { label: "pr-draft", dot: "ready" },
        { label: "qa-handoff", dot: "ready" },
        { label: "jira-writeback", dot: "ready" },
      ],
    },
    engineerNav: ["PROJECT MODEL", "CONSISTENCY", "COVERAGE", "REVIEW QUEUE"],
    engineerNavActive: 1,
    pmNav: ["OVERVIEW", "BLOCKING", "DOCS", "FLAGS", "QUEUE"],
    pmNavActive: 0,
  },
};

export const SECTION_02 = {
  id: "beyond",
  label: "BEYOND A CHATBOT",
  intro: [
    "AI can write code. The hard part is knowing what to write.",
    "Claude Code, Cursor, and GitHub Copilot make individual developers faster. They do not validate that the Jira ticket was clear enough to build from.",
    "They execute. They do not govern. AgentOX is the multi-agent coding pipeline those tools are missing.",
  ],
  points: [
    {
      title: "Validates requirements before anyone codes",
      body: "Automated PRD generation with testable Given/When/Then criteria. Gap analysis surfaces every ambiguity. Below 70% confidence, the pipeline pauses for a human — bad requirements never reach engineering.",
    },
    {
      title: "AI engineering agent on your real codebase",
      body: "Not a blank chat. AgentOX reads your repository, follows your conventions, maps every acceptance criterion to implementation decisions, and opens a draft PR with a full plan attached.",
    },
    {
      title: "AI QA agent that actually runs tests",
      body: "Generates happy-path, edge, error, and security scenarios. Executes in an isolated sandbox. Maps every failure back to the acceptance criterion it violates — then recommends approve, change, or block.",
    },
  ],
};

export const SECTION_03 = {
  id: "email",
  label: "WORKFLOW AUTOMATION",
  email: {
    from: "agentox@notifications.agentox.io",
    to: "sarah.chen@company.com",
    subject: "Pipeline complete: AUTH-2847 ready for review",
    body: [
      "Sarah,",
      "",
      "Your Jira AI automation run finished. Product agent generated a PRD with 15 acceptance criteria. Engineering agent opened draft PR #847 (12 files). QA agent ran 47 tests — 45 passed, 2 flagged for review. Average ticket-to-PR time: under 2 hours.",
    ],
    output: {
      header: "AGENTOX OUTPUT",
      lines: [
        { label: "STATUS:", value: "AWAITING REVIEW", highlight: true },
        { label: "PRD CONFIDENCE:", value: "94%" },
        { label: "CRITERIA COVERAGE:", value: "13/15 mapped" },
        { label: "QA RESULT:", value: "2 failures (non-blocking)" },
      ],
    },
    closing:
      'If this looks right, reply "approve" and I\'ll route the PR for merge and write results back to Jira.',
    sig: "AgentOX | pipeline: auth-2847 | confidence: 0.91",
  },
  sidebar: [
    {
      label: "CONNECT",
      title: "Jira + GitHub in 30 minutes",
      body: "OAuth into Jira and GitHub. AgentOX indexes your codebase once — then every push updates intelligence via webhook. No DevOps overhead.",
    },
    {
      label: "GATES",
      title: "Human oversight at every stage",
      body: "PRD, implementation, and QA validation gates. Slack when attention is needed. Everything else runs without you — you keep the decision.",
    },
    {
      label: "AUDIT TRAIL",
      title: "Compliance-ready provenance",
      body: "Every output is traceable: which ticket triggered it, which gates passed, which human approved, and what changed between runs.",
    },
  ],
};

export const SECTION_04 = {
  id: "mission",
  label: "WHY THIS MATTERS",
  headline: "The most expensive bug is the feature you ship twice.",
  body: [
    {
      strong:
        "30% of feature work gets reinterpreted across PM, eng, and QA. 23% of sprint capacity is lost to handoff degradation. A 50-person team burns $100K+ a year on that rework.",
    },
    "AI coding tools accelerate writing. They do not catch the seven questions that should have been answered before engineering started. AgentOX is AI SDLC automation with requirements validation, codebase intelligence, and QA execution in one governed pipeline — cutting sprint rework by up to 60%.",
    {
      strong:
        "Ship the right feature the first time. Product, Engineering, and QA agents — with human gates.",
    },
  ],
};

export const SECTION_05 = {
  id: "security",
  label: "SECURITY",
  headline: "You stay in control of your data.",
  headlineKey: "control",
  subhead:
    "Codebase intelligence stores summaries and embeddings — not a wholesale dump of your source. Two ways to run AgentOX.",
  modes: [
    {
      name: "AgentOX",
      tag: "Managed",
      locked: false,
      wallLoc: "AgentOX secure cloud",
      wallPin: "Frontier models",
      items: [
        { label: "Your documents", suffix: "· isolated tenant" },
        { label: "AgentOX agent" },
      ],
      captionBefore: "Runs in our hardened cloud. ",
      captionStrong: "Your data is isolated, never trains the models,",
      captionAfter: " and embeddings store summaries — not raw code.",
    },
    {
      name: "Sovereign",
      tag: "Locked down",
      locked: true,
      wallLoc: "Your cloud, VPC or on-prem",
      wallPin: "Sealed",
      items: [
        { label: "Your documents" },
        { label: "AgentOX agent" },
        { label: "The model", model: true },
      ],
      captionBold: "Everything runs inside your own network:",
      captionRest: " data, agents, and optional self-hosted models. Nothing leaves.",
    },
  ],
  footnote: "SOC 2 Type 1 & 2 roadmap in progress. Enterprise: VPC / on-premise options.",
};

export const SECTION_06 = {
  id: "roi",
  label: "ROI CALCULATOR",
  headline: "Calculate what sprint rework is costing your team.",
  intro:
    "Tune team size, pipeline volume, and rework rate. See net benefit, payback period, and ROI across plans — updated live. At a 20-person team with 30% rework, AgentOX typically pays for itself in weeks.",
};

export const FINAL_CTA = {
  label: "YOUR NEXT STEP",
  headline: "Your next sprint rework is preventable.",
  description:
    "Join engineering teams who stopped rebuilding features and started shipping them right the first time. Setup takes 30 minutes. Your first pipeline run will show you exactly what we mean.",
  primaryCta: "REQUEST EARLY ACCESS",
  primaryHref: "/login",
  fallback: "Questions? Talk to the founders —",
};
