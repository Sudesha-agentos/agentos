import { Link } from "react-router-dom";
import { WorkBoardImportBar } from "../WorkBoard";
import { useWorkBoardStatus } from "../../../entities/work-board";
import LabelPill from "../../components/LabelPill";
import { SettingsPageShell } from "../../layout/SettingsPageShell";
import { useOrg } from "../../../shared/providers/OrgRouteProvider";
import { Panel, PanelHeader } from "../../../shared/ui/Panel";
import { useState } from "react";

export default function SpreadsheetIntegration({ embedded = false }) {
  const { orgPath } = useOrg();
  const { data, refetch } = useWorkBoardStatus({ pollMs: 10000 });
  const [error, setError] = useState("");
  const ready = Boolean(data?.ready);

  return (
    <SettingsPageShell
      embedded={embedded}
      kicker="Issue tracking"
      title="Spreadsheet / work board"
      info="Upload an Excel or CSV of tickets to get a Kanban board. Drag a card into AI Worker to run Virin without Jira."
    >
      <Panel>
        <PanelHeader
          kicker="Status"
          title="Work board"
          right={
            <LabelPill
              label={ready ? `${data.itemCount} tickets` : "Not set up"}
              tone={ready ? "success" : "muted"}
            />
          }
        />
        <div className="space-y-3 px-5 py-4 sm:px-6">
          <p className="text-sm text-app-ink-dim">
            For teams that do not use Jira. Import a spreadsheet, manage cards on the board, and
            start Virin from the AI Worker column.
          </p>
          <Link to={orgPath("board")} className="inline-flex text-sm font-medium text-indigo hover:underline">
            Open work board →
          </Link>
        </div>
      </Panel>

      {error ? (
        <p className="rounded-app-sm border border-danger/30 bg-danger/5 px-4 py-2.5 text-[13px] text-danger">
          {error}
        </p>
      ) : null}

      <WorkBoardImportBar
        onImported={() => {
          setError("");
          refetch();
        }}
        onError={setError}
      />
    </SettingsPageShell>
  );
}
