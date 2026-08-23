import { AGENT_NAMES } from "../../shared/config/app";

export const AGENT_OPERATIONS = [
  {
    id: "virin",
    label: AGENT_NAMES.VIRIN,
    role: "Product",
    operations: [
      {
        id: "prd",
        title: "Draft a PRD",
        description: "Turn a ticket into a product brief with testable acceptance criteria.",
        starter: "Draft a PRD from the tagged ticket. Call out requirement gaps before writing criteria.",
      },
      {
        id: "gaps",
        title: "Analyze requirement gaps",
        description: "Review a ticket for missing context, edge cases, and unclear outcomes.",
        starter: "Analyze the tagged ticket for requirement gaps. Ask one clarifying question at a time.",
      },
      {
        id: "similar",
        title: "Search similar past work",
        description: "Find related tickets and historical decisions before scoping new work.",
        starter: "Search similar past work for the tagged ticket and summarize what we already know.",
      },
    ],
  },
  {
    id: "ananta",
    label: AGENT_NAMES.ANANTA,
    role: "Engineering",
    operations: [
      {
        id: "implement",
        title: "Implement from a ticket",
        description: "Plan and implement against the repository for a tagged ticket.",
        starter: "Plan the implementation for the tagged ticket. Cite the GitHub files I should review first.",
      },
      {
        id: "explain",
        title: "Explain a GitHub file",
        description: "Walk through a tagged file and how it relates to the ticket.",
        starter: "Explain the tagged GitHub file and how it should change for this ticket.",
      },
      {
        id: "review",
        title: "Review an implementation plan",
        description: "Check coverage of acceptance criteria before a pull request.",
        starter: "Review the implementation plan for the tagged ticket. Which acceptance criteria are still open?",
      },
    ],
  },
  {
    id: "neel",
    label: AGENT_NAMES.NEEL,
    role: "QA",
    operations: [
      {
        id: "tests",
        title: "Generate test cases",
        description: "Write happy-path, edge, error, and security cases for a ticket.",
        starter: "Generate test cases for the tagged ticket. Cover happy path, edge, error, and security.",
      },
      {
        id: "coverage",
        title: "Review coverage gaps",
        description: "Find what is untested before Neel runs the sandbox.",
        starter: "What are the biggest test coverage gaps for the tagged ticket or file?",
      },
      {
        id: "failures",
        title: "Summarize recent failures",
        description: "Read recent QA or canary failures and map them to criteria.",
        starter: "Summarize recent test failures and map them back to acceptance criteria.",
      },
    ],
  },
];

export default function CreateNewPanel({ open, onClose, onSelect }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 py-10 sm:py-16">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[40rem] overflow-hidden rounded-2xl border border-app-border bg-app-surface shadow-app-float">
        <div className="flex items-start justify-between gap-4 border-b border-app-border px-5 py-4">
          <div>
            <h2 className="text-[16px] font-semibold text-app-ink">Create New</h2>
            <p className="mt-1 text-[13px] text-app-ink-dim">
              Start a stored chat with Virin, Ananta, or Neel. Tag a ticket or GitHub file after you open it.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-[13px] text-app-ink-dim hover:bg-app-surface-muted hover:text-app-ink"
          >
            Close
          </button>
        </div>
        <div className="max-h-[min(70vh,36rem)] space-y-6 overflow-y-auto px-5 py-5">
          <button
            type="button"
            onClick={() =>
              onSelect({
                domain: "virin",
                title: "New chat",
                operation: null,
                starter: "",
              })
            }
            className="w-full rounded-xl border border-app-border px-4 py-3 text-left transition hover:bg-app-surface-muted/60"
          >
            <p className="text-[14px] font-semibold text-app-ink">Blank chat</p>
            <p className="mt-0.5 text-[13px] text-app-ink-dim">
              Empty session — pick an agent and tag tickets or files as you go.
            </p>
          </button>
          {AGENT_OPERATIONS.map((agent) => (
            <section key={agent.id}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-app-ink-mute">
                {agent.label} · {agent.role}
              </p>
              <ul className="mt-2 space-y-2">
                {agent.operations.map((op) => (
                  <li key={op.id}>
                    <button
                      type="button"
                      onClick={() =>
                        onSelect({
                          domain: agent.id,
                          title: op.title,
                          operation: op.id,
                          starter: op.starter,
                        })
                      }
                      className="w-full rounded-xl border border-app-border px-4 py-3 text-left transition hover:bg-app-surface-muted/60"
                    >
                      <p className="text-[14px] font-semibold text-app-ink">{op.title}</p>
                      <p className="mt-0.5 text-[13px] text-app-ink-dim">{op.description}</p>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
