/** AgentOX marketing copy — Torus-style layout (usetorus.com structure). */

export const BRAND = {
  name: "AGENTOX",
  tagline: "FROM JIRA TICKET TO SHIPPED CODE",
  footerTagline: "Built for engineering teams that ship.",
  email: "sudesha@agentox.io",
};

export const NAV_LINKS = [
  { label: "INTELLIGENCE", href: "#platform" },
  { label: "AUTOMATION", href: "#email" },
];

export const HERO = {
  headline: "Agents that think in Jira tickets, PRDs, and pull requests.",
  description:
    "AgentOX's AI agents understand every requirement across your tickets, codebase, and test suites. They cross-reference every detail and adopt how your team ships.",
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
    "Connect Jira and GitHub. AgentOX runs discovery, implementation, and QA in sequence — with validation gates between every handoff. Engineers see consistency flags. PMs see workflow automation. Same ticket, same pipeline.",
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
          { text: "\"admin users only\"", hl: true },
          { text: " but ticket label says \"all users\"" },
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
    "Most AI tools for engineering are just chatbots. You paste a ticket, ask a question, get an answer.",
    "One ticket. One question. One answer.",
    "That's not how shipping works.",
  ],
  points: [
    {
      title: "Full pipeline context, not single prompts",
      body: "AgentOX holds your Jira ticket, PRD, codebase, and test results in context simultaneously. When your acceptance criteria say one thing and your implementation does another, AgentOX doesn't wait for you to ask. It already flagged it at the gate.",
    },
    {
      title: "Proactive, not reactive",
      body: "Chatbots answer questions. AgentOX finds gaps before engineering starts, blockers before QA runs, and coverage holes before merge. Three validation gates running against every feature in your sprint.",
    },
    {
      title: "Ships deliverables, not paragraphs",
      body: "AgentOX doesn't write generic text. It drafts PRDs with Given/When/Then criteria, implementation plans mapped to your codebase, draft PRs, and QA reports tied to every acceptance criterion.",
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
      "The AUTH-2847 pipeline finished. Virin generated a PRD with 15 acceptance criteria. Ananta opened draft PR #847 with 12 files changed. Neel ran 47 tests — 45 passed, 2 flagged for your review.",
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
      label: "THREADS",
      title: "Follows full conversations",
      body: "CC AgentOX on Jira updates or Slack threads. It tracks decisions and action items across every party on the thread.",
    },
    {
      label: "FOLLOW-UPS",
      title: "Flags what's stalled",
      body: "Gate failure? Missing acceptance criteria? AgentOX drafts the follow-up and waits for your go-ahead.",
    },
    {
      label: "AUDIT TRAIL",
      title: "Every action, traceable",
      body: "Full provenance on every output. Which ticket triggered it, which gates passed, which human approved, and what changed between runs.",
    },
  ],
};

export const SECTION_04 = {
  id: "mission",
  label: "WHY THIS MATTERS",
  headline: "The most expensive bug is the one you ship twice.",
  body: [
    {
      strong:
        "30–40% of feature work gets reworked. 23% of sprint capacity lost to handoff degradation. 100× the cost when bugs reach production.",
    },
    "Every sprint, teams lose days to misread requirements, ambiguous acceptance criteria, and tests that stopped being true. When a PM meant one thing and engineering built another, it's not a communication problem — it's a missing governance layer.",
    {
      strong: "AgentOX gives every team the capacity of a full product-engineering-QA loop.",
    },
  ],
};

export const SECTION_05 = {
  id: "security",
  label: "SECURITY",
  headline: "You stay in control of your data.",
  headlineKey: "control",
  subhead: "Two ways to run AgentOX. You pick how much stays inside your walls.",
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
  footnote: "SOC 2 Type 1 & 2 roadmap in progress.",
};

export const FINAL_CTA = {
  label: "YOUR NEXT STEP",
  headline: "See AgentOX on your next ticket.",
  description:
    "Connect Jira and GitHub. Run your first pipeline in under 30 minutes. We'll show you what three agents and three gates look like on real work.",
  primaryCta: "REQUEST EARLY ACCESS",
  primaryHref: "/login",
  fallback: "or email",
};
