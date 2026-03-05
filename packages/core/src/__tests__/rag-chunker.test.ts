import { describe, it, expect } from "vitest";
import { chunkFile, extractKeywords } from "../rag/chunker.js";

describe("rag/chunker", () => {
  it("chunks file by function boundaries", () => {
    const content = `
function foo() {
  return 1;
}

function bar() {
  return 2;
}
`;
    const chunks = chunkFile("test.ts", content);
    expect(chunks.length).toBe(2);
    expect(chunks[0].name).toBe("foo");
    expect(chunks[1].name).toBe("bar");
  });

  it("creates single chunk for files without boundaries", () => {
    const content = `// just a comment\n// another comment\nresult = 42;\n`;
    const chunks = chunkFile("test.ts", content);
    expect(chunks.length).toBe(1);
    expect(chunks[0].name).toBe("module");
  });

  it("handles class declarations", () => {
    const content = `
export class MyClass {
  method() {}
}

export class AnotherClass {
  method() {}
}
`;
    const chunks = chunkFile("test.ts", content);
    expect(chunks.length).toBe(2);
    expect(chunks[0].name).toBe("MyClass");
    expect(chunks[1].name).toBe("AnotherClass");
  });

  it("extractKeywords removes stop words", () => {
    const keywords = extractKeywords("import function from the module");
    expect(keywords).not.toContain("the");
    expect(keywords).not.toContain("import");
    expect(keywords).not.toContain("from");
    expect(keywords).toContain("module");
  });

  it("extractKeywords splits camelCase", () => {
    const keywords = extractKeywords("myServiceName");
    expect(keywords).toContain("service");
    expect(keywords).toContain("name");
  });
});
