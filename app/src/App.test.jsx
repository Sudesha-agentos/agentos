import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import App from "./App";

afterEach(() => {
  window.history.pushState({}, "", "/");
  window.localStorage.clear();
});

describe("application routes", () => {
  it("opens the marketing homepage without waiting on the API", async () => {
    window.history.pushState({}, "", "/");
    render(<App />);
    expect(document.getElementById("root")).toHaveClass("app-ready");
  });

  it("redirects unauthenticated org URLs to login", async () => {
    window.history.pushState({}, "", "/agentos/pipelines");
    render(<App />);
    expect(await screen.findByText("Welcome back")).toBeInTheDocument();
  });

  it("redirects unauthenticated legacy /app URLs to login", async () => {
    window.history.pushState({}, "", "/app/pipelines");
    render(<App />);
    expect(await screen.findByText("Welcome back")).toBeInTheDocument();
  });
});
