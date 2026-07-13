import type Anthropic from "@anthropic-ai/sdk";

export const ENGINEERING_CODING_TOOL_DEFINITIONS: Anthropic.Tool[] = [
  // ── Navigation ────────────────────────────────────────────────────────────
  {
    name: "list_dir",
    description: `
List the contents of a directory in the workspace.
Use to navigate the repository structure before reading or editing files.
Returns file names (plain) and directory names (trailing /).
    `.trim(),
    input_schema: {
      type: "object" as const,
      properties: {
        dir_path: {
          type: "string",
          description: "Relative path to the directory (empty string for repo root)",
        },
      },
      required: [],
    },
  },

  // ── Reading ────────────────────────────────────────────────────────────────
  {
    name: "read_file",
    description: `
Read the complete contents of a file from the workspace.
Always call this on any existing file before editing it.
    `.trim(),
    input_schema: {
      type: "object" as const,
      properties: {
        file_path: { type: "string", description: "Repo-relative file path" },
      },
      required: ["file_path"],
    },
  },

  // ── Search ─────────────────────────────────────────────────────────────────
  {
    name: "search_codebase",
    description: `
Semantic search of the indexed codebase — returns ranked files with summaries, import
graphs, patterns, and a content preview. Use for conceptual queries like
"where is auth enforced" or "find the email service".
    `.trim(),
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string" },
        filter_patterns: {
          type: "array",
          items: { type: "string" },
          description: "Optional file-path substrings to narrow results",
        },
      },
      required: ["query"],
    },
  },

  {
    name: "grep",
    description: `
Fast literal text search over every file in the workspace.
Use for exact symbol names, import paths, or known string patterns.
More precise than search_codebase for exact matches.
    `.trim(),
    input_schema: {
      type: "object" as const,
      properties: {
        pattern: { type: "string", description: "Exact string to search for" },
        file_glob: {
          type: "string",
          description: "Optional glob to restrict files, e.g. '*.ts' or '*.tsx'",
        },
      },
      required: ["pattern"],
    },
  },

  // ── Editing ────────────────────────────────────────────────────────────────
  {
    name: "edit_file",
    description: `
Apply an exact string replacement to an existing file (Aider-compatible matching).
Prefer this over write_file when modifying an existing file — it is safer and
shows the reviewer exactly what changed.
The old_string must match verbatim when possible (including whitespace).
If exact match fails, AgentOX applies Aider whitespace-tolerant SEARCH/REPLACE matching.
To delete a block, set new_string to an empty string.
    `.trim(),
    input_schema: {
      type: "object" as const,
      properties: {
        file_path: { type: "string", description: "Repo-relative path of the file to edit" },
        old_string: {
          type: "string",
          description: "Exact text to find in the file (must be unique within the file)",
        },
        new_string: {
          type: "string",
          description: "Text to replace old_string with (empty string to delete)",
        },
        summary: {
          type: "string",
          description: "One-line description of what this edit does",
        },
      },
      required: ["file_path", "old_string", "new_string", "summary"],
    },
  },

  {
    name: "apply_aider_edits",
    description: `
Apply one or more Aider-format SEARCH/REPLACE blocks in a single call.
Pass either \`blocks\` (structured) or \`raw\` text containing:

path/to/file.ext
<<<<<<< SEARCH
old code
=======
new code
>>>>>>> REPLACE

Use for coordinated multi-file Mentat-style changes.
    `.trim(),
    input_schema: {
      type: "object" as const,
      properties: {
        raw: {
          type: "string",
          description: "Raw Aider SEARCH/REPLACE text (optional if blocks provided)",
        },
        blocks: {
          type: "array",
          description: "Structured edit blocks",
          items: {
            type: "object",
            properties: {
              file_path: { type: "string" },
              search: { type: "string" },
              replace: { type: "string" },
            },
            required: ["file_path", "search", "replace"],
          },
        },
        summary: { type: "string", description: "What this batch of edits achieves" },
      },
      required: ["summary"],
    },
  },

  {
    name: "get_file_symbols",
    description: `
Tree-sitter / AST symbol outline for a file (functions, classes, methods).
Call before editing unfamiliar files — mini-SWE ACI style: understand structure first.
    `.trim(),
    input_schema: {
      type: "object" as const,
      properties: {
        file_path: { type: "string", description: "Repo-relative file path" },
      },
      required: ["file_path"],
    },
  },

  {
    name: "write_source_file",
    description: `
Alias for write_file — write the complete content of a documentation or source file.
Use a repo-relative file_path (e.g. docs/curriculum/guide.md).
    `.trim(),
    input_schema: {
      type: "object" as const,
      properties: {
        file_path: { type: "string", description: "Repo-relative path of the file to create or replace" },
        path: { type: "string", description: "Alias for file_path" },
        content: { type: "string", description: "Full file content" },
        summary: {
          type: "string",
          description: "One-line description of what this file is",
        },
      },
      required: ["file_path", "content", "summary"],
    },
  },

  {
    name: "write_file",
    description: `
Write the complete content of a file.
Use to CREATE a new file that does not exist yet.
For modifying existing files, prefer edit_file instead.
    `.trim(),
    input_schema: {
      type: "object" as const,
      properties: {
        file_path: { type: "string", description: "Repo-relative path of the file to create" },
        path: { type: "string", description: "Alias for file_path" },
        content: { type: "string", description: "Full file content" },
        summary: {
          type: "string",
          description: "One-line description of what this file is",
        },
      },
      required: ["file_path", "content", "summary"],
    },
  },

  {
    name: "delete_file",
    description: `
Delete a file from the workspace.
Use only when a file is no longer needed (e.g., removing a deprecated module).
    `.trim(),
    input_schema: {
      type: "object" as const,
      properties: {
        file_path: { type: "string", description: "Repo-relative path of the file to delete" },
        reason: { type: "string", description: "Why this file is being deleted" },
      },
      required: ["file_path", "reason"],
    },
  },

  // ── Commands ───────────────────────────────────────────────────────────────
  {
    name: "run_command",
    description: `
Run an allowlisted command inside the workspace to verify your changes.
Allowlisted prefixes: npm run, npm test, npx tsc, npx eslint, npx prettier,
  node, tsc, eslint, prettier, git status, git diff, git log --oneline.
Use to run the type-checker or tests after editing, then fix errors in-loop.
    `.trim(),
    input_schema: {
      type: "object" as const,
      properties: {
        command: {
          type: "string",
          description: "Shell command to run (must start with an allowed prefix)",
        },
        working_dir: {
          type: "string",
          description: "Sub-directory within the repo to run the command in (e.g. 'server')",
        },
      },
      required: ["command"],
    },
  },
];
