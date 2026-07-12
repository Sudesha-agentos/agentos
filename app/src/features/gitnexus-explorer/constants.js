/** Node colors aligned with GitNexus web explorer. */
export const NODE_COLORS = {
  Project: "#a855f7",
  Package: "#8b5cf6",
  Module: "#7c3aed",
  Folder: "#6366f1",
  File: "#3b82f6",
  Class: "#f59e0b",
  Function: "#10b981",
  Method: "#14b8a6",
  Variable: "#64748b",
  Interface: "#ec4899",
  Enum: "#f97316",
  Type: "#a78bfa",
  Cluster: "#818cf8",
  Community: "#818cf8",
  Process: "#f43f5e",
  CodeElement: "#64748b",
};

export const NODE_SIZES = {
  Project: 18,
  Package: 14,
  Module: 12,
  Folder: 10,
  File: 7,
  Class: 8,
  Function: 5,
  Method: 4,
  Variable: 3,
  Interface: 7,
  Cluster: 12,
  Community: 12,
  Process: 8,
  Type: 4,
  CodeElement: 3,
};

export const EDGE_COLORS = {
  CALLS: "rgba(16, 185, 129, 0.45)",
  IMPORTS: "rgba(59, 130, 246, 0.35)",
  EXTENDS: "rgba(245, 158, 11, 0.5)",
  IMPLEMENTS: "rgba(236, 72, 153, 0.5)",
  CONTAINS: "rgba(99, 102, 241, 0.3)",
  MEMBER_OF: "rgba(129, 140, 248, 0.25)",
  CLUSTER_LINK: "rgba(139, 124, 246, 0.4)",
};

export function colorForKind(kind) {
  return NODE_COLORS[kind] || NODE_COLORS.CodeElement;
}

export function sizeForKind(kind, fallback = 6) {
  return NODE_SIZES[kind] ?? fallback;
}
