import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Link } from "react-router-dom";
import {
  confirmWorkBoardImport,
  createWorkItem,
  downloadWorkBoardTemplate,
  previewWorkBoardImport,
  startWorkItemIntake,
  updateWorkItem,
  useWorkBoard,
} from "../../entities/work-board";
import { AGENT_NAMES } from "../../shared/config/app";
import { useOrg } from "../../shared/providers/OrgRouteProvider";
import { AnimatedAppPage } from "../../shared/ui/AnimatedAppPage";
import { PageIntro, Panel, PanelHeader } from "../../shared/ui/Panel";
import EmptyState from "../components/EmptyState";
import Spinner from "../components/Spinner";

function colDropId(columnId) {
  return `col:${columnId}`;
}

export default function WorkBoard() {
  const { orgPath } = useOrg();
  const { data, loading, error, refetch } = useWorkBoard({ pollMs: 12000 });
  const [selectedId, setSelectedId] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const columns = data?.columns ?? [];
  const items = useMemo(() => columns.flatMap((c) => c.items ?? []), [columns]);
  const selected = items.find((i) => i.id === selectedId) ?? null;
  const activeItem = items.find((i) => i.id === activeId) ?? null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  async function refresh() {
    await refetch();
  }

  async function handleDragEnd(event) {
    const { active, over } = event;
    setActiveId(null);
    if (!over || !data) return;
    const item = items.find((i) => i.id === active.id);
    if (!item) return;

    let destColumnId = item.columnId;
    if (String(over.id).startsWith("col:")) {
      destColumnId = String(over.id).slice(4);
    } else {
      const overItem = items.find((i) => i.id === over.id);
      if (overItem) destColumnId = overItem.columnId;
    }
    if (destColumnId === item.columnId) return;

    const dest = columns.find((c) => c.id === destColumnId);
    setBusy(true);
    setErrorMsg("");
    try {
      await updateWorkItem(item.id, { columnId: destColumnId });
      if (dest?.isIntake) {
        await startWorkItemIntake(item.id);
        setMessage(`${item.key} moved to AI Worker — ${AGENT_NAMES.VIRIN} is starting.`);
      }
      await refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Could not move card");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatedAppPage wide>
      <PageIntro
        kicker="Work board"
        title="Tickets without Jira"
        right={
          <Link
            to={orgPath("settings", "integrations", "spreadsheet")}
            className="rounded-full border border-app-border bg-app-surface px-3.5 py-1.5 text-[12px] text-app-ink-dim transition-colors hover:text-app-ink"
          >
            Spreadsheet setup
          </Link>
        }
      />

      <WorkBoardImportBar
        onImported={async (result) => {
          setMessage(
            `Imported ${result.created} new and ${result.updated} updated tickets` +
              (result.intake?.started
                ? ` · ${result.intake.started} started in AI Worker`
                : "")
          );
          await refresh();
        }}
        onError={setErrorMsg}
      />

      {errorMsg ? (
        <p className="rounded-app-sm border border-danger/30 bg-danger/5 px-4 py-2.5 text-[13px] text-danger">
          {errorMsg}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-app-sm border border-app-border bg-app-surface-muted/40 px-4 py-2.5 text-[13px] text-app-ink-dim">
          {message}
        </p>
      ) : null}

      {loading && !data ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : error && !data ? (
        <EmptyState title="Could not load work board" body={error.message} />
      ) : (
        <div className="flex min-h-[32rem] gap-4">
          <div className="min-w-0 flex-1 overflow-x-auto pb-2">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={({ active }) => setActiveId(active.id)}
              onDragCancel={() => setActiveId(null)}
              onDragEnd={handleDragEnd}
            >
              <div className="flex min-h-[30rem] gap-3">
                {columns.map((column) => (
                  <BoardColumn
                    key={column.id}
                    column={column}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    onAdd={async (summary) => {
                      setBusy(true);
                      setErrorMsg("");
                      try {
                        const created = await createWorkItem({
                          summary,
                          columnId: column.id,
                        });
                        await refresh();
                        setSelectedId(created.id);
                      } catch (err) {
                        setErrorMsg(err instanceof Error ? err.message : "Could not add card");
                      } finally {
                        setBusy(false);
                      }
                    }}
                  />
                ))}
              </div>
              <DragOverlay>
                {activeItem ? <BoardCard item={activeItem} overlay /> : null}
              </DragOverlay>
            </DndContext>
          </div>
          {selected ? (
            <ItemDrawer
              key={selected.id}
              item={selected}
              busy={busy}
              orgPath={orgPath}
              onClose={() => setSelectedId(null)}
              onSave={async (patch) => {
                setBusy(true);
                setErrorMsg("");
                try {
                  await updateWorkItem(selected.id, patch);
                  await refresh();
                } catch (err) {
                  setErrorMsg(err instanceof Error ? err.message : "Could not save card");
                } finally {
                  setBusy(false);
                }
              }}
              onAnalyze={async () => {
                setBusy(true);
                setErrorMsg("");
                try {
                  await startWorkItemIntake(selected.id);
                  setMessage(`${selected.key} sent to ${AGENT_NAMES.VIRIN}.`);
                  await refresh();
                } catch (err) {
                  setErrorMsg(err instanceof Error ? err.message : "Could not start Virin");
                } finally {
                  setBusy(false);
                }
              }}
            />
          ) : null}
        </div>
      )}
    </AnimatedAppPage>
  );
}

export function WorkBoardImportBar({ onImported, onError, compact = false }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(next) {
    setFile(next);
    setPreview(null);
    if (!next) return;
    setBusy(true);
    try {
      const data = await previewWorkBoardImport(next);
      setPreview(data);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Could not read spreadsheet");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm() {
    if (!file) return;
    setBusy(true);
    try {
      const result = await confirmWorkBoardImport(file);
      setPreview(null);
      setFile(null);
      onImported?.(result);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <PanelHeader kicker="Spreadsheet" title="Import tickets" />
      <div className={`flex flex-col gap-4 px-5 py-4 sm:px-6 ${compact ? "" : ""}`}>
        <div className="flex flex-wrap items-center gap-3">
          <label className="app-btn-primary cursor-pointer">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
            {busy ? "Reading…" : "Upload Excel or CSV"}
          </label>
          <button
            type="button"
            className="rounded-full border border-app-border bg-app-surface px-4 py-2 text-sm font-medium text-app-ink"
            onClick={() => downloadWorkBoardTemplate("xlsx").catch((err) => onError?.(err.message))}
          >
            Download template
          </button>
          <button
            type="button"
            className="text-sm font-medium text-indigo hover:underline"
            onClick={() => downloadWorkBoardTemplate("csv").catch((err) => onError?.(err.message))}
          >
            CSV instead
          </button>
        </div>
        <p className="text-[13px] text-app-ink-dim">
          Columns: Title (required), Description, Status, Type (Task/Bug), Priority, Assignee, Labels.
          Optional Key (WB-12) updates an existing card. Status <strong>AI Worker</strong> starts Virin
          after import.
        </p>
        {preview ? (
          <div className="rounded-app-sm border border-app-border bg-app-surface-muted/40 px-4 py-3">
            <p className="text-sm text-app-ink">
              {preview.count} ticket{preview.count === 1 ? "" : "s"} ready from {preview.filename}
            </p>
            {preview.errors?.length ? (
              <ul className="mt-2 list-disc pl-5 text-[12px] text-warning">
                {preview.errors.slice(0, 5).map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            ) : null}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={busy}
                className="app-btn-primary disabled:opacity-50"
                onClick={handleConfirm}
              >
                {busy ? "Importing…" : "Confirm import"}
              </button>
              <button
                type="button"
                className="rounded-full border border-app-border px-4 py-2 text-sm"
                onClick={() => {
                  setPreview(null);
                  setFile(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

function BoardColumn({ column, selectedId, onSelect, onAdd }) {
  const { setNodeRef, isOver } = useDroppable({ id: colDropId(column.id) });
  const ids = (column.items ?? []).map((i) => i.id);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");

  return (
    <section
      className={`flex w-64 shrink-0 flex-col rounded-app border bg-app-surface-muted/40 ${
        column.isIntake ? "border-indigo/40" : "border-app-border"
      } ${isOver ? "ring-2 ring-indigo/30" : ""}`}
    >
      <header className="flex items-center justify-between gap-2 border-b border-app-border px-3 py-2.5">
        <div>
          <h3 className="text-[13px] font-semibold text-app-ink">{column.name}</h3>
          {column.isIntake ? (
            <p className="text-[10px] uppercase tracking-wider text-indigo">Starts Virin</p>
          ) : null}
        </div>
        <span className="rounded-full bg-app-surface px-2 py-0.5 text-[11px] text-app-ink-mute">
          {column.items?.length ?? 0}
        </span>
      </header>
      <div ref={setNodeRef} className="flex min-h-[12rem] flex-1 flex-col gap-2 overflow-y-auto p-2">
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {(column.items ?? []).map((item) => (
            <SortableCard
              key={item.id}
              item={item}
              selected={item.id === selectedId}
              onSelect={() => onSelect(item.id)}
            />
          ))}
        </SortableContext>
      </div>
      <div className="border-t border-app-border p-2">
        {adding ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const summary = title.trim();
              if (!summary) return;
              setTitle("");
              setAdding(false);
              onAdd(summary);
            }}
            className="space-y-2"
          >
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ticket title"
              className="w-full rounded-app-sm border border-app-border bg-app-surface px-2 py-1.5 text-[13px] outline-none focus:border-indigo/40"
            />
            <div className="flex gap-2">
              <button type="submit" className="text-[12px] font-medium text-indigo">
                Add
              </button>
              <button
                type="button"
                className="text-[12px] text-app-ink-dim"
                onClick={() => {
                  setAdding(false);
                  setTitle("");
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            className="text-[12px] font-medium text-app-ink-dim hover:text-indigo"
            onClick={() => setAdding(true)}
          >
            + Add card
          </button>
        )}
      </div>
    </section>
  );
}

function SortableCard({ item, selected, onSelect }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <BoardCard item={item} selected={selected} onSelect={onSelect} />
    </div>
  );
}

function BoardCard({ item, selected, onSelect, overlay = false }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-app-sm border px-3 py-2.5 text-left shadow-app-card ${
        overlay ? "bg-app-surface" : "bg-app-surface"
      } ${selected ? "border-indigo/50 ring-1 ring-indigo/20" : "border-app-border"}`}
    >
      <p className="font-mono text-[10px] text-indigo">{item.key}</p>
      <p className="mt-1 text-[13px] font-medium text-app-ink">{item.summary}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        <span className="rounded-full bg-app-surface-muted px-1.5 py-0.5 text-[10px] text-app-ink-dim">
          {item.issueType}
        </span>
        {item.priority ? (
          <span className="rounded-full bg-app-surface-muted px-1.5 py-0.5 text-[10px] text-app-ink-dim">
            {item.priority}
          </span>
        ) : null}
      </div>
    </button>
  );
}

function ItemDrawer({ item, busy, orgPath, onClose, onSave, onAnalyze }) {
  const [summary, setSummary] = useState(item.summary);
  const [description, setDescription] = useState(item.description ?? "");
  const [issueType, setIssueType] = useState(item.issueType ?? "Task");
  const [priority, setPriority] = useState(item.priority ?? "Medium");

  return (
    <aside className="w-full max-w-sm shrink-0 rounded-app border border-app-border bg-app-surface">
      <div className="flex items-center justify-between border-b border-app-border px-4 py-3">
        <p className="font-mono text-[12px] text-indigo">{item.key}</p>
        <button type="button" className="text-[12px] text-app-ink-dim" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="space-y-3 p-4">
        <label className="block">
          <span className="type-kicker">Title</span>
          <input
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className="mt-1 w-full rounded-app-sm border border-app-border px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="type-kicker">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            className="mt-1 w-full rounded-app-sm border border-app-border px-3 py-2 text-sm"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className="type-kicker">Type</span>
            <select
              value={issueType}
              onChange={(e) => setIssueType(e.target.value)}
              className="mt-1 w-full rounded-app-sm border border-app-border px-2 py-2 text-sm"
            >
              <option>Task</option>
              <option>Bug</option>
            </select>
          </label>
          <label>
            <span className="type-kicker">Priority</span>
            <input
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="mt-1 w-full rounded-app-sm border border-app-border px-2 py-2 text-sm"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={busy}
          className="w-full rounded-full border border-app-border py-2 text-sm font-medium disabled:opacity-50"
          onClick={() => onSave({ summary, description, issueType, priority })}
        >
          Save
        </button>
        <button
          type="button"
          disabled={busy}
          className="app-btn-primary w-full disabled:opacity-50"
          onClick={onAnalyze}
        >
          Analyze with {AGENT_NAMES.VIRIN}
        </button>
        <Link
          to={`${orgPath("pm-agents")}?ticket=${encodeURIComponent(item.key)}`}
          className="block text-center text-[12px] font-medium text-indigo hover:underline"
        >
          Open in Virin workspace →
        </Link>
      </div>
    </aside>
  );
}
