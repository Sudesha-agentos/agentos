import ThemeSegmentedControl from "../../../shared/ui/ThemeSegmentedControl";
import { SettingsPageHeader } from "../../layout/SettingsLayout";

export default function SettingsAppearancePage() {
  return (
    <div>
      <SettingsPageHeader
        title="Appearance"
        description="Choose light, dark, or match the system setting on this device."
      />
      <div className="app-card rounded-2xl px-5 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[14px] font-medium text-app-ink">Theme</p>
            <p className="mt-1 text-[13px] text-app-ink-dim">
              Applies to the AgentOX workspace on this browser.
            </p>
          </div>
          <ThemeSegmentedControl size="md" />
        </div>
      </div>
    </div>
  );
}
