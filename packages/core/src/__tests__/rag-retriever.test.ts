import { describe, it, expect } from "vitest";
import { searchChunks } from "../rag/retriever.js";
import type { KeywordIndex } from "../rag/indexer.js";

function makeIndex(): KeywordIndex {
  return {
    version: 1,
    chunks: [
      {
        id: "auth.ts:1", file: "auth.ts", startLine: 1, endLine: 10,
        name: "authenticate", content: "function authenticate() { ... }",
        keywords: ["authenticate", "user", "token", "session"],
      },
      {
        id: "login.ts:1", file: "login.ts", startLine: 1, endLine: 10,
        name: "handleLogin", content: "function handleLogin() { ... }",
        keywords: ["handle", "login", "user", "password"],
      },
      {
        id: "db.ts:1", file: "db.ts", startLine: 1, endLine: 10,
        name: "connectDB", content: "function connectDB() { ... }",
        keywords: ["connect", "database", "pool", "query"],
      },
    ],
    invertedIndex: {
      authenticate: ["auth.ts:1"],
      user: ["auth.ts:1", "login.ts:1"],
      token: ["auth.ts:1"],
      session: ["auth.ts:1"],
      handle: ["login.ts:1"],
      login: ["login.ts:1"],
      password: ["login.ts:1"],
      connect: ["db.ts:1"],
      database: ["db.ts:1"],
      pool: ["db.ts:1"],
      query: ["db.ts:1"],
    },
    df: {
      authenticate: 1, user: 2, token: 1, session: 1,
      handle: 1, login: 1, password: 1,
      connect: 1, database: 1, pool: 1, query: 1,
    },
    totalChunks: 3,
    builtAt: new Date().toISOString(),
  };
}

describe("rag/retriever", () => {
  it("finds relevant chunks by keyword", () => {
    const index = makeIndex();
    const results = searchChunks("user authentication token", index);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].chunk.file).toBe("auth.ts");
  });

  it("ranks by relevance (TF-IDF)", () => {
    const index = makeIndex();
    const results = searchChunks("database connection pool", index);

    expect(results[0].chunk.file).toBe("db.ts");
    expect(results[0].score).toBeGreaterThan(0);
  });

  it("returns empty for no matches", () => {
    const index = makeIndex();
    const results = searchChunks("completely unrelated xyz", index);
    expect(results).toHaveLength(0);
  });

  it("respects topK limit", () => {
    const index = makeIndex();
    const results = searchChunks("user", index, 1);
    expect(results.length).toBe(1);
  });

  it("includes matched keywords in results", () => {
    const index = makeIndex();
    const results = searchChunks("user login", index);
    const loginResult = results.find((r) => r.chunk.file === "login.ts");
    expect(loginResult).toBeDefined();
    expect(loginResult!.matchedKeywords).toContain("login");
  });
});
