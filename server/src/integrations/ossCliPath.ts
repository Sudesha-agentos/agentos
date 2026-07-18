/**
 * Ensure pip --user bin dirs are on PATH for the server process.
 *
 * On Render, scripts/install-oss-tools.sh installs Semgrep/Locust/Cover-Agent
 * into ~/.local/bin and appends it to ~/.profile — but `npm start` runs without
 * a login shell, so .profile is never sourced. Prepending here makes every
 * child process (all CLI adapters spawn with { ...process.env }) find them.
 */

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";

export function ensureOssCliPath(): void {
  const home = process.env.HOME || homedir();
  const candidates = [join(home, ".local", "bin")];

  const parts = (process.env.PATH ?? "").split(delimiter).filter(Boolean);
  for (const dir of candidates) {
    if (existsSync(dir) && !parts.includes(dir)) {
      parts.unshift(dir);
    }
  }
  process.env.PATH = parts.join(delimiter);
}
