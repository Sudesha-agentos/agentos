import { Link } from "react-router-dom";
import AppPreloader from "./AppPreloader";

function copyForElapsed(seconds) {
  if (seconds < 8) {
    return {
      title: "Starting the AgentOX API",
      body: "The product backend sleeps when idle. This first request usually takes 15–60 seconds.",
    };
  }
  if (seconds < 45) {
    return {
      title: "Waking the AgentOX API",
      body: "Still starting. You can wait here — the app opens as soon as the API responds.",
    };
  }
  return {
    title: "The API is taking longer than usual",
    body: "The host may be restarting after a memory limit or a deploy. You can retry, or go back to the site.",
  };
}

export default function BackendConnectingScreen({ elapsedSec = 0, onRetry }) {
  const { title, body } = copyForElapsed(elapsedSec);
  const stalled = elapsedSec >= 45;

  return (
    <div className="backend-connecting" aria-live="polite" aria-busy={!stalled}>
      <AppPreloader label="" />
      <h1 className="backend-connecting-title">{title}</h1>
      <p className="backend-connecting-body">{body}</p>
      <p className="backend-connecting-meta">
        {elapsedSec < 1 ? "Connecting…" : `${elapsedSec}s elapsed`}
      </p>
      {stalled ? (
        <div className="backend-connecting-actions">
          <button type="button" className="app-preloader-retry" onClick={onRetry}>
            Retry connection
          </button>
          <Link to="/" className="backend-connecting-home">
            Back to agentox.io
          </Link>
        </div>
      ) : null}
    </div>
  );
}
