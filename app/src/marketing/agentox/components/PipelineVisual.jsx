import { useEffect, useState } from "react";
import { PIPELINE_STAGES, PIPELINE_GATE_LABEL } from "../content";

const STEP_MS = 1700;
const HOLD_MS = 2600;

/** Animated Jira → Virin → Ananta → Neel → PR pipeline. */
export default function PipelineVisual() {
  const [active, setActive] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reduced) return undefined;
    const last = PIPELINE_STAGES.length - 1;
    const timer = setTimeout(
      () => setActive((i) => (i >= last ? 0 : i + 1)),
      active >= PIPELINE_STAGES.length - 1 ? HOLD_MS : STEP_MS
    );
    return () => clearTimeout(timer);
  }, [active, reduced]);

  const isActive = (i) => (reduced ? true : i <= active);

  return (
    <div className="ax-pipeline" role="img" aria-label="AgentOX pipeline: Jira ticket, Virin product agent, Ananta engineering agent, Neel QA agent, draft pull request, with a human gate between each stage">
      <div className="ax-pipeline-title">One ticket through the pipeline</div>
      <div className="ax-pipeline-track">
        {PIPELINE_STAGES.map((stage, i) => (
          <StageWithLink
            key={stage.id}
            stage={stage}
            index={i}
            activeState={isActive(i)}
            linkPassed={reduced ? true : i < active}
            isLast={i === PIPELINE_STAGES.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

function StageWithLink({ stage, index, activeState, linkPassed, isLast }) {
  return (
    <>
      <div className={`ax-pipeline-stage ${activeState ? "ax-active" : ""}`}>
        <div className="ax-stage-node">{stageGlyph(stage, index)}</div>
        <div className="ax-stage-text">
          <div className="ax-stage-label">{stage.label}</div>
          <div className="ax-stage-sub">{stage.sub}</div>
          <div className="ax-stage-detail">{stage.detail ?? "\u00a0"}</div>
        </div>
      </div>
      {!isLast && (
        <div className={`ax-pipeline-link ${linkPassed ? "ax-passed" : ""}`}>
          <div className="ax-link-line" />
          <div className="ax-link-gate">{PIPELINE_GATE_LABEL}</div>
        </div>
      )}
    </>
  );
}

function stageGlyph(stage, index) {
  if (stage.kind === "input") return "◈";
  if (stage.kind === "output") return "⇡";
  return stage.label.charAt(0);
}
