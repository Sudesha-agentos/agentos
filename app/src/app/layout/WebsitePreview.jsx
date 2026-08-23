import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCompanyProfile } from "../../entities/company-intelligence";
import { useOrg } from "../../shared/providers/OrgRouteProvider";
import { hostnameFromUrl, toPublicWebsiteUrl } from "../../shared/lib/websiteUrl";
import { useWorkspaceMode } from "../../shared/hooks/useWorkspaceMode";

const PREVIEW_URL_KEY = "agentox-preview-website-url";

function readStoredUrl(appHostname) {
  if (typeof window === "undefined") return "";
  try {
    return toPublicWebsiteUrl(window.sessionStorage.getItem(PREVIEW_URL_KEY), appHostname);
  } catch {
    return "";
  }
}

function storeUrl(url) {
  try {
    if (url) window.sessionStorage.setItem(PREVIEW_URL_KEY, url);
    else window.sessionStorage.removeItem(PREVIEW_URL_KEY);
  } catch {
    /* ignore */
  }
}

function appHostname() {
  if (typeof window === "undefined") return "";
  return window.location.hostname;
}

export default function WebsitePreview() {
  const { orgPath } = useOrg();
  const { setWork } = useWorkspaceMode();
  const { data: profile, loading } = useCompanyProfile();
  const hostHint = appHostname();
  const [draftUrl, setDraftUrl] = useState("");
  const [frameUrl, setFrameUrl] = useState("");
  const [frameKey, setFrameKey] = useState(0);
  const [frameLoaded, setFrameLoaded] = useState(false);

  const profileUrl = useMemo(
    () => toPublicWebsiteUrl(profile?.website, hostHint),
    [hostHint, profile?.website]
  );

  useEffect(() => {
    const next = readStoredUrl(hostHint) || profileUrl;
    setDraftUrl(next);
    setFrameUrl(next);
    setFrameLoaded(false);
    setFrameKey((key) => key + 1);
  }, [hostHint, profileUrl]);

  const host = hostnameFromUrl(frameUrl);

  function applyUrl(event) {
    event.preventDefault();
    const next = toPublicWebsiteUrl(draftUrl, hostHint);
    setDraftUrl(next || draftUrl);
    setFrameUrl(next);
    storeUrl(next);
    setFrameLoaded(false);
    setFrameKey((key) => key + 1);
  }

  if (loading && !frameUrl && !profileUrl) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center text-[13px] text-app-ink-mute">
        Loading website…
      </div>
    );
  }

  if (!frameUrl) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6">
        <div className="max-w-md text-center">
          <p className="text-[16px] font-semibold text-app-ink">No public website to preview</p>
          <p className="mt-2 text-[13px] leading-relaxed text-app-ink-dim">
            Preview loads your live company site (https). Localhost, staging, and this AgentOX app
            are not shown here. Add the public URL in Company settings.
          </p>
          <form onSubmit={applyUrl} className="mt-5 flex gap-2">
            <input
              value={draftUrl}
              onChange={(event) => setDraftUrl(event.target.value)}
              placeholder="https://www.yourcompany.com"
              aria-label="Website URL"
              className="min-w-0 flex-1"
            />
            <button
              type="submit"
              className="shrink-0 rounded-full bg-app-ink px-3.5 py-2 text-[13px] font-medium text-app-canvas"
            >
              Load
            </button>
          </form>
          <div className="mt-4 flex justify-center gap-2">
            <Link
              to={orgPath("settings", "company")}
              onClick={setWork}
              className="rounded-lg px-3.5 py-2 text-[13px] font-medium text-app-ink-dim hover:bg-app-surface-muted hover:text-app-ink"
            >
              Company settings
            </Link>
            <button
              type="button"
              onClick={setWork}
              className="rounded-lg px-3.5 py-2 text-[13px] font-medium text-app-ink-dim hover:bg-app-surface-muted hover:text-app-ink"
            >
              Back to Work
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <div className="app-glass flex shrink-0 items-center gap-2 px-3 py-2">
        <form onSubmit={applyUrl} className="flex min-w-0 flex-1 items-center gap-2">
          <span className="hidden size-2 shrink-0 rounded-full bg-success sm:block" aria-hidden />
          <input
            value={draftUrl}
            onChange={(event) => setDraftUrl(event.target.value)}
            aria-label="Website URL"
            className="app-field-plain min-w-0 flex-1 rounded-lg bg-app-surface-muted/70 px-3 py-1.5 text-[12px] text-app-ink outline-none"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-app-ink-dim hover:bg-app-surface-muted hover:text-app-ink"
          >
            Go
          </button>
        </form>
        <button
          type="button"
          onClick={() => {
            setFrameLoaded(false);
            setFrameKey((key) => key + 1);
          }}
          className="rounded-lg px-2 py-1.5 text-[12px] font-medium text-app-ink-dim hover:bg-app-surface-muted hover:text-app-ink"
        >
          Refresh
        </button>
        <a
          href={frameUrl}
          target="_blank"
          rel="noreferrer"
          title="Open the live website"
          className="rounded-lg px-2 py-1.5 text-[12px] font-medium text-app-ink-dim hover:bg-app-surface-muted hover:text-app-ink"
        >
          Open
        </a>
      </div>

      <div className="relative min-h-0 flex-1 bg-white">
        {!frameLoaded ? (
          <p className="pointer-events-none absolute left-1/2 top-5 z-10 -translate-x-1/2 rounded-full app-glass px-3 py-1 text-[11px] text-app-ink-mute">
            Loading {host}…
          </p>
        ) : null}
        <iframe
          key={frameKey}
          title={`Website preview of ${host}`}
          src={frameUrl}
          className="absolute inset-0 size-full border-0 bg-white"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="fullscreen"
          onLoad={() => setFrameLoaded(true)}
        />
      </div>
    </div>
  );
}
