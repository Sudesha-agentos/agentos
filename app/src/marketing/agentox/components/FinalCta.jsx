import SmartLink from "./SmartLink";
import { BRAND, FINAL_CTA } from "../content";

export default function FinalCta() {
  return (
    <section className="ax-final-cta">
      <div className="ax-container">
        <h2 className="ax-final-headline ax-reveal">{FINAL_CTA.headline}</h2>
        <p className="ax-final-subhead ax-reveal">{FINAL_CTA.subhead}</p>
        <div className="ax-reveal">
          <SmartLink href={FINAL_CTA.primaryCta.href} className="ax-btn ax-btn-primary">
            {FINAL_CTA.primaryCta.label}
          </SmartLink>
        </div>
        <div className="ax-final-fallback">
          {FINAL_CTA.fallback} <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a>
        </div>
      </div>
    </section>
  );
}
