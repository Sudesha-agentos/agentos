import SmartLink from "./SmartLink";
import { PRICING } from "../content";

export default function PricingSection() {
  return (
    <section className="ax-section" id={PRICING.id}>
      <div className="ax-container">
        <div className="ax-section-head ax-reveal">
          <div className="ax-eyebrow">{PRICING.eyebrow}</div>
          <h2 className="ax-h2">{PRICING.headline}</h2>
          <p className="ax-subhead">{PRICING.subhead}</p>
        </div>
        <div className="ax-pricing">
          {PRICING.plans.map((plan) => (
            <div
              key={plan.id}
              className={`ax-plan ax-reveal ${plan.popular ? "ax-popular" : ""}`}
            >
              {plan.popular && <div className="ax-plan-badge">Most popular</div>}
              <h3 className="ax-plan-name">{plan.name}</h3>
              <div className="ax-plan-price">
                <strong>{plan.price}</strong>
                {plan.period && <span>{plan.period}</span>}
              </div>
              <p className="ax-plan-tagline">{plan.tagline}</p>
              <ul className="ax-plan-features">
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <SmartLink
                href={plan.cta.href}
                className={`ax-btn ${plan.popular ? "ax-btn-primary" : "ax-btn-secondary"}`}
              >
                {plan.cta.label}
              </SmartLink>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
