import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Spinner from "../components/Spinner";
import StatusPill from "../components/StatusPill";
import { usePipelineDetail } from "../../entities/pipeline";
import { useSubmitOverride } from "../../features/submit-override/model/useSubmitOverride";
import { formatStageLabel } from "../../shared/lib/format";
import { PageIntro } from "../../shared/ui/Panel";
import { AnimatedAppPage } from "../../shared/ui/AnimatedAppPage";
import OverrideEditorWidget from "../../widgets/override-editor/OverrideEditorWidget";
import ValidationPanelWidget from "../../widgets/validation-panel/ValidationPanelWidget";
import { useOrg } from "../../shared/providers/OrgRouteProvider";

const GATE_STAGES = new Set([
  "PRD_VALIDATION",
  "IMPLEMENTATION_VALIDATION",
  "QA_VALIDATION",
]);

export default function Override() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { orgPath } = useOrg();
  const { item, loading } = usePipelineDetail(id);
  const { submit, pending } = useSubmitOverride();

  const pausedStage = useMemo(() => {
    const awaiting = item?.stages?.find((s) => s.status === "AWAITING_HUMAN");
    if (awaiting && GATE_STAGES.has(awaiting.stage)) return awaiting;
    const current = item?.stages?.find((s) => s.stage === item.currentStage);
    if (current && GATE_STAGES.has(current.stage)) return current;
    return item?.stages?.find((s) => GATE_STAGES.has(s.stage)) ?? null;
  }, [item]);

  const originalStage = useMemo(() => {
    if (!item || !pausedStage) return null;
    const prior = {
      PRD_VALIDATION: "PRODUCT_AGENT",
      IMPLEMENTATION_VALIDATION: "ENGINEERING_AGENT",
      QA_VALIDATION: "QA_AGENT",
    }[pausedStage.stage];
    return item.stages.find((s) => s.stage === prior) ?? pausedStage;
  }, [item, pausedStage]);

  const [draft, setDraft] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  const [seededStageId, setSeededStageId] = useState(null);
  if (originalStage && originalStage.id !== seededStageId) {
    setSeededStageId(originalStage.id);
    if (originalStage.output && !draft) {
      setDraft(JSON.stringify(originalStage.output, null, 2));
    }
  }

  if (loading && !item) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner label="Loading pipeline" />
      </div>
    );
  }

  async function onSubmit(event) {
    event.preventDefault();
    setError(null);
    if (!pausedStage || !GATE_STAGES.has(pausedStage.stage)) {
      setError("Override can only be recorded on PRD, implementation, or QA gates.");
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(draft);
    } catch {
      setError("Corrected output must be valid JSON.");
      return;
    }
    if (!reviewer.trim()) {
      setError("Please enter your name so the override is attributed.");
      return;
    }
    try {
      await submit(id, {
        stage: pausedStage.stage,
        correctedOutput: parsed,
        overriddenBy: reviewer.trim(),
        reason: reason.trim() || undefined,
      });
      setSubmitted(true);
      window.setTimeout(() => navigate(orgPath("pipelines", id)), 1400);
    } catch (e) {
      setError(e?.message ?? "Override submission failed.");
    }
  }

  return (
    <AnimatedAppPage wide>
      <header className="flex flex-col gap-2">
        <Link
          to={orgPath("pipelines", id)}
          className="type-kicker transition-colors hover:text-app-ink"
        >
          ← pipeline
        </Link>
        <PageIntro
          kicker="Override"
          title={`Resume ${pausedStage ? formatStageLabel(pausedStage.stage) : "the paused gate"}.`}
          right={<StatusPill status={item?.status} />}
        />
      </header>

      {pausedStage?.validationResult ? (
        <ValidationPanelWidget validation={pausedStage.validationResult} />
      ) : null}

      <OverrideEditorWidget
        originalStageLabel={
          originalStage ? formatStageLabel(originalStage.stage) : "Agent output"
        }
        originalOutput={
          originalStage?.output
            ? JSON.stringify(originalStage.output, null, 2)
            : ""
        }
        draft={draft}
        onDraftChange={setDraft}
        reviewer={reviewer}
        onReviewerChange={setReviewer}
        reason={reason}
        onReasonChange={setReason}
        error={error}
        pending={pending}
        submitted={submitted}
        onSubmit={onSubmit}
      />
    </AnimatedAppPage>
  );
}
