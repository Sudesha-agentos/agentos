import {
  applyColumnMappingFromSelection,
  getBoardColumnsOrdered,
} from "./boardColumnsService";
import { validateJiraConfig } from "./config";
import { jiraFetch } from "./jiraApiClient";
import {
  getPublicJiraCredentials,
  saveJiraCredentials,
} from "./jiraCredentialsStore";
import { getIntegrationMapping } from "./integrationConfigStore";

export async function connectJira(input: {
  baseUrl: string;
  email: string;
  apiToken?: string;
  boardId: string;
  webhookSecret?: string;
}) {
  saveJiraCredentials(input);
  validateJiraConfig();

  const boardId = input.boardId.trim();
  const board = (await jiraFetch(`/rest/agile/1.0/board/${boardId}`)) as {
    name?: string;
    location?: { projectName?: string; projectKey?: string };
  };

  const columns = await getBoardColumnsOrdered();

  let mapping = getIntegrationMapping();
  if (
    columns.length >= 2 &&
    !mapping.workingColumnName &&
    !mapping.nextColumnName
  ) {
    mapping = applyColumnMappingFromSelection({
      workingColumnName: columns[0].name,
      nextColumnName: columns[1].name,
      columns,
    });
  }

  return {
    connected: true,
    jira: getPublicJiraCredentials(),
    board: {
      id: boardId,
      name: board.name || `Board ${boardId}`,
      projectKey: board.location?.projectKey || null,
      projectName: board.location?.projectName || null,
    },
    columns,
    mapping,
  };
}
