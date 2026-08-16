import { HOW_IT_WORKS } from "../content";

export default function HowItWorks() {
  return (
    <section className="ax-section" id={HOW_IT_WORKS.id}>
      <div className="ax-container">
        <div className="ax-section-head ax-reveal">
          <div className="ax-eyebrow">{HOW_IT_WORKS.eyebrow}</div>
          <h2 className="ax-h2">{HOW_IT_WORKS.headline}</h2>
        </div>
        <div className="ax-steps">
          {HOW_IT_WORKS.steps.map((step) => (
            <div key={step.number} className="ax-step ax-reveal">
              <div className="ax-step-number">{step.number}</div>
              <h3 className="ax-step-title">{step.title}</h3>
              <p className="ax-step-body">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
