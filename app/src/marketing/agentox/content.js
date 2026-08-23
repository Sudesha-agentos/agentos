/** AgentOX marketing copy: single source of truth for the landing page. */

export const BRAND = {
  name: "AgentOX",
  email: "hello@agentox.io",
  footerTagline: "AI agents that take Jira tickets to reviewed pull requests.",
};

export const NAV = {
  links: [
    { label: "Product", href: "#product" },
    { label: "How it works", href: "#how-it-works" },
    { label: "Agents", href: "#agents" },
    { label: "Pricing", href: "#pricing" },
    { label: "Contact", href: "/contact" },
  ],
  signIn: { label: "Sign in", href: "/login" },
  cta: { label: "Get early access", href: "/login?signup" },
};

export const HERO = {
  badge: "Early access · Works with Jira, GitHub & Bitbucket",
  welcome: "Welcome to AgentOX.",
  headline: "From Jira ticket to reviewed PR. Autonomously.",
  subhead:
    "Three AI agents: Virin, Ananta, and Neel: analyze your ticket, write the code, and run the tests. You approve at every gate.",
  primaryCta: { label: "Get early access", href: "/login?signup" },
  secondaryCta: { label: "See how it works", href: "#how-it-works" },
  note: "No credit card · Setup in 30 minutes",
};

export const PIPELINE_STAGES = [
  { id: "ticket", label: "Jira ticket", sub: "AUTH-2847", kind: "input" },
  { id: "virin", label: "Virin", sub: "Product agent", kind: "agent", detail: "PRD · gap analysis" },
  { id: "ananta", label: "Ananta", sub: "Engineering agent", kind: "agent", detail: "Code · draft PR" },
  { id: "neel", label: "Neel", sub: "QA agent", kind: "agent", detail: "Tests · sandbox run" },
  { id: "pr", label: "Draft PR", sub: "Ready for review", kind: "output" },
];

export const PIPELINE_GATE_LABEL = "Human gate";

export const INTEGRATIONS = {
  title: "Plugs into the tools you already use",
  logos: [
    { name: "Jira", src: "/marketing/integrations/jira.svg" },
    { name: "GitHub", src: "/marketing/integrations/github.svg" },
    { name: "Bitbucket", src: "/marketing/integrations/bitbucket.svg" },
    { name: "Slack", src: "/marketing/integrations/slack.svg" },
    { name: "Linear", src: "/marketing/integrations/linear.svg" },
    { name: "HubSpot", src: "/marketing/integrations/hubspot.svg" },
    { name: "Supabase", src: "/marketing/integrations/supabase.svg" },
    { name: "Grafana", src: "/marketing/integrations/grafana.svg" },
    { name: "Sentry", src: "/marketing/integrations/sentry.svg" },
    { name: "Datadog", src: "/marketing/integrations/datadog.svg" },
  ],
};

export const HOW_IT_WORKS = {
  id: "how-it-works",
  eyebrow: "How it works",
  headline: "Three steps. Human approval at every gate.",
  steps: [
    {
      number: "01",
      title: "Connect",
      body: "OAuth into Jira and GitHub or Bitbucket. AgentOX indexes your codebase once, then stays current via webhooks. About 30 minutes, no DevOps work.",
    },
    {
      number: "02",
      title: "Agents run",
      body: "Pick a ticket. Virin validates the requirements, Ananta writes the code, Neel runs the tests: each handoff passes a validation gate before the next agent starts.",
    },
    {
      number: "03",
      title: "You review",
      body: "A draft PR lands with the PRD, implementation plan, and QA report attached. Approve, request changes, or override: results write back to Jira automatically.",
    },
  ],
};

export const AGENTS = {
  id: "agents",
  eyebrow: "Meet the agents",
  headline: "A product manager, an engineer, and a QA: working in sequence.",
  subhead:
    "Each agent completes its stage and passes a validation gate before the next one starts. If confidence is low, the pipeline pauses and asks you.",
  cards: [
    {
      name: "Virin",
      role: "Product agent",
      body: "Analyzes the ticket step by step: finds requirement gaps, checks against similar past tickets, and writes a PRD with testable Given/When/Then criteria.",
      handsOffTo: "Ananta",
      tags: ["Gap analysis", "PRD generation", "Confidence scoring"],
    },
    {
      name: "Ananta",
      role: "Engineering agent",
      body: "Reads your real repository and follows its conventions. Maps every acceptance criterion to code, commits to a branch, and opens a draft PR with the plan attached.",
      handsOffTo: "Neel",
      tags: ["Codebase intelligence", "Criterion mapping", "Draft PR"],
    },
    {
      name: "Neel",
      role: "QA agent",
      body: "Generates happy-path, edge, error, and security tests. Executes them in an isolated sandbox against the pushed branch and maps every failure to the criterion it violates.",
      handsOffTo: null,
      tags: ["Sandboxed execution", "Failure triage", "Approve / block"],
    },
  ],
};

