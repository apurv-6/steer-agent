import * as fs from "node:fs";
import * as path from "node:path";
import * as childProcess from "node:child_process";
import type { CodebaseMap, ModuleInfo, FileInfo, FileDependency, SteerConfig } from "./types.js";

// ── Default excludes ───────────────────────────────────────────────
const DEFAULT_EXCLUDES = [
  "node_modules", ".git", "dist", "build", ".next", ".nuxt",
  "coverage", ".cache", ".turbo", "__pycache__", ".gradle",
  "venv", ".venv", "target", "bin", "obj",
];

const SOURCE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".kt", ".kts", ".java",
  ".py",
  ".go",
  ".rs",
  ".swift",
  ".c", ".cpp", ".h", ".hpp",
]);

const TEST_PATTERNS = [
  /\.test\.\w+$/,
  /\.spec\.\w+$/,
  /Test\.\w+$/,
  /_test\.\w+$/,
  /test_\w+\.\w+$/,
];

// ── File tree scanner ──────────────────────────────────────────────

interface ScannedFile {
  relativePath: string;
  absolutePath: string;
  extension: string;
  loc: number;
  role: string;
  language: string;
}

function shouldExclude(name: string, excludePaths: string[]): boolean {
  return DEFAULT_EXCLUDES.includes(name) ||
    excludePaths.some((ex) => name === ex || name === ex.replace(/\/$/, ""));
}

function detectLanguage(ext: string): string {
  const map: Record<string, string> = {
    ".ts": "typescript", ".tsx": "typescript", ".js": "javascript", ".jsx": "javascript",
    ".mjs": "javascript", ".cjs": "javascript",
    ".kt": "kotlin", ".kts": "kotlin", ".java": "java",
    ".py": "python", ".go": "go", ".rs": "rust", ".swift": "swift",
    ".c": "c", ".cpp": "cpp", ".h": "c", ".hpp": "cpp",
  };
  return map[ext] ?? "unknown";
}

function classifyRole(relPath: string, ext: string): string {
  if (TEST_PATTERNS.some((p) => p.test(relPath))) return "test";
  if (/config|\.config|rc\./i.test(relPath)) return "config";
  if (/readme|doc|\.md$/i.test(relPath)) return "doc";
  if (/model|entity|dto/i.test(path.basename(relPath, ext))) return "model";
  if (/service/i.test(path.basename(relPath, ext))) return "service";
  if (/controller|handler/i.test(path.basename(relPath, ext))) return "controller";
  if (/repo(sitory)?/i.test(path.basename(relPath, ext))) return "repository";
  if (/view|fragment|component|page/i.test(path.basename(relPath, ext))) return "view";
  if (/util|helper/i.test(path.basename(relPath, ext))) return "utility";
  return "source";
}

function countLines(filePath: string): number {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return content.split("\n").length;
  } catch {
    return 0;
  }
}

export function scanFileTree(
  root: string,
  excludePaths: string[] = [],
): ScannedFile[] {
  const files: ScannedFile[] = [];

  function walk(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith(".") && entry.name !== ".steer") continue;
      if (shouldExclude(entry.name, excludePaths)) continue;

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (!SOURCE_EXTENSIONS.has(ext)) continue;

        const relPath = path.relative(root, fullPath);
        files.push({
          relativePath: relPath,
          absolutePath: fullPath,
          extension: ext,
          loc: countLines(fullPath),
          role: classifyRole(relPath, ext),
          language: detectLanguage(ext),
        });
      }
    }
  }

  walk(root);
  return files;
}

// ── Module detection ───────────────────────────────────────────────

