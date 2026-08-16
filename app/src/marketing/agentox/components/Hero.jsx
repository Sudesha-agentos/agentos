import SmartLink from "./SmartLink";
import PipelineVisual from "./PipelineVisual";
import { HERO } from "../content";

export default function Hero() {
  return (
    <section className="ax-hero" id="about">
      <div className="ax-container">
        <div className="ax-hero-badge">{HERO.badge}</div>
        <p className="ax-hero-welcome">{HERO.welcome}</p>
        <h1 className="ax-hero-app-name">{HERO.appName}</h1>
        <p className="ax-hero-headline">
          From Jira ticket to reviewed PR. <em>Autonomously.</em>
        </p>
        <div className="ax-hero-purpose">
          <h2 className="ax-hero-purpose-title">{HERO.purposeTitle}</h2>
          <p>{HERO.purpose}</p>
        </div>
        <p className="ax-hero-subhead">{HERO.subhead}</p>
        <div className="ax-hero-ctas">
          <SmartLink href={HERO.primaryCta.href} className="ax-btn ax-btn-primary">
            {HERO.primaryCta.label}
          </SmartLink>
          <SmartLink href={HERO.secondaryCta.href} className="ax-btn ax-btn-secondary">
            {HERO.secondaryCta.label}
          </SmartLink>
        </div>
        <div className="ax-hero-note">{HERO.note}</div>
        <PipelineVisual />
      </div>
    </section>
  );
}
