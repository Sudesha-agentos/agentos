import { inflateRawSync } from "zlib";
import { fetchJiraIssueByKey } from "../../jira-sync/issueFetcher";
import { getPipelineJiraClient } from "../../pipeline/jira/client";
import { logger } from "../../utils/logger";
import type { PmTicketInput } from "./types";

const TEXT_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".json",
  ".xml",
  ".html",
  ".htm",
  ".log",
  ".yaml",
  ".yml",
  ".rst",
  ".adoc",
]);

const MAX_ATTACHMENT_BYTES = 512_000;
const MAX_ATTACHMENTS = 4;
const MAX_ATTACHMENT_PROMPT_CHARS = 14_000;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}… [truncated]`;
}

function extensionOf(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx >= 0 ? filename.slice(idx).toLowerCase() : "";
}

function isLikelyTextAttachment(filename: string, mimeType: string): boolean {
  const ext = extensionOf(filename);
  if (TEXT_EXTENSIONS.has(ext)) return true;
  return mimeType.startsWith("text/") || mimeType.includes("json") || mimeType.includes("xml");
}

function extractPrintableFromBinary(buffer: Buffer): string {
  const raw = buffer.toString("latin1");
  const chunks = raw.match(/[\x20-\x7E\n\r\t]{20,}/g) ?? [];
  return chunks.join("\n").replace(/\s+/g, " ").trim();
}

function readZipEntry(buffer: Buffer, targetPath: string): Buffer | null {
  let offset = 0;
  while (offset + 30 <= buffer.length) {
    const sig = buffer.readUInt32LE(offset);
    if (sig !== 0x04034b50) break;

    const compressionMethod = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraFieldLength = buffer.readUInt16LE(offset + 28);

    const fileNameStart = offset + 30;
    const fileName = buffer.toString("utf8", fileNameStart, fileNameStart + fileNameLength);
    const dataStart = fileNameStart + fileNameLength + extraFieldLength;
    const dataEnd = dataStart + compressedSize;

    if (fileName.replace(/\\/g, "/") === targetPath) {
      const compressed = buffer.subarray(dataStart, dataEnd);
      if (compressionMethod === 0) return compressed;
      if (compressionMethod === 8) return inflateRawSync(compressed);
      return null;
    }

    offset = dataEnd;
  }
  return null;
}

function extractDocxText(buffer: Buffer): string {
  const xml = readZipEntry(buffer, "word/document.xml");
  if (!xml) return "";

  const parts: string[] = [];
  const re = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml.toString("utf8")))) {
    if (match[1]) parts.push(match[1]);
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function isDocxAttachment(filename: string, mimeType: string): boolean {
  return (
    extensionOf(filename) === ".docx" ||
    mimeType.includes("wordprocessingml") ||
    mimeType.includes("officedocument.wordprocessingml")
  );
}

async function readAttachmentText(
  attachment: { id: string; filename: string; mimeType: string; size: number }
): Promise<string | null> {
  if (attachment.size > MAX_ATTACHMENT_BYTES) {
    return `[File too large to inline (${Math.round(attachment.size / 1024)} KB): ${attachment.filename}]`;
  }

  try {
    const client = getPipelineJiraClient();
    const { buffer, mimeType } = await client.downloadAttachment(attachment.id);
    if (buffer.length > MAX_ATTACHMENT_BYTES) {
      return `[File too large after download (${Math.round(buffer.length / 1024)} KB): ${attachment.filename}]`;
    }

    if (isLikelyTextAttachment(attachment.filename, mimeType || attachment.mimeType)) {
      return buffer.toString("utf8").replace(/\u0000/g, "").trim();
    }

    if (isDocxAttachment(attachment.filename, mimeType || attachment.mimeType)) {
      const extracted = extractDocxText(buffer);
      if (extracted.length > 40) {
        return extracted;
      }
      return `[Word document attached — could not extract readable text: ${attachment.filename}]`;
    }

    if ((mimeType || attachment.mimeType).includes("pdf") || extensionOf(attachment.filename) === ".pdf") {
      const extracted = extractPrintableFromBinary(buffer);
      if (extracted.length > 80) {
        return extracted;
      }
      return `[PDF attached — text extraction yielded little content: ${attachment.filename}]`;
    }

    const extracted = extractPrintableFromBinary(buffer);
    if (extracted.length > 80) {
      return extracted;
    }

    return `[Binary attachment (${mimeType || attachment.mimeType}): ${attachment.filename}]`;
  } catch (err) {
    logger.warn({ err, attachment: attachment.filename }, "pm ticket: attachment read failed");
    return `[Could not read attachment: ${attachment.filename}]`;
  }
}

async function buildAttachmentsBlock(jiraKey: string): Promise<string> {
  try {
    const client = getPipelineJiraClient();
    const attachments = await client.listIssueAttachments(jiraKey);
    if (!attachments.length) {
      return "No file attachments on this Jira ticket.";
    }

    const parts: string[] = [];
    let usedChars = 0;

    for (const attachment of attachments.slice(0, MAX_ATTACHMENTS)) {
      const header = `--- ${attachment.filename} (${attachment.mimeType}, ${Math.round(attachment.size / 1024)} KB) ---`;
      const body = (await readAttachmentText(attachment)) ?? `[Unreadable: ${attachment.filename}]`;
      const block = `${header}\n${truncate(body, 4000)}`;
      if (usedChars + block.length > MAX_ATTACHMENT_PROMPT_CHARS) {
        parts.push("[Additional attachments omitted due to size limits]");
        break;
      }
      parts.push(block);
      usedChars += block.length;
    }

    if (attachments.length > MAX_ATTACHMENTS) {
      parts.push(
        `[${attachments.length - MAX_ATTACHMENTS} more attachment(s) not inlined: ${attachments
          .slice(MAX_ATTACHMENTS)
          .map((a) => a.filename)
          .join(", ")}]`
      );
    }

    return parts.join("\n\n");
  } catch (err) {
    logger.warn({ err, jiraKey }, "pm ticket: attachment list failed");
    return "Attachments unavailable (Jira not connected or fetch failed).";
  }
}

export function formatTicketPromptFields(ticket: PmTicketInput): Record<string, string> {
  return {
    ticket_summary: ticket.summary,
    ticket_description: ticket.description || "(empty description)",
    ticket_type: ticket.issueType,
    ticket_priority: ticket.priority,
    ticket_components: ticket.components.join(", ") || "none",
    ticket_labels: ticket.labels.join(", ") || "none",
    ticket_reporter: ticket.reporter || "unknown",
    ticket_status: ticket.status ?? "unknown",
    ticket_assignee: ticket.assignee ?? "unassigned",
    ticket_comments: ticket.commentsText?.trim() || "No comments on ticket.",
    ticket_attachments: ticket.attachmentsText?.trim() || "No file attachments on this Jira ticket.",
  };
}

export async function enrichTicketFromJira(jiraKey: string): Promise<PmTicketInput | null> {
  try {
    const fetched = await fetchJiraIssueByKey(jiraKey);
    if (!fetched) return null;

    const attachmentsText = await buildAttachmentsBlock(jiraKey);

    return {
      jiraKey: fetched.jiraKey,
      summary: fetched.summary,
      description: fetched.description,
      issueType: fetched.issueType,
      reporter: fetched.reporter ?? "Unknown",
      labels: fetched.labels,
      components: fetched.components,
      createdDate: fetched.jiraUpdatedAt?.toISOString() ?? new Date().toISOString(),
      priority: fetched.priority ?? "Medium",
      status: fetched.status,
      assignee: fetched.assignee ?? undefined,
      commentsText: fetched.commentsText,
      attachmentsText,
    };
  } catch (err) {
    logger.warn({ err, jiraKey }, "pm ticket: enrich from Jira failed");
    return null;
  }
}