export function detectModules(
  files: ScannedFile[],
  criticalModules: string[] = [],
): Record<string, ModuleInfo> {
  const modules: Record<string, ModuleInfo> = {};

  for (const file of files) {
    // Get top-level or second-level directory as module
    const parts = file.relativePath.split(path.sep);
    const modulePath = parts.length > 1 ? parts.slice(0, 2).join("/") + "/" : parts[0] + "/";

    if (!modules[modulePath]) {
      const isCritical = criticalModules.some((cm) =>
        modulePath.startsWith(cm) || cm.startsWith(modulePath),
      );
      modules[modulePath] = {
        type: file.role === "test" ? "test-module" : "feature-module",
        critical: isCritical,
        files: {},
      };
    }

    const mod = modules[modulePath]!;
    mod.files[file.relativePath] = {
      role: file.role,
      loc: file.loc,
      language: file.language,
    };

    if (file.role === "test") {
      if (!mod.testDir) {
        mod.testDir = path.dirname(file.relativePath);
      }
      if (!mod.testFiles) mod.testFiles = {};
      // Try to match test to source file
      const sourceFile = matchSourceFromTest(file.relativePath);
      if (sourceFile) {
        mod.testFiles[file.relativePath] = { covers: sourceFile };
      }
    }
  }

  return modules;
}

// ── Import parsing (regex V1) ──────────────────────────────────────

const IMPORT_PATTERNS = [
  // ES imports: import { x } from './foo'
  /(?:import|export)\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g,
  // require: const x = require('./foo')
  /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  // Kotlin/Java: import com.example.Foo
  /^import\s+([\w.]+)/gm,
  // Python: from foo import bar / import foo
  /^(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/gm,
  // Go: import "package"
  /import\s+(?:\([\s\S]*?\)|"([^"]+)")/g,
];

export function parseImports(filePath: string, root: string): string[] {
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return [];
  }

  const imports: Set<string> = new Set();
  const relDir = path.dirname(path.relative(root, filePath));

  for (const pattern of IMPORT_PATTERNS) {
    // Reset regex lastIndex
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      // Get first non-null capture group
      const raw = match[1] ?? match[2];
      if (!raw) continue;

      // Skip external/node_modules imports
      if (raw.startsWith(".")) {
        // Resolve relative path
        let resolved = path.join(relDir, raw);
        // Normalize: remove ./ prefix, add extension if needed
        resolved = resolved.replace(/\\/g, "/");
        imports.add(resolved);
      } else if (!raw.includes("node_modules") && !raw.startsWith("@") && raw.includes("/")) {
        // Could be an internal absolute import
        imports.add(raw);
      }
    }
  }

  return [...imports];
}

export function parseExports(filePath: string): string[] {
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return [];
  }

  const exports: string[] = [];
  // Named exports: export function foo(), export const foo
  const namedPattern = /export\s+(?:function|const|let|var|class|interface|type|enum)\s+(\w+)/g;
  let match: RegExpExecArray | null;
  while ((match = namedPattern.exec(content)) !== null) {
    if (match[1]) exports.push(match[1]);
  }
  // Default export
  if (/export\s+default/.test(content)) {
    exports.push("default");
  }

  return exports;
}

// ── Test file matching ─────────────────────────────────────────────

function matchSourceFromTest(testPath: string): string | null {
  const basename = path.basename(testPath);
  // Remove test patterns to find source name
  const sourceName = basename
    .replace(/\.test\./, ".")
    .replace(/\.spec\./, ".")
    .replace(/Test\./, ".")
    .replace(/_test\./, ".");

  if (sourceName === basename) return null; // Couldn't derive
  // Return just the name — module detection will associate
  return sourceName;
}

export function matchTestFiles(
  sourceFiles: ScannedFile[],
  allFiles: ScannedFile[],
): Record<string, string> {
  const testMap: Record<string, string> = {};
  const testFiles = allFiles.filter((f) => f.role === "test");

  for (const source of sourceFiles) {
    if (source.role === "test") continue;
    const baseName = path.basename(source.relativePath, source.extension);

    for (const test of testFiles) {
      const testBaseName = path.basename(test.relativePath, test.extension);
      // Match: Foo.ts → Foo.test.ts, Foo.spec.ts, FooTest.ts
      if (
        testBaseName === `${baseName}.test` ||
        testBaseName === `${baseName}.spec` ||
        testBaseName === `${baseName}Test` ||
        testBaseName === `${baseName}_test` ||
        testBaseName === `test_${baseName}`
      ) {
        testMap[source.relativePath] = test.relativePath;
        break;
      }
    }
  }

  return testMap;
}

// ── Git analysis ───────────────────────────────────────────────────

