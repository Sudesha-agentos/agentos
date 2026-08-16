import { AGENTS } from "../content";

export default function AgentCards() {
  return (
    <section className="ax-section" id={AGENTS.id}>
      <div className="ax-container">
        <div className="ax-section-head ax-reveal">
          <div className="ax-eyebrow">{AGENTS.eyebrow}</div>
          <h2 className="ax-h2">{AGENTS.headline}</h2>
          <p className="ax-subhead">{AGENTS.subhead}</p>
        </div>
        <div className="ax-agents">
          {AGENTS.cards.map((agent) => (
            <article key={agent.name} className="ax-agent-card ax-reveal">
              <div className="ax-agent-avatar">{agent.name.charAt(0)}</div>
              <div>
                <h3 className="ax-agent-name">{agent.name}</h3>
                <div className="ax-agent-role">{agent.role}</div>
              </div>
              <p className="ax-agent-body">{agent.body}</p>
              <div className="ax-agent-tags">
                {agent.tags.map((tag) => (
                  <span key={tag} className="ax-agent-tag">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="ax-agent-handoff">
                {agent.handsOffTo ? (
                  <>
                    Hands off to <strong>{agent.handsOffTo}</strong> →
                  </>
                ) : (
                  <>
                    Delivers the <strong>QA report &amp; verdict</strong> ✓
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
