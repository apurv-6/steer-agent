import { describe, it, expect } from "vitest";
import { extractSymbols } from "../codemap-enhanced.js";

describe("codemap-enhanced", () => {
  it("extracts TypeScript classes and functions", () => {
    const content = `
export class AuthService {
  login() {}
}

export function validateToken(token: string): boolean {
  return true;
}

interface Config {
  key: string;
}
`;
    const result = extractSymbols("test.ts", content);
    expect(result.symbols.length).toBeGreaterThanOrEqual(3);

    const classSymbol = result.symbols.find((s) => s.name === "AuthService");
    expect(classSymbol).toBeDefined();
    expect(classSymbol!.kind).toBe("class");
    expect(classSymbol!.exported).toBe(true);

    const funcSymbol = result.symbols.find((s) => s.name === "validateToken");
    expect(funcSymbol).toBeDefined();
    expect(funcSymbol!.kind).toBe("function");
  });

  it("detects named exports", () => {
    const content = `
export const VERSION = "1.0";
export function main() {}
export class App {}
`;
    const result = extractSymbols("test.ts", content);
    expect(result.exports.length).toBeGreaterThanOrEqual(3);
    expect(result.exports.some((e) => e.name === "VERSION" && e.kind === "named")).toBe(true);
  });

  it("detects default exports", () => {
    const content = `export default class MyApp {}`;
    const result = extractSymbols("test.ts", content);
    expect(result.exports.some((e) => e.kind === "default")).toBe(true);
  });

  it("detects re-exports", () => {
    const content = `export { foo, bar } from "./utils";`;
    const result = extractSymbols("test.ts", content);
    expect(result.exports.some((e) => e.kind === "re-export" && e.source === "./utils")).toBe(true);
  });

  it("detects dynamic imports", () => {
    const content = `const mod = await import("./dynamic.js");`;
    const result = extractSymbols("test.ts", content);
    expect(result.dynamicImports).toContain("./dynamic.js");
  });

  it("detects type-only imports", () => {
    const content = `import type { Foo } from "./types";`;
    const result = extractSymbols("test.ts", content);
    expect(result.typeOnlyImports).toContain("./types");
  });

  it("returns empty for unsupported languages", () => {
    const result = extractSymbols("test.xyz", "some content");
    expect(result.symbols).toHaveLength(0);
  });
});
