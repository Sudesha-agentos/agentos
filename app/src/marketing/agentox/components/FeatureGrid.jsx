import { FEATURES } from "../content";

export default function FeatureGrid() {
  return (
    <section className="ax-section" id={FEATURES.id}>
      <div className="ax-container">
        <div className="ax-section-head ax-reveal">
          <div className="ax-eyebrow">{FEATURES.eyebrow}</div>
          <h2 className="ax-h2">{FEATURES.headline}</h2>
        </div>
        <div className="ax-features">
          {FEATURES.cards.map((card) => (
            <div key={card.title} className="ax-feature ax-reveal">
              <h3 className="ax-feature-title">{card.title}</h3>
              <p className="ax-feature-body">{card.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
