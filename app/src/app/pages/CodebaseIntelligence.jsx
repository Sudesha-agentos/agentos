import { useState } from "react";
import IndexProgressBar from "../../widgets/index-progress/IndexProgressBar";
import CodebaseIntelligenceStatusWidget from "../../widgets/codebase-intelligence-status/CodebaseIntelligenceStatusWidget";
import GitNexusExplorer from "../../features/gitnexus-explorer/GitNexusExplorer";
import { useGitIntegrationSetup } from "../../entities/git-integration";
import { useCodebaseLayerStatus } from "../../entities/codebase";
import { AnimatedAppPage } from "../../shared/ui/AnimatedAppPage";
import { AgentPageWithChat } from "../../widgets/agent-chat/AgentPageWithChat";
import { AgentPageHeader } from "../../widgets/agent-chat/AgentPageHeader";

export default function CodebaseIntelligence() {
  const { data: setup } = useGitIntegrationSetup({ pollMs: 30000 });
  const git = setup?.git;
  const gitBranch = git?.defaultBranch ?? "main";
  const { data: layerStatus } = useCodebaseLayerStatus({ branch: gitBranch, pollMs: 30000 });
  const branch = layerStatus?.repo?.defaultBranch ?? gitBranch;
  const connected =
    Boolean(setup?.connected) ||
    Boolean(layerStatus?.connected) ||
    Boolean(layerStatus?.ready);
  const [indexRunId, setIndexRunId] = useState(null);

  return (
    <AnimatedAppPage wide>
      <AgentPageWithChat domain="ananta" contextKey={branch}>
        <AgentPageHeader domain="ananta" />
        <CodebaseIntelligenceStatusWidget
          branch={branch}
          onIndexStarted={({ runId }) => setIndexRunId(runId)}
        />
        {connected ? (
          <IndexProgressBar
            runId={indexRunId ?? undefined}
            branch={branch}
            enabled
            title="Building Ananta Brain"
          />
        ) : null}

        {connected ? <GitNexusExplorer branch={branch} /> : null}
      </AgentPageWithChat>
    </AnimatedAppPage>
  );
}
