import { DATA_MODE, DATA_MODES } from "../config/app";
import { useBackendReady } from "../lib/useBackendReady";

export default function ApiWakeNotice() {
  const ready = useBackendReady();
  if (DATA_MODE !== DATA_MODES.REST || ready) return null;

  return (
    <p
      className="mb-6 rounded-2xl border border-[#E8E4DE] bg-[#F0EEEB] px-4 py-3 text-center text-[13px] leading-relaxed text-[#6B6B6B]"
      role="status"
    >
      The AgentOX API is starting. You can fill in the form — sign-in works as soon as it is up,
      usually under a minute.
    </p>
  );
}
