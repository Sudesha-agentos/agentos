import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./shared/ui/AppPreloader.css";
import App from "./App.jsx";
import { waitForBackend } from "./shared/lib/backendReady";

// Wake Render in the background. Marketing and login must not wait on this.
void waitForBackend();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
