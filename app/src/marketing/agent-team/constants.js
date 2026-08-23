import { AGENT_DETAILS, HERO as HERO_CONTENT } from "./marketingPageContent";

export { HERO_CONTENT as HERO };

export const NAV_LINKS = [
  { label: "Solution", href: "#solution" },
  { label: "Agents", href: "#agents" },
  { label: "Pricing", href: "#pricing" },
  { label: "ROI", href: "#roi" },
  { label: "FAQ", href: "#faq" },
  { label: "Contact", href: "/contact" },
];

/** Teammate intros — Virin → Ananta → Neel */
export const AGENTS = [
  {
    id: "virin",
    number: "01",
    chapter: 1,
    chapterRoman: "I",
    chapterTitle: "Product Discovery",
    chapterSubtitle: "Virin shapes the spec your team can ship",
    name: "Virin",
    role: "Product",
    roleDetail: AGENT_DETAILS.virin.roleLabel,
    gradient: "olive",
    image: "/marketing/agents/virin.png",
    headline: AGENT_DETAILS.virin.tagline,
    teammateIntro: AGENT_DETAILS.virin.intro,
    body: "Four-stage discovery, historical context, gap analysis, and PRD generation — all before engineering touches the ticket.",
    bullets: AGENT_DETAILS.virin.produces,
    sectionId: "agent-virin",
    appPath: "/app/pm-agents",
  },
  {
    id: "ananta",
    number: "02",
    chapter: 2,
    chapterRoman: "II",
    chapterTitle: "Engineering & Build",
    chapterSubtitle: "Ananta plans against your real codebase",
    name: "Ananta",
    role: "Tech",
    roleDetail: AGENT_DETAILS.ananta.roleLabel,
    gradient: "amber",
    image: "/marketing/agents/ananta.png",
    headline: AGENT_DETAILS.ananta.tagline,
    teammateIntro: AGENT_DETAILS.ananta.intro,
    body: "Reads your actual codebase, maps acceptance criteria to code, writes production-quality files, and opens a draft PR.",
    bullets: AGENT_DETAILS.ananta.produces,
    sectionId: "agent-ananta",
    appPath: "/app/ananta",
  },
  {
    id: "neel",
    number: "03",
    chapter: 3,
    chapterRoman: "III",
    chapterTitle: "QA & Release",
    chapterSubtitle: "Neel signs off before anything ships",
    name: "Neel",
    role: "QA",
    roleDetail: AGENT_DETAILS.neel.roleLabel,
    gradient: "lavender",
    image: "/marketing/agents/neel.png",
    headline: AGENT_DETAILS.neel.tagline,
    teammateIntro: AGENT_DETAILS.neel.intro,
    body: "Generates tests for every code path, runs them in an isolated sandbox, and produces a report that tells engineering exactly what to fix.",
    bullets: AGENT_DETAILS.neel.produces,
    sectionId: "agent-neel",
    appPath: "/app/qa",
  },
];

/** Marketing chapter cards — three agents + pipeline capstone (Cofounder-style books). */
export const AGENT_CHAPTERS = [
  ...AGENTS,
  {
    id: "pipeline",
    number: "04",
    chapter: 4,
    chapterRoman: "IV",
    chapterTitle: "One Pipeline",
    chapterSubtitle: "Three agents, one full pipeline",
    name: "AgentOX Pipeline",
    role: "Full loop",
    roleDetail: "Jira → PRD → build → QA",
    gradient: "cream",
    image: null,
    coverAgents: ["virin", "ananta", "neel"],
    headline: "Three agents. One pipeline. Zero lost context.",
    teammateIntro:
      "Virin, Ananta, and Neel hand off in sequence — with validation gates between every step so nothing gets lost in translation.",
    body: "From Jira ticket to PRD, implementation, QA report, and structured writeback — with human review at every gate.",
    bullets: [
      "PRD validation gate before engineering starts",
      "Implementation gate before QA runs",
      "QA validation gate before merge",
    ],
    sectionId: "agent-pipeline",
    appPath: "/login",
  },
];

export const HERO_STATS = [
  { value: "7", label: "Pipeline stages" },
  { value: "3", label: "Validation gates" },
  { value: "∞", label: "Tickets per pipeline" },
];

export const INTEGRATIONS = [
  { id: "jira", name: "Jira", detail: "Tickets & writeback", logo: "/marketing/integrations/jira.svg", height: 32, minWidth: 32 },
  { id: "github", name: "GitHub", detail: "Repos & PRs", logo: "/marketing/integrations/github.svg", height: 32, minWidth: 32 },
  { id: "bitbucket", name: "Bitbucket", detail: "Git hosting", logo: "/marketing/integrations/bitbucket.svg", height: 32, minWidth: 32 },
  { id: "confluence", name: "Confluence", detail: "Docs & wiki", logo: "/marketing/integrations/confluence.svg", height: 32, minWidth: 32 },
  { id: "supabase", name: "Supabase", detail: "Vector index", logo: "/marketing/integrations/supabase.svg", height: 32, minWidth: 32 },
  { id: "grafana", name: "Grafana", detail: "Observability", logo: "/marketing/integrations/grafana.svg", height: 32, minWidth: 32 },
  { id: "slack", name: "Slack", detail: "Team signals", logo: "/marketing/integrations/slack.svg", height: 32, minWidth: 32 },
  { id: "linear", name: "Linear", detail: "Issues & cycles", logo: "/marketing/integrations/linear.svg", height: 32, minWidth: 32 },
  { id: "hubspot", name: "HubSpot", detail: "CRM", logo: "/marketing/integrations/hubspot.svg", height: 32, minWidth: 32 },
  { id: "sentry", name: "Sentry", detail: "Errors", logo: "/marketing/integrations/sentry.svg", height: 32, minWidth: 32 },
];

/** Product proof points — honest targets, not customer claims. */
export const PRODUCT_PROOF_METRICS = [
  { value: "3", label: "validation gates before ship" },
  { value: "<2h", label: "ticket-to-PR-ready target" },
  { value: "60%", label: "rework reduction in ROI model" },
];
