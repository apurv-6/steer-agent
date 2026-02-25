import { glob } from "glob";
import fs from "fs-extra";
import path from "path";
import { CodebaseMap, FileInfo, ChangeCoupling } from "./types.js";
import { exec } from "child_process";
import util from "util";

const execAsync = util.promisify(exec);

export async function buildCodebaseMap(root: string): Promise<CodebaseMap> {
  // 1. Scan files
  const files = await glob("**/*.{ts,js,jsx,tsx,py,java,kt,swift,go,rs,cpp,h,c}", {
    cwd: root,
    ignore: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**", "**/.steer/**"],
  });

  const map: CodebaseMap = {
    root,
    modules: {},
    files: {},
    dependencies: {},
    coupling: {},
  };

  // 2. Build Module Map (naive approach: top-level folders)
  // 3. Process each file
  for (const file of files) {
    const filePath = path.join(root, file);
    const content = await fs.readFile(filePath, "utf-8");
    const role = identifyRole(file);
    const imports = parseImports(content, file);
    const loc = content.split("\n").length;

    map.files[file] = {
      path: file,
      role,
      loc,
      imports,
    };

    // Module detection logic
    const parts = file.split(path.sep);
    const moduleName = parts.length > 1 ? parts[0] : "root";

    if (!map.modules[moduleName]) {
      map.modules[moduleName] = {
        name: moduleName,
        path: moduleName,
        type: "module",
        critical: false, // TODO: Load from config
        files: [],
      };
    }
    map.modules[moduleName].files.push(file);

    // Dependencies
    map.dependencies[file] = {
      imports,
      importedBy: [], // Filled later
    };
  }

  // 4. Test file matching
  for (const file of files) {
    const testFile = findTestFile(file, files);
    if (testFile) {
      map.files[file].testFile = testFile;
      if (map.dependencies[file]) {
        map.dependencies[file].testFile = testFile;
      }
    }
  }

  // 5. Back-fill importedBy
  for (const file of files) {
    const imports = map.files[file].imports || [];
    for (const imp of imports) {
      // Resolve import to file path (tricky without full resolution logic)
      // For now, simple suffix match
      const resolved = files.find(f => f.endsWith(imp) || f.endsWith(imp + ".ts") || f.endsWith(imp + ".js")); // Very naive
      if (resolved && map.dependencies[resolved]) {
        map.dependencies[resolved].importedBy.push(file);
      }
    }
  }

  // 6. Change Coupling (Git)
  try {
    map.coupling = await calculateCoupling(root);
  } catch (e) {
    console.warn("Failed to calculate coupling:", e);
  }

  return map;
}

function identifyRole(filePath: string): string {
  if (filePath.includes("test") || filePath.includes("spec")) return "test";
  if (filePath.endsWith("Controller.ts") || filePath.endsWith("Controller.kt")) return "controller";
  if (filePath.endsWith("Service.ts") || filePath.endsWith("Service.kt")) return "service";
  if (filePath.endsWith("Repository.ts") || filePath.endsWith("Repository.kt")) return "repository";
  if (filePath.endsWith("Component.tsx") || filePath.endsWith("Component.vue")) return "component";
  return "source";
}

function parseImports(content: string, filePath: string): string[] {
  const imports: string[] = [];
  const regex = /import\s+.*from\s+['"](.*)['"]/g; // TS/JS
  let match;
  while ((match = regex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  // TODO: Add other languages
  return imports;
}

function findTestFile(filePath: string, allFiles: string[]): string | undefined {
  const baseName = path.basename(filePath, path.extname(filePath));
  const testName1 = `${baseName}.test${path.extname(filePath)}`;
  const testName2 = `${baseName}.spec${path.extname(filePath)}`;
  const testName3 = `${baseName}Test${path.extname(filePath)}`; // Java/Kotlin

  return allFiles.find(f => f.includes(testName1) || f.includes(testName2) || f.includes(testName3));
}

async function calculateCoupling(root: string): Promise<ChangeCoupling> {
  const coupling: ChangeCoupling = {};
  const fileCounts: Record<string, number> = {};
  const pairCounts: Record<string, Record<string, number>> = {};

  try {
      const { stdout } = await execAsync('git log --format="%H" -n 50', { cwd: root });
      const commits = stdout.split("\n").filter(Boolean);

      for (const commit of commits) {
        const { stdout: diff } = await execAsync(`git diff-tree --no-commit-id --name-only -r ${commit}`, { cwd: root });
        const files = diff.split("\n").filter(Boolean);

        if (files.length > 10) continue; // Ignore massive commits

        for (const file of files) {
            fileCounts[file] = (fileCounts[file] || 0) + 1;
        }

        for (const file1 of files) {
          if (!pairCounts[file1]) pairCounts[file1] = {};
          for (const file2 of files) {
            if (file1 === file2) continue;
            pairCounts[file1][file2] = (pairCounts[file1][file2] || 0) + 1;
          }
        }
      }

      // Calculate Probability: P(B|A) = Count(A & B) / Count(A)
      for (const file1 in pairCounts) {
          coupling[file1] = {};
          const countA = fileCounts[file1] || 1;
          for (const file2 in pairCounts[file1]) {
              const countAB = pairCounts[file1][file2];
              coupling[file1][file2] = parseFloat((countAB / countA).toFixed(2));
          }
      }
  } catch (e) {
      // Git might not be initialized
      console.warn("Git coupling analysis failed (likely no git repo):", e);
  }

  return coupling;
}
