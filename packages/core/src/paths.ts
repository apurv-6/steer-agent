import fs from "fs-extra";
import path from "path";

/**
 * Walk up from startDir until we find a directory containing .steer/.
 * Falls back to startDir/.steer if not found anywhere up the tree.
 */
export function findSteerDir(startDir?: string): string {
  const root = startDir ?? process.cwd();
  let dir = path.resolve(root);

  while (true) {
    const candidate = path.join(dir, ".steer");
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      // Reached filesystem root — not found
      break;
    }
    dir = parent;
  }

  // Not found: return cwd-relative .steer (tools will handle missing gracefully)
  return path.join(path.resolve(root), ".steer");
}

/**
 * Returns true if a .steer/ directory exists at or above startDir.
 */
export function steerDirExists(startDir?: string): boolean {
  const steerDir = findSteerDir(startDir);
  return fs.existsSync(steerDir) && fs.statSync(steerDir).isDirectory();
}
