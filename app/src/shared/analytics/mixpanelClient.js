import mixpanel from "mixpanel-browser";
import { bindMixpanelClient, initMixpanel } from "./mixpanel";

export function startMixpanel() {
  bindMixpanelClient(mixpanel);
  initMixpanel();
}
