import { useEffect } from "react";
import SmartLink from "./SmartLink";
import PipelineVisual from "./PipelineVisual";
import { HERO } from "../content";

export default function Hero() {
  useEffect(() => {
    document.title = "AgentOX";
  }, []);

  return (
    <section className="ax-hero">
      <div className="ax-container">
        <div className="ax-hero-badge">{HERO.badge}</div>
        <p className="ax-hero-welcome">{HERO.welcome}</p>
        <h1 className="ax-hero-app-name">{HERO.appName}</h1>
        <p className="ax-hero-headline">
          From Jira ticket to reviewed PR. <em>Autonomously.</em>
        </p>
        <div className="ax-hero-purpose">
          <p>
            <strong>AgentOX</strong> is an artificial intelligence automation tool designed to help
            developers create, manage, and optimize smart digital agents. Our system helps organize
            custom cloud tasks, streamline workspace productivity, and coordinate data flows from
            Jira tickets to reviewed pull requests.
          </p>
          <p className="ax-hero-google-note">{HERO.googleAuthNote}</p>
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
