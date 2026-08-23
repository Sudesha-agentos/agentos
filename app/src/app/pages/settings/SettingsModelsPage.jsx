import { useState } from "react";
import { useSettings } from "../../../entities/settings";
import { useSaveSettings } from "../../../features/save-settings/model/useSaveSettings";
import {
  AGENT_MODELS,
  AGENT_MODEL_IDS,
  AGENT_MODEL_ROLES,
  defaultModelNameForProvider,
  getProviderModels,
  isAgentModelId,
  resolveProviderModelName,
} from "../../../shared/config/agentModels";
import {
  ANTHROPIC_BUILTIN_SKILLS,
  newCustomSkillId,
} from "../../../shared/config/claudeSkills";
import { SettingsPageHeader } from "../../layout/SettingsLayout";

export default function SettingsModelsPage() {
  const { data } = useSettings();
  const { save, pending, error, savedAt } = useSaveSettings();
  const [form, setForm] = useState(null);

  if (!form) {
    if (data) setForm(data);
    return (
      <div className="flex h-40 items-center justify-center text-[13px] text-app-ink-mute">
        Loading…
      </div>
    );
  }

  async function onSubmit(e) {
    e.preventDefault();
    const next = { ...form };
    for (const role of AGENT_MODEL_ROLES) {
      const providerId = isAgentModelId(next[role.settingKey])
        ? next[role.settingKey]
        : "chatgpt";
      next[role.settingKey] = providerId;
      next[role.modelNameKey] = resolveProviderModelName(
        providerId,
        next[role.modelNameKey]
      );
    }
    setForm(next);
    await save(next);
  }

  return (
    <div>
      <SettingsPageHeader
        title="Models"
        description="Pick a provider and model for Product, Tech, and QA, then attach skills to each agent. ChatGPT, Grok, and Claude are always available."
      />

      <form onSubmit={onSubmit} className="space-y-4">
        {AGENT_MODEL_ROLES.map((role) => (
          <ProcessModelCard key={role.id} role={role} form={form} setForm={setForm} />
        ))}

        <SkillsLibrary form={form} setForm={setForm} />

        <p className="w-full text-[12px] leading-relaxed text-app-ink-mute">
          ChatGPT, Grok, and Claude are provided by AgentOX. You do not need to bring your own API
          keys. Custom skills are stored in this workspace and sent with Product, Tech, and QA runs.
          PowerPoint, Excel, Word, and PDF skills run when that agent is on Claude.
        </p>
        <div className="flex flex-col items-end gap-2">
          {error ? (
            <p className="text-[12px] text-danger">{error.message}</p>
          ) : null}
          {savedAt ? (
            <p className="text-[12px] text-success">Saved · {savedAt.toLocaleTimeString()}</p>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-app-ink px-5 py-2.5 text-[13px] font-medium text-app-canvas transition hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save models"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ProcessModelCard({ role, form, setForm }) {
  const providerId = form?.[role.settingKey] ?? "chatgpt";
  const modelName = resolveProviderModelName(providerId, form?.[role.modelNameKey]);

  function selectProvider(nextProviderId) {
    setForm((current) => {
      const keepModel =
        current[role.settingKey] === nextProviderId
          ? current[role.modelNameKey]
          : defaultModelNameForProvider(nextProviderId);
      return {
        ...current,
        [role.settingKey]: nextProviderId,
        [role.modelNameKey]: resolveProviderModelName(nextProviderId, keepModel),
      };
    });
  }

  function selectModel(nextProviderId, nextModelName) {
    setForm((current) => ({
      ...current,
      [role.settingKey]: nextProviderId,
      [role.modelNameKey]: nextModelName,
    }));
  }

  return (
    <section className="app-card rounded-2xl px-5 py-5">
      <div className="mb-4">
        <p className="text-[15px] font-semibold text-app-ink">
          {role.label}
          <span className="ml-2 text-[12px] font-medium text-app-ink-mute">{role.agent}</span>
        </p>
        <p className="mt-1 text-[13px] text-app-ink-dim">{role.description}</p>
      </div>

      <div className="space-y-3">
        {AGENT_MODEL_IDS.map((id) => {
          const provider = AGENT_MODELS[id];
          const selectedProvider = providerId === id;
          return (
            <div
              key={id}
              className={`rounded-xl px-3.5 py-3 ${
                selectedProvider ? "bg-app-surface-muted" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => selectProvider(id)}
                className="flex w-full items-start justify-between gap-3 text-left"
              >
                <span>
                  <span className="block text-[14px] font-medium text-app-ink">{provider.label}</span>
                  <span className="mt-0.5 block text-[11px] text-app-ink-mute">{provider.vendor}</span>
                </span>
                <span className="rounded-md bg-app-canvas/40 px-1.5 py-0.5 text-[11px] font-medium text-app-ink-dim">
                  {provider.creditsPerRun} {provider.creditsPerRun === 1 ? "credit" : "credits"}
                </span>
              </button>
              <div
                role="radiogroup"
                aria-label={`${role.label} ${provider.label} model`}
                className="mt-3 flex flex-wrap gap-1.5"
              >
                {getProviderModels(id).map((option) => {
                  const selected = selectedProvider && modelName === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      title={option.blurb}
                      onClick={() => selectModel(id, option.id)}
                      className={`rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition ${
                        selected
                          ? "bg-app-ink text-app-canvas"
                          : "text-app-ink-dim hover:bg-app-canvas/50 hover:text-app-ink"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <AgentSkillsAttach role={role} form={form} setForm={setForm} />
    </section>
  );
}

function toggleSkillId(ids, skillId) {
  return ids.includes(skillId) ? ids.filter((id) => id !== skillId) : [...ids, skillId];
}

function AgentSkillsAttach({ role, form, setForm }) {
  const attachedIds = form?.[role.skillIdsKey] ?? [];
  const customSkills = form?.claudeSkills ?? [];

  function toggleSkill(skillId) {
    setForm((current) => ({
      ...current,
      [role.skillIdsKey]: toggleSkillId(current[role.skillIdsKey] ?? [], skillId),
    }));
  }

  return (
    <div className="mt-5 pt-4">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-app-ink">Skills</p>
          <p className="mt-1 text-[12px] leading-relaxed text-app-ink-mute">
            Attach skills for {role.agent}. Custom skills run on any provider. Documents run on Claude.
          </p>
        </div>
      </div>

      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-app-ink-mute">
        Documents
      </p>
      <div className="flex flex-wrap gap-1.5">
        {ANTHROPIC_BUILTIN_SKILLS.map((skill) => (
          <SkillChip
            key={skill.id}
            label={skill.label}
            title={skill.blurb}
            attached={attachedIds.includes(skill.id)}
            onClick={() => toggleSkill(skill.id)}
          />
        ))}
      </div>

      <p className="mb-2 mt-4 text-[11px] font-medium uppercase tracking-wide text-app-ink-mute">
        Workspace
      </p>
      {customSkills.length === 0 ? (
        <p className="text-[12px] text-app-ink-mute">
          No custom skills yet. Add one in the library below, then attach it here.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {customSkills.map((skill) => (
            <SkillChip
              key={skill.id}
              label={skill.name}
              title={skill.description || skill.name}
              attached={attachedIds.includes(skill.id)}
              onClick={() => toggleSkill(skill.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SkillChip({ label, title, attached, onClick }) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={attached}
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
        attached
          ? "bg-app-ink text-app-canvas"
          : "bg-app-surface-muted text-app-ink-dim hover:text-app-ink"
      }`}
    >
      {label}
    </button>
  );
}

function SkillsLibrary({ form, setForm }) {
  const customSkills = form?.claudeSkills ?? [];
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);

  function upsertCustomSkill(skill) {
    setForm((current) => {
      const catalog = current.claudeSkills ?? [];
      const exists = catalog.some((item) => item.id === skill.id);
      const claudeSkills = exists
        ? catalog.map((item) => (item.id === skill.id ? skill : item))
        : [...catalog, skill];
      return { ...current, claudeSkills };
    });
  }

  function removeCustomSkill(skillId) {
    setForm((current) => ({
      ...current,
      claudeSkills: (current.claudeSkills ?? []).filter((item) => item.id !== skillId),
      productSkillIds: (current.productSkillIds ?? []).filter((id) => id !== skillId),
      techSkillIds: (current.techSkillIds ?? []).filter((id) => id !== skillId),
      qaSkillIds: (current.qaSkillIds ?? []).filter((id) => id !== skillId),
    }));
    if (editingId === skillId) setEditingId(null);
  }

  return (
    <section className="app-card rounded-2xl px-5 py-5">
      <div className="mb-4">
        <p className="text-[15px] font-semibold text-app-ink">Skills library</p>
        <p className="mt-1 text-[13px] text-app-ink-dim">
          Custom SKILL.md files live in this workspace. Attach them on Product, Tech, and QA above.
        </p>
      </div>

      {customSkills.length === 0 && !adding ? (
        <p className="text-[13px] text-app-ink-mute">No custom skills yet.</p>
      ) : null}

      <div className="space-y-2">
        {customSkills.map((skill) =>
          editingId === skill.id ? (
            <SkillEditor
              key={skill.id}
              initial={skill}
              submitLabel="Save skill"
              onCancel={() => setEditingId(null)}
              onSubmit={(next) => {
                upsertCustomSkill({ ...skill, ...next });
                setEditingId(null);
              }}
            />
          ) : (
            <div
              key={skill.id}
              className="flex items-start justify-between gap-3 rounded-xl bg-app-surface-muted/50 px-3.5 py-3"
            >
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-app-ink">{skill.name}</p>
                {skill.description ? (
                  <p className="mt-0.5 text-[12px] leading-relaxed text-app-ink-dim">
                    {skill.description}
                  </p>
                ) : null}
                <p className="mt-2 text-[11px] text-app-ink-mute">
                  {AGENT_MODEL_ROLES.filter((role) =>
                    (form?.[role.skillIdsKey] ?? []).includes(skill.id)
                  )
                    .map((role) => role.agent)
                    .join(" · ") || "Not attached"}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAdding(false);
                    setEditingId(skill.id);
                  }}
                  className="text-[12px] text-app-ink-dim hover:text-app-ink"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => removeCustomSkill(skill.id)}
                  className="text-[12px] text-app-ink-dim hover:text-danger"
                >
                  Remove
                </button>
              </div>
            </div>
          )
        )}
      </div>

      {adding ? (
        <div className="mt-3">
          <SkillEditor
            submitLabel="Add skill"
            onCancel={() => setAdding(false)}
            onSubmit={(next) => {
              upsertCustomSkill({ id: newCustomSkillId(), ...next });
              setAdding(false);
            }}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setAdding(true);
          }}
          className="mt-4 rounded-full bg-app-surface-muted px-3.5 py-1.5 text-[13px] font-medium text-app-ink hover:bg-app-surface-muted/80"
        >
          Add skill
        </button>
      )}
    </section>
  );
}

function SkillEditor({ initial, submitLabel, onSubmit, onCancel }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [body, setBody] = useState(initial?.body ?? "");

  return (
    <div className="space-y-3 rounded-xl bg-app-surface-muted/50 px-3.5 py-3.5">
      <label className="block">
        <span className="mb-1.5 block text-[12px] font-medium text-app-ink-dim">Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="PRD voice"
          aria-label="Skill name"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[12px] font-medium text-app-ink-dim">When to use</span>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Use when writing product specs"
          aria-label="Skill description"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[12px] font-medium text-app-ink-dim">SKILL.md</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Instructions the agent should follow when this skill is attached."
          aria-label="SKILL.md body"
          rows={8}
        />
      </label>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full px-3 py-1.5 text-[12px] text-app-ink-dim hover:text-app-ink"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!name.trim()}
          onClick={() =>
            onSubmit({
              name: name.trim(),
              description: description.trim(),
              body,
            })
          }
          className="rounded-full bg-app-ink px-3.5 py-1.5 text-[12px] font-medium text-app-canvas disabled:opacity-50"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
