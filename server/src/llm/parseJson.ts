/** Recover a JSON object from model text that is fenced, truncated, or loosely formatted. */

function stripFences(raw: string): string {
  return String(raw ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/```(?:json)?\s*/gi, "")
    .replace(/```/g, "")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .trim();
}

function sliceObject(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  if (start >= 0) return text.slice(start);
  return text;
}

function stripTrailingCommas(text: string): string {
  return text.replace(/,\s*([}\]])/g, "$1");
}

export function closeTruncatedJson(text: string): string {
  let inString = false;
  let escape = false;
  const stack: string[] = [];
  for (const ch of text) {
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if (ch === "}" || ch === "]") stack.pop();
  }
  let out = text;
  if (inString) out += '"';
  out = out.replace(/,\s*$/, "");
  while (stack.length) out += stack.pop();
  return out;
}

export function recoverJsonText(raw: string): string {
  const cleaned = stripFences(raw);
  const sliced = sliceObject(cleaned);
  const candidates = [
    cleaned,
    sliced,
    stripTrailingCommas(sliced),
    closeTruncatedJson(stripTrailingCommas(sliced)),
  ];
  for (const candidate of candidates) {
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      /* try next */
    }
  }
  return sliced || cleaned;
}

export function tryParseJsonObject(raw: string): unknown | undefined {
  try {
    return JSON.parse(recoverJsonText(raw));
  } catch {
    return undefined;
  }
}

/** Find a JSON object that contains `"key"` even when the model dumped prose or code around it. */
export function extractJsonObjectByKey(raw: string, key: string): unknown | undefined {
  const text = String(raw ?? "");
  const needle = `"${key}"`;
  let from = 0;
  while (from < text.length) {
    const idx = text.indexOf(needle, from);
    if (idx < 0) return undefined;
    const start = text.lastIndexOf("{", idx);
    if (start >= 0) {
      const parsed = tryParseJsonObject(text.slice(start));
      if (parsed && typeof parsed === "object" && parsed !== null && key in parsed) {
        return parsed;
      }
    }
    from = idx + needle.length;
  }
  return undefined;
}
