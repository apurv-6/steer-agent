import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { glob } from "glob";
import fs from "fs-extra";
import { chunkFile, type Chunk } from "./chunker.js";

export interface KeywordIndex {
  version: number;
  chunks: Chunk[];
  /** keyword → chunk IDs that contain it */
  invertedIndex: Record<string, string[]>;
  /** keyword → document frequency (number of chunks containing it) */
  df: Record<string, number>;
  totalChunks: number;
  builtAt: string;
}

/**
 * Build a keyword index from all source files in the project.
 * Stores result in .steer/embeddings/index.json.
 */
export async function buildIndex(root: string): Promise<KeywordIndex> {
  const files = await glob("**/*.{ts,js,jsx,tsx,py,go,rs,java,kt}", {
    cwd: root,
    ignore: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**", "**/.steer/**"],
  });

  const allChunks: Chunk[] = [];

  for (const file of files) {
    const filePath = join(root, file);
    const content = await fs.readFile(filePath, "utf-8");
    const chunks = chunkFile(file, content);
    allChunks.push(...chunks);
  }

  // Build inverted index (Object.create(null) avoids prototype key collisions like "constructor")
  const invertedIndex: Record<string, string[]> = Object.create(null);
  const df: Record<string, number> = Object.create(null);

  for (const chunk of allChunks) {
    const uniqueKeywords = new Set(chunk.keywords);
    for (const kw of uniqueKeywords) {
      if (!invertedIndex[kw]) invertedIndex[kw] = [];
      invertedIndex[kw].push(chunk.id);
      df[kw] = (df[kw] || 0) + 1;
    }
  }

  const index: KeywordIndex = {
    version: 1,
    chunks: allChunks,
    invertedIndex,
    df,
    totalChunks: allChunks.length,
    builtAt: new Date().toISOString(),
  };

  // Persist
  const embeddingsDir = join(root, ".steer", "embeddings");
  if (!existsSync(embeddingsDir)) mkdirSync(embeddingsDir, { recursive: true });
  writeFileSync(join(embeddingsDir, "index.json"), JSON.stringify(index), "utf-8");

  return index;
}

/**
 * Load an existing index from disk.
 */
export function loadIndex(root: string): KeywordIndex | null {
  const indexPath = join(root, ".steer", "embeddings", "index.json");
  if (!existsSync(indexPath)) return null;
  return JSON.parse(readFileSync(indexPath, "utf-8"));
}
