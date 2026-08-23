import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCompanyProfile } from "../../entities/company-intelligence";
import { useAuth } from "../../shared/providers/useAuth";
import { useOrg } from "../../shared/providers/OrgRouteProvider";
import { hostnameFromUrl, normalizeWebsiteUrl } from "../../shared/lib/websiteUrl";
import { useWorkspaceMode } from "../../shared/hooks/useWorkspaceMode";

const VIEWPORTS = [
  { id: "desktop", label: "Desktop", width: "100%" },
  { id: "tablet", label: "Tablet", width: 768 },
  { id: "mobile", label: "Mobile", width: 390 },
];

function websiteFromOrganization(organization) {
  const domain = organization?.domain?.trim();
  if (!domain || domain.endsWith(".local")) return "";
  return normalizeWebsiteUrl(domain);
}

export default function WebsitePreview() {
  const { organization } = useAuth();
  const { orgPath } = useOrg();
  const { setWork } = useWorkspaceMode();
  const { data: profile, loading } = useCompanyProfile();
  const [viewport, setViewport] = useState("desktop");
  const [draftUrl, setDraftUrl] = useState("");
  const [frameUrl, setFrameUrl] = useState("");
  const [frameKey, setFrameKey] = useState(0);
  const [frameLoaded, setFrameLoaded] = useState(false);

  const defaultUrl = useMemo(() => {
    return normalizeWebsiteUrl(profile?.website) || websiteFromOrganization(organization);
  }, [organization, profile?.website]);

  useEffect(() => {
    setDraftUrl(defaultUrl);
    setFrameUrl(defaultUrl);
    setFrameLoaded(false);
    setFrameKey((key) => key + 1);
  }, [defaultUrl]);

  const viewportMeta = VIEWPORTS.find((item) => item.id === viewport) ?? VIEWPORTS[0];
  const host = hostnameFromUrl(frameUrl);

  function applyUrl(event) {
    event.preventDefault();
    const next = normalizeWebsiteUrl(draftUrl);
    setDraftUrl(next);
    setFrameUrl(next);
    setFrameLoaded(false);
    setFrameKey((key) => key + 1);
  }

  if (loading && !defaultUrl) {
    return (
      <div className="flex flex-1 items-center justify-center text-[13px] text-app-ink-mute">
        Loading preview…
      </div>
    );
  }

  if (!frameUrl) {
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="max-w-md text-center">
          <p className="text-[16px] font-semibold text-app-ink">No website to preview</p>
          <p className="mt-2 text-[13px] leading-relaxed text-app-ink-dim">
            Add your public site in Company settings, then Preview will load it live here.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Link
              to={orgPath("settings", "company")}
              onClick={setWork}
              className="rounded-lg bg-app-ink px-3.5 py-2 text-[13px] font-medium text-app-canvas"
            >
              Add website
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
    <div className="flex min-h-0 flex-1 flex-col bg-app-canvas">
      <div className="app-glass flex shrink-0 items-center gap-2 px-3 py-2">
        <form onSubmit={applyUrl} className="flex min-w-0 flex-1 items-center gap-2">
          <span className="hidden size-2 shrink-0 rounded-full bg-success sm:block" aria-hidden />
          <input
            value={draftUrl}
            onChange={(event) => setDraftUrl(event.target.value)}
            aria-label="Preview URL"
            className="app-field-plain min-w-0 flex-1 rounded-lg bg-app-surface-muted/70 px-3 py-1.5 text-[12px] text-app-ink outline-none"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-app-ink-dim hover:bg-app-surface-muted hover:text-app-ink"
          >
            Go
          </button>
        </form>
        <div className="hidden rounded-lg bg-app-surface-muted p-0.5 sm:inline-flex">
          {VIEWPORTS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setViewport(item.id)}
              className={`rounded-md px-2 py-1 text-[11px] font-medium ${
                viewport === item.id
                  ? "bg-app-surface text-app-ink shadow-sm"
                  : "text-app-ink-mute hover:text-app-ink"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
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
          title="Open in a new tab"
          className="rounded-lg px-2 py-1.5 text-[12px] font-medium text-app-ink-dim hover:bg-app-surface-muted hover:text-app-ink"
        >
          Open
        </a>
      </div>

      <div className="relative flex min-h-0 flex-1 justify-center overflow-hidden bg-app-surface-muted/40 p-3 sm:p-5">
        {!frameLoaded ? (
          <p className="pointer-events-none absolute left-1/2 top-6 z-10 -translate-x-1/2 rounded-full app-glass px-3 py-1 text-[11px] text-app-ink-mute">
            Loading {host || "site"}…
          </p>
        ) : null}
        <div
          className="relative h-full overflow-hidden rounded-2xl bg-white shadow-app-float"
          style={{
            width: viewportMeta.width === "100%" ? "100%" : viewportMeta.width,
            maxWidth: "100%",
          }}
        >
          <iframe
            key={frameKey}
            title={`Live preview of ${host || "website"}`}
            src={frameUrl}
            className="size-full bg-white"
            onLoad={() => setFrameLoaded(true)}
          />
        </div>
      </div>
    </div>
  );
}
