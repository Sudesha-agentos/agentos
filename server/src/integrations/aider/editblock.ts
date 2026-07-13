/**
 * TypeScript port of Aider SEARCH/REPLACE edit matching.
 * Source of truth (Apache-2.0): server/vendor/aider/editblock_coder.py
 * https://github.com/Aider-AI/aider
 *
 * Ported: do_replace / replace_most_similar_chunk / find_original_update_blocks
 * (whitespace-tolerant + ellipsis chunks). Fuzzy edit-distance fallback omitted
 * for simplicity — exact + whitespace + ... cover the common cases.
 */

export type AiderEdit = {
  filePath: string;
  search: string;
  replace: string;
};

const HEAD = /^<{5,9} SEARCH>?\s*$/;
const DIVIDER = /^={5,9}\s*$/;
const UPDATED = /^>{5,9} REPLACE\s*$/;

function prep(content: string): { content: string; lines: string[] } {
  let c = content ?? "";
  if (c && !c.endsWith("\n")) c += "\n";
  return { content: c, lines: c.split(/(?<=\n)/) };
}

function perfectReplace(
  wholeLines: string[],
  partLines: string[],
  replaceLines: string[]
): string | null {
  const partLen = partLines.length;
  for (let i = 0; i <= wholeLines.length - partLen; i++) {
    let match = true;
    for (let j = 0; j < partLen; j++) {
      if (wholeLines[i + j] !== partLines[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      return [...wholeLines.slice(0, i), ...replaceLines, ...wholeLines.slice(i + partLen)].join("");
    }
  }
  return null;
}

function matchButForLeadingWhitespace(
  wholeChunk: string[],
  partLines: string[]
): string | null {
  const num = wholeChunk.length;
  for (let i = 0; i < num; i++) {
    if (wholeChunk[i]!.trimStart() !== partLines[i]!.trimStart()) return null;
  }
  const prefixes = new Set<string>();
  for (let i = 0; i < num; i++) {
    if (!wholeChunk[i]!.trim()) continue;
    const stripped = partLines[i]!.trimStart();
    prefixes.add(wholeChunk[i]!.slice(0, wholeChunk[i]!.length - stripped.length));
  }
  if (prefixes.size !== 1) return null;
  return [...prefixes][0] ?? "";
}

function replacePartWithMissingLeadingWhitespace(
  wholeLines: string[],
  partLines: string[],
  replaceLines: string[]
): string | null {
  const leading = [
    ...partLines.filter((p) => p.trim()).map((p) => p.length - p.trimStart().length),
    ...replaceLines.filter((p) => p.trim()).map((p) => p.length - p.trimStart().length),
  ];
  let workPart = partLines;
  let workReplace = replaceLines;
  if (leading.length && Math.min(...leading) > 0) {
    const n = Math.min(...leading);
    workPart = partLines.map((p) => (p.trim() ? p.slice(n) : p));
    workReplace = replaceLines.map((p) => (p.trim() ? p.slice(n) : p));
  }

  const numPart = workPart.length;
  for (let i = 0; i <= wholeLines.length - numPart; i++) {
    const addLeading = matchButForLeadingWhitespace(
      wholeLines.slice(i, i + numPart),
      workPart
    );
    if (addLeading == null) continue;
    const fixedReplace = workReplace.map((r) => (r.trim() ? addLeading + r : r));
    return [...wholeLines.slice(0, i), ...fixedReplace, ...wholeLines.slice(i + numPart)].join(
      ""
    );
  }
  return null;
}

function tryDotDotDots(whole: string, part: string, replace: string): string | null {
  const dotsRe = /(^\s*\.\.\.\n)/gm;
  const partPieces = part.split(dotsRe);
  const replacePieces = replace.split(dotsRe);
  if (partPieces.length !== replacePieces.length) {
    throw new Error("Unpaired ... in SEARCH/REPLACE block");
  }
  if (partPieces.length === 1) return null;

  for (let i = 1; i < partPieces.length; i += 2) {
    if (partPieces[i] !== replacePieces[i]) {
      throw new Error("Unmatched ... in SEARCH/REPLACE block");
    }
  }

  const parts = partPieces.filter((_, i) => i % 2 === 0);
  const reps = replacePieces.filter((_, i) => i % 2 === 0);
  let result = whole;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]!;
    const r = reps[i]!;
    if (!p && !r) continue;
    if (!p && r) {
      if (!result.endsWith("\n")) result += "\n";
      result += r;
      continue;
    }
    const count = result.split(p).length - 1;
    if (count !== 1) throw new Error("ellipsis chunk match failed");
    result = result.replace(p, r);
  }
  return result;
}

