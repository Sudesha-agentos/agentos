import { lazy, Suspense } from "react";
import { SECTION_06 } from "../torusPageContent";

const RoiCalculatorPanel = lazy(
  () => import("../../../widgets/roi-calculator/RoiCalculatorPanel")
);

function RoiLoading() {
  return (
    <div className="roi-loading" role="status" aria-label="Loading calculator">
      <span className="roi-loading-dot" />
      Loading calculator…
    </div>
  );
}

export default function TorusRoiSection() {
  const { headline, intro } = SECTION_06;

  return (
    <div className="section section-reveal roi-wrap" data-reveal>
      <p className="roi-headline">{headline}</p>
      <p className="roi-intro">{intro}</p>
      <div className="roi-frame" data-reveal>
        <div className="roi-frame-titleblock">
          <span className="roi-frame-label">ESTIMATED ROI BY PLAN</span>
        </div>
        <div className="roi-frame-body app-theme">
          <Suspense fallback={<RoiLoading />}>
            <RoiCalculatorPanel initialPlanId="growth" publicMode />
          </Suspense>
        </div>
      </div>
      <p className="roi-footnote">
        Baseline hours, stage savings, and subscription caps are documented in model assumptions.
        Actual results vary by team, codebase complexity, and ticket quality.
      </p>
    </div>
  );
}