export function analyzeChangeCoupling(
  repoPath: string,
  months: number = 3,
): Record<string, Record<string, number>> {
  const coupling: Record<string, Record<string, number>> = {};

  try {
    const sinceDate = new Date();
    sinceDate.setMonth(sinceDate.getMonth() - months);
    const since = sinceDate.toISOString().split("T")[0];

    // Get all commit hashes
    const hashes = childProcess
      .execSync(`git log --format="%H" --since="${since}"`, {
        cwd: repoPath,
        timeout: 10000,
        stdio: ["pipe", "pipe", "pipe"],
      })
      .toString()
      .trim()
      .split("\n")
      .filter((h) => h.length > 0);

    // Track which files change in each commit
    const commitFiles: string[][] = [];
    for (const hash of hashes.slice(0, 200)) { // Cap at 200 commits
      try {
        const files = childProcess
          .execSync(`git diff-tree --no-commit-id --name-only -r ${hash}`, {
            cwd: repoPath,
            timeout: 3000,
            stdio: ["pipe", "pipe", "pipe"],
          })
          .toString()
          .trim()
          .split("\n")
          .filter((f) => f.length > 0);
        commitFiles.push(files);
      } catch {
        // Skip problematic commits
      }
    }

    // Build co-change matrix
    const fileCounts: Record<string, number> = {};
    const pairCounts: Record<string, number> = {};

    for (const files of commitFiles) {
      for (const file of files) {
        fileCounts[file] = (fileCounts[file] ?? 0) + 1;
        for (const other of files) {
          if (file === other) continue;
          const key = [file, other].sort().join("|||");
          pairCounts[key] = (pairCounts[key] ?? 0) + 1;
        }
      }
    }

    // Convert to coupling ratios
    for (const [key, count] of Object.entries(pairCounts)) {
      const [fileA, fileB] = key.split("|||") as [string, string];
      const totalA = fileCounts[fileA] ?? 1;
      const ratioA = count / totalA;

      if (ratioA > 0.3) { // Only track significant coupling
        if (!coupling[fileA]) coupling[fileA] = {};
        coupling[fileA][fileB] = Math.round(ratioA * 100) / 100;
      }

      const totalB = fileCounts[fileB] ?? 1;
      const ratioB = count / totalB;
      if (ratioB > 0.3) {
        if (!coupling[fileB]) coupling[fileB] = {};
        coupling[fileB][fileA] = Math.round(ratioB * 100) / 100;
      }
    }
  } catch {
    // Git not available or not a git repo
  }

  return coupling;
}

export function analyzeOwnership(
  repoPath: string,
  files: string[],
): Record<string, string> {
  const ownership: Record<string, string> = {};

  for (const file of files.slice(0, 100)) { // Cap at 100 files
    try {
      const author = childProcess
        .execSync(`git log --format="%aN" -1 -- "${file}"`, {
          cwd: repoPath,
          timeout: 3000,
          stdio: ["pipe", "pipe", "pipe"],
        })
        .toString()
        .trim();
      if (author) {
        ownership[file] = author;
      }
    } catch {
      // Skip
    }
  }

  return ownership;
}

// ── Build dependency graph ─────────────────────────────────────────

function buildDependencyGraph(
  files: ScannedFile[],
  root: string,
  testMap: Record<string, string>,
): Record<string, FileDependency> {
  const deps: Record<string, FileDependency> = {};

  // Initialize all files
  for (const file of files) {
    deps[file.relativePath] = {
      imports: [],
      exports: [],
      calledBy: [],
      testedBy: testMap[file.relativePath],
    };
  }

  // Parse imports and exports
  for (const file of files) {
    if (file.role === "test" || file.role === "config" || file.role === "doc") continue;

    const imports = parseImports(file.absolutePath, root);
    const exports = parseExports(file.absolutePath);

    const fileDep = deps[file.relativePath];
    if (!fileDep) continue;

    fileDep.exports = exports;

    // Resolve imports to actual files
    for (const imp of imports) {
      // Try to match to a known file
      const resolved = resolveImport(imp, files);
      if (resolved) {
        fileDep.imports.push(resolved);
        // Add reverse reference
        if (deps[resolved]) {
          deps[resolved].calledBy.push(file.relativePath);
        }
      }
    }
  }

  return deps;
}

