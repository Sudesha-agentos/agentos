const MIXPANEL_TOKEN = String(
  import.meta.env.VITE_MIXPANEL_TOKEN || "a88c0cc8c9f1d985f0271221cd264450"
).trim();

const isTest = import.meta.env.MODE === "test";
const GROUP_KEY = "organization_id";

let client = null;
let ready = false;

export function compactProperties(properties) {
  if (!properties || typeof properties !== "object") return {};
  const out = {};
  for (const [key, value] of Object.entries(properties)) {
    if (value === undefined || value === null || value === "") continue;
    out[key] = value;
  }
  return out;
}

function canUseSdk() {
  return ready && Boolean(client) && !isTest && typeof window !== "undefined";
}

export function bindMixpanelClient(sdk) {
  client = sdk;
}

export function initMixpanel() {
  if (ready || isTest || typeof window === "undefined" || !client || !MIXPANEL_TOKEN) return;

  client.init(MIXPANEL_TOKEN, {
    debug: Boolean(import.meta.env.DEV),
    persistence: "localStorage",
    track_pageview: false,
    ignore_dnt: false,
  });
  client.register({ platform: "web" });
  ready = true;
}

export function trackEvent(name, properties) {
  if (!canUseSdk() || !name) return;
  client.track(name, compactProperties(properties));
}

function organizationFromSession(session) {
  const organizationId =
    session?.organization?.id || session?.user?.organizationId || "";
  const organizationName =
    session?.organization?.name || session?.user?.organizationName || "";
  return { organizationId, organizationName };
}

export function identifyUser(session, options = {}) {
  if (!canUseSdk()) return;
  const userId = session?.user?.id;
  if (!userId) return;

  client.identify(userId);

  const { organizationId, organizationName } = organizationFromSession(session);
  const people = compactProperties({
    $name: session.user.name,
    $email: session.user.email,
    organization_id: organizationId,
    organization_name: organizationName,
    organization_role: session.user.organizationRole,
  });
  if (Object.keys(people).length) {
    client.people.set(people);
  }

  client.register(
    compactProperties({
      platform: "web",
      organization_id: organizationId,
    })
  );

  if (organizationId) {
    client.set_group(GROUP_KEY, organizationId);
    if (organizationName) {
      client.get_group(GROUP_KEY, organizationId).set({
        $name: organizationName,
      });
    }
  }

  if (!options.isNewSignup || !options.signUpMethod) return;

  const signupKey = `agentos.mixpanel.signup.${userId}`;
  try {
    if (window.localStorage.getItem(signupKey) === "1") return;
    window.localStorage.setItem(signupKey, "1");
  } catch {
    // Storage may be unavailable; still send the event.
  }

  client.people.set_once({
    first_sign_up_date: new Date().toISOString(),
  });
  client.track(
    "sign_up_completed",
    compactProperties({
      sign_up_method: options.signUpMethod,
      platform: "web",
    })
  );
}

export function resetAnalytics() {
  if (!canUseSdk()) return;
  client.reset();
  client.register({ platform: "web" });
}
