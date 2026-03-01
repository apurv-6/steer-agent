import { extractKeywords, type Chunk } from "./chunker.js";
import type { KeywordIndex } from "./indexer.js";

export interface SearchResult {
  chunk: Chunk;
  score: number;       // TF-IDF relevance score
  matchedKeywords: string[];
}

/**
 * Search chunks by keyword relevance using TF-IDF scoring.
 * Returns top-k results sorted by score.
 */
export function searchChunks(
  query: string,
  index: KeywordIndex,
  topK: number = 10,
): SearchResult[] {
  const queryKeywords = extractKeywords(query);
  if (queryKeywords.length === 0) return [];

  const chunkScores = new Map<string, { score: number; matched: string[] }>();

  for (const kw of queryKeywords) {
    const chunkIds = index.invertedIndex[kw];
    if (!chunkIds) continue;

    // IDF = log(N / df)
    const idf = Math.log((index.totalChunks + 1) / (index.df[kw] + 1));

    for (const id of chunkIds) {
      const existing = chunkScores.get(id) || { score: 0, matched: [] };
      existing.score += idf;
      existing.matched.push(kw);
      chunkScores.set(id, existing);
    }
  }

  // Build chunk lookup
  const chunkMap = new Map<string, Chunk>();
  for (const chunk of index.chunks) {
    chunkMap.set(chunk.id, chunk);
  }

  // Sort by score, return top-k
  const results: SearchResult[] = [];
  for (const [id, { score, matched }] of chunkScores) {
    const chunk = chunkMap.get(id);
    if (chunk) {
      results.push({ chunk, score, matchedKeywords: matched });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK);
}
