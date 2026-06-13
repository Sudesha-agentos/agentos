import { useRef } from "react";
import { Link } from "react-router-dom";
import { AGENTS, CLIENT_LOGOS, CLIENT_METRICS, HERO, HERO_STATS } from "./constants";
import HeroVisualization from "./components/HeroVisualization";
import IntegrationMarquee from "./components/IntegrationMarquee";
import SharedBrainRadial from "./components/SharedBrainRadial";
import { AgentIllustration } from "./components/AgentIllustration";
import MarketingFooter from "./components/MarketingFooter";
import MarketingHeader from "./components/MarketingHeader";
import { useLandingAnimations } from "./hooks/useLandingAnimations";
import "./agentTeam.css";

function GradientBars() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div data-parallax-bar className="absolute -left-[10%] top-[8%] h-64 w-[45%] rounded-[48px] bg-gradient-to-r from-[#A8C53A]/25 to-transparent blur-2xl" />
      <div data-parallax-bar className="absolute right-[5%] top-[22%] h-72 w-[38%] rounded-[48px] bg-gradient-to-l from-[#F2C94C]/30 to-transparent blur-2xl" />
      <div data-parallax-bar className="absolute bottom-[15%] left-[20%] h-56 w-[42%] rounded-[48px] bg-gradient-to-r from-[#D9B8E8]/35 to-transparent blur-2xl" />
    </div>
  );
}

function AgentSection({ agent, index }) {
  const gradClass =
    agent.gradient === "olive"
      ? "at-gradient-olive"
      : agent.gradient === "amber"
        ? "at-gradient-amber"
        : "at-gradient-lavender";
  const imageFirst = index % 2 === 1;

  return (
    <section
      id={agent.sectionId}
      data-agent-section={agent.id}
      className={`relative overflow-visible px-5 py-16 sm:px-8 sm:py-20 ${gradClass}`}
    >
      <div className="mx-auto grid max-w-5xl items-center gap-8 lg:grid-cols-2 lg:gap-12">
        <div
          className={`at-agent-figure flex justify-center ${imageFirst ? "lg:order-1" : "lg:order-2"}`}
          data-agent-avatar={agent.id}
        >
          <AgentIllustration agent={agent.id} size={240} />
        </div>
        <div className={`text-white ${imageFirst ? "lg:order-2" : "lg:order-1"}`} data-agent-copy={agent.id}>
          <p className="text-[12px] font-semibold uppercase tracking-widest text-white/70">
            {agent.number} · Teammate
          </p>
          <h2 className="mt-2 text-[clamp(1.75rem,3.5vw,2.5rem)] font-bold leading-tight">
            Meet {agent.name}
          </h2>
          <p className="mt-1 text-[13px] font-semibold uppercase tracking-wide text-white/80">
            {agent.role} · {agent.roleDetail}
          </p>
          <p className="mt-4 max-w-md text-[16px] leading-relaxed opacity-95">{agent.teammateIntro}</p>
          <p className="mt-3 max-w-md text-[14px] leading-relaxed opacity-85">{agent.body}</p>
          <ul className="mt-5 space-y-2">
            {agent.bullets.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-[14px] opacity-95">
                <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-white/25 text-[10px]">
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  const rootRef = useRef(null);
  useLandingAnimations(rootRef);

  return (
    <div ref={rootRef} className="agent-team min-h-screen">
      <MarketingHeader />
      <GradientBars />

      <section
        id="hero"
        data-hero
        className="relative flex min-h-[92vh] flex-col justify-center px-5 pt-24 pb-12 sm:px-8"
      >
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <div data-hero-copy>
            <div className="at-glass-badge inline-flex items-center gap-2 px-4 py-2 text-[12px] font-medium text-[#2B2D33]">
              <span className="size-2 animate-pulse rounded-full bg-[#A8C53A]" />
              {HERO.badge}
            </div>
            <h1 className="mt-6 text-[clamp(2rem,4.5vw,3.5rem)] font-bold leading-[1.06] text-[#2B2D33]">
              {HERO.headline}
            </h1>
            <p className="mt-5 max-w-lg text-[16px] leading-relaxed text-[#6B6B6B]">{HERO.subhead}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to={HERO.ctaHref} className="at-btn-charcoal inline-flex px-7 py-3.5 text-[15px] font-semibold">
                {HERO.cta}
              </Link>
              <a
                href={HERO.secondaryHref}
                className="at-pill inline-flex px-5 py-3 text-[14px] font-medium text-[#2B2D33] transition hover:bg-white"
              >
                {HERO.secondaryCta}
              </a>
            </div>
            <div className="mt-10 grid grid-cols-3 gap-3 border-t border-[#E8E4DE] pt-6">
              {HERO_STATS.map((stat) => (
                <div key={stat.label}>
                  <p className="font-[Poppins] text-2xl font-bold text-[#2B2D33]">{stat.value}</p>
                  <p className="mt-0.5 text-[12px] text-[#6B6B6B]">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-center lg:justify-end">
            <HeroVisualization />
          </div>
        </div>
      </section>

      <IntegrationMarquee />

      <div id="agents">
        {AGENTS.map((agent, index) => (
          <AgentSection key={agent.id} agent={agent} index={index} />
        ))}
      </div>

      <SharedBrainRadial />

      <section id="clients" data-clients className="px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-[clamp(1.75rem,3vw,2.5rem)] font-bold text-[#2B2D33]">
            Trusted by product teams running the full pipeline
          </h2>
          <div className="at-marquee mt-10 overflow-hidden">
            <div className="at-marquee-track flex w-max gap-12">
              {[...CLIENT_LOGOS, ...CLIENT_LOGOS].map((name, i) => (
                <span
                  key={`${name}-${i}`}
                  className="shrink-0 text-lg font-semibold text-[#6B6B6B]/40 transition hover:text-[#2B2D33]"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-3">
            {CLIENT_METRICS.map((m) => (
              <div key={m.label} data-client-metric className="at-card p-6 text-center">
                <p className="at-metric text-[#2B2D33]">{m.value}</p>
                <p className="mt-1 text-[14px] text-[#6B6B6B]">{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-24 sm:px-8" data-final-cta>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-[clamp(1.75rem,3.5vw,2.75rem)] font-bold text-[#2B2D33]">
            Create your account. Connect Jira. Ship.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[15px] text-[#6B6B6B]">
            Sign in or create a free workspace — Virin, Ananta, and Neel are ready for your first ticket.
          </p>
          <Link
            to="/login"
            state={{ mode: "signup" }}
            className="at-btn-charcoal mt-8 inline-flex px-8 py-4 text-[15px] font-semibold"
          >
            Get Started
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
