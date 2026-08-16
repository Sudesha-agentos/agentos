import { execFile } from "node:child_process";
import { promisify } from "node:util";

export const execFileAsync = promisify(execFile);

const SAFE_GIT_REF = /^[A-Za-z0-9._/\-]+$/;

export function assertSafeGitRef(ref: string, label = "branch"): string {
  if (!ref || ref.length > 255 || ref.includes("..") || !SAFE_GIT_REF.test(ref)) {
    throw new Error(`Invalid git ${label}`);
  }
  return ref;
}
