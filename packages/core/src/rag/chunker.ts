/**
 * Split source files into semantic chunks (function-level).
 * Each chunk is a named block of code that can be searched independently.
 */
export interface Chunk {
  id: string;          // file:startLine
  file: string;
  startLine: number;
  endLine: number;
  name: string;        // function/class name or "module"
  content: string;
  keywords: string[];
}

/**
 * Split a file into semantic chunks based on top-level declarations.
 */
export function chunkFile(filePath: string, content: string): Chunk[] {
  const lines = content.split("\n");
  const chunks: Chunk[] = [];

  // Detect top-level function/class/interface boundaries
  const boundaries: { line: number; name: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(
      /^(?:export\s+)?(?:async\s+)?(?:function|class|interface|type|enum|const|let|var|def|func|fn|pub\s+fn|pub\s+struct|struct|impl)\s+(\w+)/,
    );
    if (match) {
      boundaries.push({ line: i, name: match[1] });
    }
  }

  if (boundaries.length === 0) {
    // Whole file as one chunk
    const keywords = extractKeywords(content);
    chunks.push({
      id: `${filePath}:1`,
      file: filePath,
      startLine: 1,
      endLine: lines.length,
      name: "module",
      content,
      keywords,
    });
    return chunks;
  }

  // Create chunks from boundaries
  for (let i = 0; i < boundaries.length; i++) {
    const start = boundaries[i].line;
    const end = i + 1 < boundaries.length ? boundaries[i + 1].line - 1 : lines.length - 1;
    const chunkContent = lines.slice(start, end + 1).join("\n");
    const keywords = extractKeywords(chunkContent);

    chunks.push({
      id: `${filePath}:${start + 1}`,
      file: filePath,
      startLine: start + 1,
      endLine: end + 1,
      name: boundaries[i].name,
      content: chunkContent,
      keywords,
    });
  }

  return chunks;
}

/**
 * Extract keywords from text for TF-IDF-style matching.
 * Splits camelCase, removes stop words, lowercases.
 */
export function extractKeywords(text: string): string[] {
  const STOP_WORDS = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been",
    "import", "from", "export", "const", "let", "var", "function",
    "return", "if", "else", "for", "while", "new", "this", "true",
    "false", "null", "undefined", "void", "string", "number", "boolean",
    "any", "type", "interface", "class", "extends", "implements",
  ]);

  // Split on non-alphanumeric, then split camelCase
  const words = text
    .replace(/[^a-zA-Z0-9]/g, " ")
    .split(/\s+/)
    .flatMap((w) => w.replace(/([a-z])([A-Z])/g, "$1 $2").split(" "))
    .map((w) => w.toLowerCase())
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  // Unique
  return [...new Set(words)];
}
