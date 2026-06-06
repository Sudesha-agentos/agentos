import { useState } from "react";
import CodebaseVisualization from "../../features/codebase-viz/CodebaseVisualization";
import IndexProgressBar from "../../widgets/index-progress/IndexProgressBar";
import CodebaseIntelligenceStatusWidget from "../../widgets/codebase-intelligence-status/CodebaseIntelligenceStatusWidget";
import { useCodebaseLayerStatus } from "../../entities/codebase";
import { useGitIntegrationSetup } from "../../entities/git-integration";
import { PageIntro } from "../../shared/ui/Panel";

export default function CodebaseIntelligence() {
  const { data: setup } = useGitIntegrationSetup({ pollMs: 30000 });
  const git = setup?.git;
  const branch = git?.defaultBranch ?? "main";
  const connected = Boolean(setup?.connected);
  const [indexRunId, setIndexRunId] = useState(null);
  const { data: layerStatus } = useCodebaseLayerStatus({ branch, pollMs: 8000 });
  const vizRefreshKey =
    layerStatus?.graph?.computedAt ??
    layerStatus?.index?.lastCompletedAt ??
    layerStatus?.index?.lastIndexedAt ??
    null;

  return (
    <div className="mx-auto w-full max-w-[96rem] space-y-6">
      <PageIntro
        kicker="Codebase Intelligence"
        title="A living map of understanding"
        body="Five toggleable layers — structure, relationships, activity, quality, and AI-generated meaning. Built for seniors scanning heat and interns taking the guided tour."
      />
      <CodebaseIntelligenceStatusWidget
        branch={branch}
        onIndexStarted={({ runId }) => setIndexRunId(runId)}
      />
      {connected ? (
        <IndexProgressBar
          runId={indexRunId ?? undefined}
          branch={branch}
          enabled
          title="Building codebase map"
        />
      ) : null}
      {connected ? (
        <CodebaseVisualization branch={branch} refreshKey={vizRefreshKey} />
      ) : null}
    </div>
  );
}