export const FEATURES = {
  id: "product",
  eyebrow: "Platform",
  headline: "Everything between the ticket and the merge.",
  cards: [
    {
      title: "Requirement gap analysis",
      body: "Ambiguities surface before anyone codes. Below the confidence threshold, the pipeline pauses for a human instead of guessing.",
    },
    {
      title: "Codebase intelligence",
      body: "Your repository is indexed into a semantic map. Agents cite real files and follow existing patterns: no blank-chat hallucinations.",
    },
    {
      title: "Sandboxed test execution",
      body: "QA doesn't just plan tests, it runs them: in an isolated sandbox against the actual branch. No execution, no approval.",
    },
    {
      title: "Human approval gates",
      body: "Validation gates after PRD, implementation, and QA. Nothing merges without a person signing off.",
    },
    {
      title: "Full audit trail",
      body: "Every output is traceable: which ticket triggered it, which gates passed, who approved, and what changed between runs.",
    },
    {
      title: "Jira writeback",
      body: "PRDs, PR links, and QA results post back to the ticket automatically. Your board stays the source of truth.",
    },
  ],
};

export const SECURITY = {
  id: "security",
  eyebrow: "Security",
  headline: "Your code stays yours.",
  subhead:
    "Codebase intelligence stores summaries and embeddings: not a wholesale copy of your source. Your data never trains the models.",
  modes: [
    {
      name: "Managed cloud",
      body: "Runs in our hardened cloud with isolated tenants. Fastest way to start.",
    },
    {
      name: "Your VPC or on-prem",
      body: "Everything: data, agents, and optional self-hosted models: runs inside your own network. Nothing leaves.",
    },
  ],
  footnote: "SOC 2 Type 1 & 2 roadmap in progress.",
};

export const PRICING = {
  id: "pricing",
  eyebrow: "Pricing",
  headline: "Simple plans that pay for themselves.",
  subhead:
    "A pipeline run is one ticket taken through discovery to a PRD: revised tickets don't count twice.",
  plans: [
    {
      id: "starter",
      name: "Starter",
      price: "$1,999",
      period: "/month",
      tagline: "For teams running their first features through the pipeline.",
      features: [
        "40 pipeline runs per month",
        "All three agents: Virin, Ananta, Neel",
        "1 connected repository",
        "Jira integration & writeback",
        "PRD, implementation & QA gates",
        "30-day audit trail",
      ],
      cta: { label: "Get early access", href: "/login?signup" },
      popular: false,
    },
    {
      id: "growth",
      name: "Growth",
      price: "$4,999",
      period: "/month",
      tagline: "For teams scaling AI agents into their standard workflow.",
      features: [
        "150 pipeline runs per month",
        "Everything in Starter",
        "Up to 5 connected repositories",
        "Codebase intelligence map & semantic search",
        "Slack approvals & ROI dashboard",
        "90-day audit trail · priority support",
      ],
      cta: { label: "Get early access", href: "/login?signup" },
      popular: true,
    },
    {
      id: "enterprise",
      name: "Enterprise",
      price: "Custom",
      period: "",
      tagline: "For organizations that need scale, security, and compliance.",
      features: [
        "Unlimited pipeline runs & repositories",
        "VPC / on-prem deployment",
        "SSO / SAML & compliance exports",
        "Custom agent configuration",
        "Unlimited audit trail",
        "Dedicated success manager",
      ],
      cta: { label: "Talk to us", href: "/contact" },
      popular: false,
    },
  ],
};

export const FAQ = {
  id: "faq",
  eyebrow: "FAQ",
  headline: "Questions, answered.",
  items: [
    {
      q: "Does AgentOX replace my developers?",
      a: "No. It removes the rework loop: unclear requirements, missed criteria, untested edge cases. Your engineers review every PR and keep the final decision at every gate.",
    },
    {
      q: "What happens when a ticket is unclear?",
      a: "Virin scores its confidence in the requirements. Below the threshold, the pipeline pauses and asks a human for clarification instead of building the wrong thing.",
    },
    {
      q: "What access does it need?",
      a: "OAuth into Jira and a GitHub App or Bitbucket OAuth connection to your repository. Agents work on branches and open draft PRs: they never push to your default branch.",
    },
    {
      q: "How is my code protected?",
      a: "Codebase intelligence stores summaries and embeddings in an isolated tenant, not a raw copy of your source. Your data never trains the models. Enterprise plans can run entirely inside your VPC or on-prem.",
    },
    {
      q: "Which tools does it work with?",
      a: "Jira for tickets, GitHub and Bitbucket for code, Slack for approvals, Confluence for docs context. Results write back to the ticket automatically.",
    },
    {
      q: "How long does setup take?",
      a: "About 30 minutes: connect Jira, connect your repository, and run your first ticket through the pipeline the same day.",
    },
  ],
};

export const FINAL_CTA = {
  headline: "Run your first ticket through the pipeline.",
  subhead:
    "Setup takes 30 minutes. Your first run shows you exactly what your team's rework has been costing.",
  primaryCta: { label: "Get early access", href: "/login?signup" },
  fallback: "Questions? Talk to the founders.",
};

export const FOOTER = {
  columns: [
    {
      title: "Product",
      links: [
        { label: "How it works", href: "#how-it-works" },
        { label: "Agents", href: "#agents" },
        { label: "Pricing", href: "#pricing" },
        { label: "Security", href: "#security" },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "Welcome to AgentOX", href: "/welcome" },
        { label: "Contact", href: "/contact" },
        { label: "Docs", href: "/docs-code" },
        { label: "Sign in", href: "/login" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Privacy Policy", href: "/privacy" },
        { label: "Terms & Conditions", href: "/terms" },
      ],
    },
  ],
  legal: `© ${new Date().getFullYear()} AgentOX. All rights reserved.`,
  legalLinks: [
    { label: "Welcome to AgentOX", href: "/welcome" },
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms & Conditions", href: "/terms" },
  ],
};
