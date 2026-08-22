export interface DiffUnit {
  path: string;
  action: "create" | "modify" | "delete" | "rename";
  addedLines: number;
  symbols: string[];
  hunkPreview: string;
  isTest: boolean;
  isLockfile: boolean;
  isFormattingLikely: boolean;
}

const TEST_PATH =
  /(^|\/)(__tests__|tests?|spec|e2e|fixtures)(\/|$)|[._-](test|spec)\.[jt]sx?$/i;
const LOCKFILE = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb)$/i;
const FORMAT_ONLY = /\.(md|json|ya?ml|css|scss|svg)$/i;

const SYMBOL_RE =
  /(?:(?:export\s+)?(?:async\s+)?(?:function|class|const|let|var|type|interface|enum)\s+)([A-Za-z_][\w]*)/g;

export function isProductionPath(unit: DiffUnit): boolean {
  return !unit.isTest && !unit.isLockfile && !unit.isFormattingLikely;
}

export function parseDiffUnits(input: {
  diffText?: string;
  codeChanges?: Array<{
    filePath: string;
    action?: string;
    summary?: string;
    linesChanged?: number;
  }>;
  changedFiles?: Array<{ path: string; status?: string }>;
}): DiffUnit[] {
  const byPath = new Map<string, DiffUnit>();

  for (const change of input.codeChanges ?? []) {
    const path = change.filePath?.trim();
    if (!path) continue;
    byPath.set(path, makeUnit(path, change.action, change.linesChanged ?? 0, change.summary ?? ""));
  }

  for (const file of input.changedFiles ?? []) {
    const path = file.path?.trim();
    if (!path) continue;
    if (!byPath.has(path)) {
      byPath.set(path, makeUnit(path, file.status, 0, ""));
    }
  }

  if (input.diffText?.trim()) {
    applyUnifiedDiff(input.diffText, byPath);
  }

  return [...byPath.values()];
}

function makeUnit(
  path: string,
  actionRaw: string | undefined,
  addedLines: number,
  preview: string
): DiffUnit {
  const action = normalizeAction(actionRaw);
  return {
    path,
    action,
    addedLines,
    symbols: [],
    hunkPreview: preview.slice(0, 400),
    isTest: TEST_PATH.test(path),
    isLockfile: LOCKFILE.test(path),
    isFormattingLikely: FORMAT_ONLY.test(path) && !TEST_PATH.test(path),
  };
}

function normalizeAction(raw?: string): DiffUnit["action"] {
  const v = (raw ?? "modify").toLowerCase();
  if (v === "create" || v === "added" || v === "a" || v === "??") return "create";
  if (v === "delete" || v === "deleted" || v === "d") return "delete";
  if (v === "rename" || v === "renamed" || v === "r") return "rename";
  return "modify";
}

function applyUnifiedDiff(diffText: string, byPath: Map<string, DiffUnit>): void {
  const files = diffText.split(/^diff --git /m).filter(Boolean);
  for (const block of files) {
    const pathMatch =
      block.match(/\+\+\+\s+b\/(.+)$/m) ?? block.match(/^a\/.+\s+b\/(.+)$/m);
    const path = pathMatch?.[1]?.trim();
    if (!path || path === "/dev/null") continue;

    const added = (block.match(/^\+[^+]/gm) ?? []).length;
    const symbols = extractSymbols(block);
    const existing = byPath.get(path);
    if (existing) {
      existing.addedLines = Math.max(existing.addedLines, added);
      existing.symbols = unique([...existing.symbols, ...symbols]);
      existing.hunkPreview = existing.hunkPreview || block.slice(0, 400);
    } else {
      const unit = makeUnit(path, "modify", added, block.slice(0, 400));
      unit.symbols = symbols;
      byPath.set(path, unit);
    }
  }
}

function extractSymbols(block: string): string[] {
  const names: string[] = [];
  for (const line of block.split("\n")) {
    if (!line.startsWith("+") || line.startsWith("+++")) continue;
    SYMBOL_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = SYMBOL_RE.exec(line))) {
      names.push(match[1]!);
    }
  }
  return unique(names);
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
