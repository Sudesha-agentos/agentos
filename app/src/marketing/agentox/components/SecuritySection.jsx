import { SECURITY } from "../content";

export default function SecuritySection() {
  return (
    <section className="ax-section" id={SECURITY.id}>
      <div className="ax-container">
        <div className="ax-section-head ax-reveal">
          <div className="ax-eyebrow">{SECURITY.eyebrow}</div>
          <h2 className="ax-h2">{SECURITY.headline}</h2>
          <p className="ax-subhead">{SECURITY.subhead}</p>
        </div>
        <div className="ax-security-modes">
          {SECURITY.modes.map((mode) => (
            <div key={mode.name} className="ax-security-mode ax-reveal">
              <h3 className="ax-security-mode-name">{mode.name}</h3>
              <p className="ax-security-mode-body">{mode.body}</p>
            </div>
          ))}
        </div>
        <div className="ax-security-footnote">{SECURITY.footnote}</div>
      </div>
    </section>
  );
}
