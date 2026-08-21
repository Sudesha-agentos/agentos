import ExcelJS from "exceljs";
import { ValidationError } from "../utils/errors";
import { DEFAULT_COLUMNS, type ImportRowInput } from "./service";

const HEADER_ALIASES: Record<string, keyof Omit<ImportRowInput, "rowNumber" | "labels"> | "labels"> =
  {
    key: "key",
    id: "key",
    ticket: "key",
    "ticket key": "key",
    title: "title",
    summary: "title",
    name: "title",
    description: "description",
    details: "description",
    body: "description",
    status: "status",
    column: "status",
    stage: "status",
    type: "type",
    "issue type": "type",
    issuetype: "type",
    priority: "priority",
    assignee: "assignee",
    owner: "assignee",
    labels: "labels",
    tags: "labels",
  };

export type ParsedImport = {
  rows: ImportRowInput[];
  errors: string[];
  headers: string[];
  mapping: Record<string, string>;
};

function normHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[_]+/g, " ").replace(/\s+/g, " ");
}

function splitLabels(value: string): string[] {
  return value
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function cellText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value && "text" in (value as { text?: string })) {
    return String((value as { text?: string }).text ?? "").trim();
  }
  if (typeof value === "object" && value && "richText" in (value as { richText?: Array<{ text: string }> })) {
    return ((value as { richText?: Array<{ text: string }> }).richText ?? [])
      .map((t) => t.text)
      .join("")
      .trim();
  }
  return String(value).trim();
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(cur);
      cur = "";
      continue;
    }
    if (ch === "\n") {
      row.push(cur.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.length || row.length) {
    row.push(cur.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

function rowsFromMatrix(matrix: string[][]): ParsedImport {
  if (!matrix.length) {
    throw new ValidationError("The spreadsheet is empty.");
  }
  const headers = matrix[0].map((h) => h.trim());
  const mapping: Record<string, string> = {};
  const index: Partial<Record<string, number>> = {};
  headers.forEach((header, i) => {
    const alias = HEADER_ALIASES[normHeader(header)];
    if (alias) {
      mapping[header] = alias;
      index[alias] = i;
    }
  });
  if (index.title == null) {
    throw new ValidationError(
      'A Title (or Summary) column is required. Download the template and try again.'
    );
  }

  const rows: ImportRowInput[] = [];
  const errors: string[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const line = matrix[r] ?? [];
    const title = (line[index.title] ?? "").trim();
    const rowNumber = r + 1;
    if (!title) {
      if (line.some((c) => c.trim())) {
        errors.push(`Row ${rowNumber}: missing title`);
      }
      continue;
    }
    const labelsRaw = index.labels != null ? line[index.labels] ?? "" : "";
    rows.push({
      rowNumber,
      key: index.key != null ? line[index.key] : undefined,
      title,
      description: index.description != null ? line[index.description] : undefined,
      status: index.status != null ? line[index.status] : undefined,
      type: index.type != null ? line[index.type] : undefined,
      priority: index.priority != null ? line[index.priority] : undefined,
      assignee: index.assignee != null ? line[index.assignee] : undefined,
      labels: splitLabels(labelsRaw),
    });
  }

  if (!rows.length) {
    throw new ValidationError("No tickets found. Add a Title on each row.");
  }

  return { rows, errors, headers, mapping };
}

export async function parseSpreadsheetBuffer(
  buffer: Buffer,
  filename: string
): Promise<ParsedImport> {
  const name = filename.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    return rowsFromMatrix(parseCsv(buffer.toString("utf8")));
  }
  if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) {
    throw new ValidationError("Upload an .xlsx or .csv file.");
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new ValidationError("The spreadsheet has no sheets.");

  const matrix: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values = Array.isArray(row.values) ? row.values.slice(1) : [];
    matrix.push(values.map((v) => cellText(v)));
  });
  return rowsFromMatrix(matrix);
}

export async function buildTemplateXlsx(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AgentOX";
  const sheet = workbook.addWorksheet("Tickets");
  sheet.columns = [
    { header: "Key", key: "key", width: 12 },
    { header: "Title", key: "title", width: 36 },
    { header: "Description", key: "description", width: 48 },
    { header: "Status", key: "status", width: 16 },
    { header: "Type", key: "type", width: 12 },
    { header: "Priority", key: "priority", width: 12 },
    { header: "Assignee", key: "assignee", width: 18 },
    { header: "Labels", key: "labels", width: 20 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.addRow({
    key: "",
    title: "Add login with Google",
    description: "Users can sign in with Google OAuth.",
    status: "Backlog",
    type: "Task",
    priority: "High",
    assignee: "",
    labels: "auth, onboarding",
  });
  sheet.addRow({
    key: "",
    title: "Fix checkout total rounding",
    description: "Cart total sometimes off by one cent.",
    status: "AI Worker",
    type: "Bug",
    priority: "Medium",
    assignee: "",
    labels: "payments",
  });
  const statusCol = sheet.getColumn("status");
  statusCol.eachCell({ includeEmpty: true }, () => undefined);
  // Data validation on status column (rows 2–200)
  for (let r = 2; r <= 200; r++) {
    sheet.getCell(r, 4).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`"${DEFAULT_COLUMNS.map((c) => c.name).join(",")}"`],
    };
    sheet.getCell(r, 5).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"Task,Bug"'],
    };
  }
  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export function buildTemplateCsv(): string {
  const header = "Key,Title,Description,Status,Type,Priority,Assignee,Labels";
  const rows = [
    ',Add login with Google,Users can sign in with Google OAuth.,Backlog,Task,High,,"auth, onboarding"',
    ",Fix checkout total rounding,Cart total sometimes off by one cent.,AI Worker,Bug,Medium,,payments",
  ];
  return `${header}\n${rows.join("\n")}\n`;
}
