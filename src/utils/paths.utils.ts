import path from "node:path";

import type { Path } from "../types/branded.types";

export function resolvePath(...components: (string | Path)[]): Path {
  return path.resolve(...components) as Path;
}

export const PROJECT_SOURCE_ROOT = resolvePath(__dirname, "..");
export const PROJECT_ROOT = resolvePath(PROJECT_SOURCE_ROOT, "..");

export const PROJECT_ASSETS_ROOT = resolvePath(PROJECT_SOURCE_ROOT, "assets");
