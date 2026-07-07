import { lazy, Suspense, useRef } from "react";
import AgentChaptersSection from "../agent-team/components/AgentChaptersSection";
import IntegrationMarquee from "../agent-team/components/IntegrationMarquee";
import {
  MarketingDifferentiationSection,
  MarketingFaqSection,
  MarketingFinalCtaSection,
  MarketingHowItWorksSection,
  MarketingIntelligenceSection,
  MarketingPricingTableSection,
  MarketingProblemSection,
  MarketingSocialProofSection,
  MarketingSolutionSection,
} from "../agent-team/components/MarketingPageSections";
import { PRODUCT_PROOF_METRICS } from "../agent-team/constants";
import { PRICING } from "../agent-team/marketingPageContent";
import { useReducedMotion } from "../hooks/useReducedMotion";
import TorusAmbientRings from "./components/TorusAmbientRings";
import TorusBeyondSection from "./components/TorusBeyondSection";
import TorusConnector from "./components/TorusConnector";
import TorusFooter from "./components/TorusFooter";
import TorusHero from "./components/TorusHero";
import TorusMissionSection from "./components/TorusMissionSection";
import TorusNav from "./components/TorusNav";
import TorusWorkflowSection from "./components/TorusWorkflowSection";
import { useTorusReveal } from "./hooks/useTorusReveal";
import { SECTION_01, SECTION_02, SECTION_03, SECTION_04 } from "./torusPageContent";
import "./torusMarketing.css";
import "./torusLegacy.css";

const TorusPipelineMockup = lazy(() => import("./components/TorusPipelineMockup"));
const MarketingRoiCalculator = lazy(() =>
  import("../agent-team/components/MarketingPageSections").then((m) => ({
    default: m.MarketingRoiCalculator,
  }))
);
const DashboardCostEstimator = lazy(
  () => import("../../widgets/landing-dashboard/DashboardCostEstimator")
);

function LegacyBlock({ children, reveal = false, belowFold = false }) {
  return (
    <div
      className={`legacy-marketing ${reveal ? "section section-reveal" : ""} ${belowFold ? "marketing-below-fold" : ""}`}
      {...(reveal ? { "data-reveal": "" } : {})}
    >
      {children}
    </div>
  );
}

function SectionFallback({ height = "h-64" }) {
  return <div className={`at-card ${height} animate-pulse`} aria-hidden="true" />;
}

export default function TorusLandingPage() {
  const rootRef = useRef(null);
  const reducedMotion = useReducedMotion();
  useTorusReveal(rootRef);

  return (
    <div ref={rootRef} className="torus-marketing">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <TorusNav />
      <main id="main">
        {!reducedMotion ? <TorusAmbientRings /> : null}
        <div className="page">
          <div className="grid-patch grid-patch-hero revealed" aria-hidden="true" />
          <div className="grid-glow grid-glow-hero revealed" aria-hidden="true" />

          <TorusHero />

          <LegacyBlock>
            <IntegrationMarquee />
            <MarketingProblemSection />
            <MarketingSolutionSection />
          </LegacyBlock>

          <TorusConnector id={SECTION_01.id} label={SECTION_01.label} first />
          <div className="section marketing-below-fold">
            <Suspense fallback={<SectionFallback height="h-[420px]" />}>
              <TorusPipelineMockup />
            </Suspense>
          </div>

          <LegacyBlock reveal belowFold>
            <AgentChaptersSection />
          </LegacyBlock>

          <TorusConnector id={SECTION_02.id} label={SECTION_02.label} />
          <div className="marketing-below-fold">
            <TorusBeyondSection />
          </div>

          <LegacyBlock reveal belowFold>
            <MarketingDifferentiationSection />
            <MarketingIntelligenceSection />
          </LegacyBlock>

          <TorusConnector id={SECTION_03.id} label={SECTION_03.label} />
          <div className="marketing-below-fold">
            <TorusWorkflowSection />
          </div>

          <LegacyBlock reveal belowFold>
            <MarketingHowItWorksSection />
          </LegacyBlock>

          <TorusConnector id={SECTION_04.id} label={SECTION_04.label} />
          <div className="marketing-below-fold">
            <TorusMissionSection />
          </div>

          <LegacyBlock reveal belowFold>
            <MarketingSocialProofSection productMetrics={PRODUCT_PROOF_METRICS} />
            <Suspense fallback={<SectionFallback height="h-96" />}>
              <MarketingRoiCalculator />
            </Suspense>
            <section id="pricing" data-pricing className="px-5 py-20 sm:px-8">
              <div className="mx-auto max-w-5xl">
                <div className="mb-10 text-center">
                  <p className="t-section-kicker">{PRICING.kicker}</p>
                  <h2 className="mt-2 text-[clamp(1.75rem,3vw,2.5rem)] font-bold text-[#2B2D33]">
                    {PRICING.headline}
                  </h2>
                </div>
                <MarketingPricingTableSection />
                <p className="mt-8 text-center text-[13px] text-[#6B6B6B]">{PRICING.footnote}</p>
                <div className="mt-12">
                  <p className="mb-6 text-center text-[14px] font-medium text-[#2B2D33]">
                    Estimate your monthly cost
                  </p>
                  <Suspense fallback={<SectionFallback />}>
                    <DashboardCostEstimator variant="marketing" />
                  </Suspense>
                </div>
              </div>
            </section>
            <MarketingFaqSection />
            <MarketingFinalCtaSection />
          </LegacyBlock>
        </div>
      </main>
      <TorusFooter />
    </div>
  );
}