/** Best-effort replace of `search` with `replace` inside `whole` (Aider algorithm). */
export function replaceMostSimilarChunk(
  whole: string,
  search: string,
  replace: string
): string | null {
  const { lines: wholeLines } = prep(whole);
  const { content: part, lines: partLines } = prep(search);
  const { content: repl, lines: replaceLines } = prep(replace);

  let res = perfectReplace(wholeLines, partLines, replaceLines);
  if (res) return res;

  res = replacePartWithMissingLeadingWhitespace(wholeLines, partLines, replaceLines);
  if (res) return res;

  if (partLines.length > 2 && !partLines[0]!.trim()) {
    res = perfectReplace(wholeLines, partLines.slice(1), replaceLines);
    if (res) return res;
    res = replacePartWithMissingLeadingWhitespace(wholeLines, partLines.slice(1), replaceLines);
    if (res) return res;
  }

  try {
    const dotted = tryDotDotDots(whole, part, repl);
    if (dotted) return dotted;
  } catch {
    /* ignore */
  }

  return null;
}

export function applyAiderReplace(
  content: string | null,
  search: string,
  replace: string
): string | null {
  if (content == null) return null;
  if (!search.trim()) {
    return content + (replace.endsWith("\n") ? replace : `${replace}\n`);
  }
  return replaceMostSimilarChunk(content, search, replace);
}

/**
 * Parse Aider-style SEARCH/REPLACE blocks from model text.
 * Yields { filePath, search, replace }.
 */
export function parseAiderEditBlocks(content: string): AiderEdit[] {
  const lines = content.split(/(?<=\n)/);
  const edits: AiderEdit[] = [];
  let i = 0;
  let currentFilename: string | null = null;

  while (i < lines.length) {
    const line = lines[i]!.replace(/\r?\n$/, "");
    if (!HEAD.test(line.trim())) {
      i += 1;
      continue;
    }

    // filename: look back up to 3 lines
    let filename: string | null = null;
    for (let b = 1; b <= 3 && i - b >= 0; b++) {
      const prev = lines[i - b]!.replace(/\r?\n$/, "").trim();
      if (!prev || prev.startsWith("```")) continue;
      const cleaned = prev.replace(/^#+\s*/, "").replace(/:`*$/, "").replace(/^`+|`+$/g, "");
      if (cleaned.includes(".") || cleaned.includes("/")) {
        filename = cleaned;
        break;
      }
    }
    if (!filename) filename = currentFilename;
    if (!filename) {
      throw new Error("Bad/missing filename before SEARCH block");
    }
    currentFilename = filename;

    const original: string[] = [];
    i += 1;
    while (i < lines.length && !DIVIDER.test(lines[i]!.replace(/\r?\n$/, "").trim())) {
      original.push(lines[i]!);
      i += 1;
    }
    if (i >= lines.length || !DIVIDER.test(lines[i]!.replace(/\r?\n$/, "").trim())) {
      throw new Error("Expected ======= divider");
    }

    const updated: string[] = [];
    i += 1;
    while (
      i < lines.length &&
      !UPDATED.test(lines[i]!.replace(/\r?\n$/, "").trim()) &&
      !DIVIDER.test(lines[i]!.replace(/\r?\n$/, "").trim())
    ) {
      updated.push(lines[i]!);
      i += 1;
    }
    if (i >= lines.length) {
      throw new Error("Expected >>>>>>> REPLACE");
    }

    edits.push({
      filePath: filename.replace(/\\/g, "/"),
      search: original.join(""),
      replace: updated.join(""),
    });
    i += 1;
  }

  return edits;
}
