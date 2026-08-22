export interface PipelineSettings {
  systemDesignComplexityThreshold: number;
  prdConfidenceThreshold: number;
  implementationConfidenceThreshold: number;
  qaCoverageThreshold: number;
}

const DEFAULTS: PipelineSettings = {
  systemDesignComplexityThreshold: 5,
  prdConfidenceThreshold: 0.7,
  implementationConfidenceThreshold: 0.7,
  qaCoverageThreshold: 95,
};

let settings: PipelineSettings = { ...DEFAULTS };

export function loadPipelineSettingsFromStore(): PipelineSettings {
  settings = { ...DEFAULTS };
  return settings;
}

export function getPipelineSettings(): PipelineSettings {
  return settings;
}

export function savePipelineSettings(patch: Partial<PipelineSettings>): PipelineSettings {
  settings = {
    ...settings,
    ...patch,
    systemDesignComplexityThreshold:
      patch.systemDesignComplexityThreshold !== undefined
        ? Math.max(1, Math.min(10, patch.systemDesignComplexityThreshold))
        : settings.systemDesignComplexityThreshold,
    prdConfidenceThreshold:
      patch.prdConfidenceThreshold !== undefined
        ? Math.max(0, Math.min(1, patch.prdConfidenceThreshold))
        : settings.prdConfidenceThreshold,
    implementationConfidenceThreshold:
      patch.implementationConfidenceThreshold !== undefined
        ? Math.max(0, Math.min(1, patch.implementationConfidenceThreshold))
        : settings.implementationConfidenceThreshold,
    qaCoverageThreshold:
      patch.qaCoverageThreshold !== undefined
        ? Math.max(0, Math.min(100, patch.qaCoverageThreshold))
        : settings.qaCoverageThreshold,
  };
  return settings;
}

export function getPublicPipelineSettings(): PipelineSettings {
  return getPipelineSettings();
}
