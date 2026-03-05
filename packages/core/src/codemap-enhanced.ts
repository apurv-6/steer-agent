import { readFileSync } from "fs";
import path from "path";

export interface SymbolInfo {
  name: string;
  kind: "class" | "function" | "interface" | "type" | "enum" | "const" | "variable";
  exported: boolean;
  line: number;
}

export interface EnhancedFileInfo {
  symbols: SymbolInfo[];
  exports: ExportInfo[];
  dynamicImports: string[];
  typeOnlyImports: string[];
}

export interface ExportInfo {
  name: string;
  kind: "named" | "default" | "re-export";
  source?: string; // for re-exports
}

const LANG_PATTERNS: Record<string, RegExp[]> = {
  ts: [
    // Classes
    /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/gm,
    // Functions (named, arrow at top level)
    /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/gm,
    // Interfaces
    /^(?:export\s+)?interface\s+(\w+)/gm,
    // Type aliases
    /^(?:export\s+)?type\s+(\w+)\s*=/gm,
    // Enums
    /^(?:export\s+)?(?:const\s+)?enum\s+(\w+)/gm,
    // Const declarations (exported)
    /^export\s+const\s+(\w+)/gm,
  ],
  py: [
    /^class\s+(\w+)/gm,
    /^(?:async\s+)?def\s+(\w+)/gm,
  ],
  go: [
    /^func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)/gm,
    /^type\s+(\w+)\s+struct/gm,
    /^type\s+(\w+)\s+interface/gm,
  ],
  java: [
    /(?:public|private|protected)?\s*(?:static\s+)?(?:abstract\s+)?class\s+(\w+)/gm,
    /(?:public|private|protected)?\s*(?:static\s+)?(?:abstract\s+)?\w+\s+(\w+)\s*\(/gm,
    /(?:public\s+)?interface\s+(\w+)/gm,
    /(?:public\s+)?enum\s+(\w+)/gm,
  ],
  rs: [
    /^pub\s+(?:async\s+)?fn\s+(\w+)/gm,
    /^(?:pub\s+)?struct\s+(\w+)/gm,
    /^(?:pub\s+)?enum\s+(\w+)/gm,
    /^(?:pub\s+)?trait\s+(\w+)/gm,
    /^impl\s+(\w+)/gm,
  ],
};

const EXT_TO_LANG: Record<string, string> = {
  ".ts": "ts", ".tsx": "ts", ".js": "ts", ".jsx": "ts",
  ".py": "py",
  ".go": "go",
  ".java": "java", ".kt": "java",
  ".rs": "rs",
};

/**
 * Extract symbols from a file using enhanced regex patterns.
 * No tree-sitter dependency — works with regex for common languages.
 */
export function extractSymbols(filePath: string, content?: string): EnhancedFileInfo {
  const ext = path.extname(filePath);
  const lang = EXT_TO_LANG[ext];
  const src = content ?? readFileSync(filePath, "utf-8");

  const result: EnhancedFileInfo = {
    symbols: [],
    exports: [],
    dynamicImports: [],
    typeOnlyImports: [],
  };

  if (!lang) return result;

  const patterns = LANG_PATTERNS[lang] || [];
  const lines = src.split("\n");

  // Extract symbols
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(src)) !== null) {
      const name = match[1];
      if (!name || name.startsWith("_") && lang === "py") continue;

      const lineNum = src.substring(0, match.index).split("\n").length;
      const lineText = lines[lineNum - 1] || "";
      const exported = lineText.trimStart().startsWith("export") ||
        (lang === "go" && name[0] === name[0].toUpperCase()) ||
        (lang === "rs" && lineText.includes("pub ")) ||
        (lang === "java" && lineText.includes("public "));

      const kind = detectKind(match[0]);

      result.symbols.push({ name, kind, exported, line: lineNum });
    }
  }

  // Deduplicate symbols by name+line
  const seen = new Set<string>();
  result.symbols = result.symbols.filter((s) => {
    const key = `${s.name}:${s.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Extract exports (TS/JS specific)
  if (lang === "ts") {
    result.exports = extractTsExports(src);
    result.dynamicImports = extractDynamicImports(src);
    result.typeOnlyImports = extractTypeOnlyImports(src);
  }

  return result;
}

function detectKind(matchText: string): SymbolInfo["kind"] {
  if (matchText.includes("class ")) return "class";
  if (matchText.includes("interface ")) return "interface";
  if (matchText.includes("type ") && matchText.includes("=")) return "type";
  if (matchText.includes("enum ")) return "enum";
  if (matchText.includes("function ") || matchText.includes("fn ") || matchText.includes("def ") || matchText.includes("func ")) return "function";
  if (matchText.includes("const ")) return "const";
  if (matchText.includes("struct ")) return "class";
  if (matchText.includes("trait ")) return "interface";
  if (matchText.includes("impl ")) return "class";
  return "variable";
}

function extractTsExports(src: string): ExportInfo[] {
  const exports: ExportInfo[] = [];

  // Named exports
  const namedRe = /export\s+(?:const|let|var|function|class|interface|type|enum|abstract)\s+(\w+)/g;
  let m;
  while ((m = namedRe.exec(src)) !== null) {
    exports.push({ name: m[1], kind: "named" });
  }

  // Default export
  if (/export\s+default\s+/.test(src)) {
    const defMatch = src.match(/export\s+default\s+(?:class|function)?\s*(\w+)?/);
    exports.push({ name: defMatch?.[1] || "default", kind: "default" });
  }

  // Re-exports
  const reExportRe = /export\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;
  while ((m = reExportRe.exec(src)) !== null) {
    const names = m[1].split(",").map((n) => n.trim().split(/\s+as\s+/).pop()!.trim());
    for (const name of names) {
      if (name) exports.push({ name, kind: "re-export", source: m[2] });
    }
  }

  // export * from
  const starRe = /export\s+\*\s+from\s+['"]([^'"]+)['"]/g;
  while ((m = starRe.exec(src)) !== null) {
    exports.push({ name: "*", kind: "re-export", source: m[1] });
  }

  return exports;
}

function extractDynamicImports(src: string): string[] {
  const imports: string[] = [];
  const re = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    imports.push(m[1]);
  }
  return imports;
}

function extractTypeOnlyImports(src: string): string[] {
  const imports: string[] = [];
  const re = /import\s+type\s+.*from\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    imports.push(m[1]);
  }
  return imports;
}
