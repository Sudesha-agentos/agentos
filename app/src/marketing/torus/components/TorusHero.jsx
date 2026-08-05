import { Link } from "react-router-dom";
import { BRAND, HERO } from "../torusPageContent";

export default function TorusHero() {
  return (
    <section className="hero">
      <div className="hero-brand">
        <p className="wordmark">{BRAND.name}</p>
        <div className="wordmark-sub">
          <div className="wordmark-sub-line" />
          {BRAND.tagline}
        </div>
      </div>
      <div className="hero-pitch">
        <h1 className="hero-headline">{HERO.headline}</h1>
        <p className="hero-description">{HERO.description}</p>
      </div>
      <div className="hero-cta">
        <Link to={HERO.primaryHref} state={{ mode: "signup" }} className="btn btn-primary">
          {HERO.primaryCta}
        </Link>
        <a href={HERO.secondaryHref} className="btn btn-secondary">
          {HERO.secondaryCta}
        </a>
      </div>
      <span className="cta-fallback">
        {HERO.fallback}{" "}
        <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a>
      </span>
    </section>
  );
}