function resolveImport(importPath: string, files: ScannedFile[]): string | null {
  // Direct match
  const direct = files.find((f) => f.relativePath === importPath);
  if (direct) return direct.relativePath;

  // Try with extensions
  for (const ext of [".ts", ".tsx", ".js", ".jsx", ".kt", ".java", ".py"]) {
    const withExt = files.find((f) => f.relativePath === importPath + ext);
    if (withExt) return withExt.relativePath;
  }

  // Try index file
  const indexMatch = files.find((f) =>
    f.relativePath === importPath + "/index.ts" ||
    f.relativePath === importPath + "/index.js",
  );
  if (indexMatch) return indexMatch.relativePath;

  return null;
}

// ── Detect build system ────────────────────────────────────────────

function detectBuildSystem(root: string): string | undefined {
  if (fs.existsSync(path.join(root, "package.json"))) return "npm";
  if (fs.existsSync(path.join(root, "build.gradle")) || fs.existsSync(path.join(root, "build.gradle.kts"))) return "gradle";
  if (fs.existsSync(path.join(root, "pom.xml"))) return "maven";
  if (fs.existsSync(path.join(root, "Cargo.toml"))) return "cargo";
  if (fs.existsSync(path.join(root, "go.mod"))) return "go";
  if (fs.existsSync(path.join(root, "setup.py")) || fs.existsSync(path.join(root, "pyproject.toml"))) return "python";
  return undefined;
}

function detectPrimaryLanguage(files: ScannedFile[]): string | undefined {
  const langCount: Record<string, number> = {};
  for (const f of files) {
    if (f.role !== "test" && f.role !== "config" && f.role !== "doc") {
      langCount[f.language] = (langCount[f.language] ?? 0) + f.loc;
    }
  }
  const sorted = Object.entries(langCount).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0];
}

// ── Main builder ───────────────────────────────────────────────────

export function buildCodebaseMap(
  repoPath: string,
  config?: SteerConfig,
): CodebaseMap {
  const excludePaths = config?.codemap?.excludePaths ?? [];
  const criticalModules = config?.defaults?.criticalModules ?? [];

  // Step 1: Scan file tree
  const files = scanFileTree(repoPath, excludePaths);

  // Step 2: Detect modules
  const modules = detectModules(files, criticalModules);

  // Step 3: Match test files
  const testMap = matchTestFiles(files, files);

  // Step 4: Build dependency graph
  const dependencies = buildDependencyGraph(files, repoPath, testMap);

  // Step 5: Analyze change coupling from git
  const changeCoupling = analyzeChangeCoupling(repoPath);

  // Step 6: Analyze ownership
  const sourceFiles = files.filter((f) => f.role !== "test").map((f) => f.relativePath);
  const ownership = analyzeOwnership(repoPath, sourceFiles);

  return {
    root: repoPath,
    language: detectPrimaryLanguage(files),
    buildSystem: detectBuildSystem(repoPath),
    scannedAt: new Date().toISOString(),
    modules,
    dependencies,
    changeCoupling: Object.keys(changeCoupling).length > 0 ? changeCoupling : undefined,
    ownership: Object.keys(ownership).length > 0 ? ownership : undefined,
  };
}

/**
 * Save codebase map to .steer/codebase-map.json
 */
export function saveCodebaseMap(steerDir: string, map: CodebaseMap): void {
  const mapPath = path.join(steerDir, "codebase-map.json");
  fs.writeFileSync(mapPath, JSON.stringify(map, null, 2), "utf-8");
}

/**
 * Load codebase map from .steer/codebase-map.json
 */
export function loadCodebaseMap(steerDir: string): CodebaseMap | null {
  const mapPath = path.join(steerDir, "codebase-map.json");
  if (!fs.existsSync(mapPath)) return null;
  try {
    const raw = fs.readFileSync(mapPath, "utf-8");
    return JSON.parse(raw) as CodebaseMap;
  } catch {
    return null;
  }
}
