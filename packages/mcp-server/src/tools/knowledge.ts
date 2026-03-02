import { z } from "zod";
import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { steerDirExists } from "@steer-agent-tool/core";

export const KnowledgeSchema = {
  action: z.enum(["list", "search", "view"]).describe("Action: list all, search by keyword, or view specific module"),
  query: z.string().optional().describe("Search keyword or module name"),
  cwd: z.string().optional().describe("Root directory (defaults to cwd)"),
};

export async function handleKnowledge(args: { action: string; query?: string; cwd?: string }) {
  try {
    const cwd = args.cwd || process.cwd();

    if (!steerDirExists(cwd)) {
      return {
        content: [{ type: "text" as const, text: "SteerAgent is not initialized in this project.\n\nRun:\n  steer-agent init\n\nOr with npx:\n  npx @coinswitch/steer-agent init" }],
      };
    }

    const knowledgeDir = join(cwd, ".steer", "knowledge");

    if (!existsSync(knowledgeDir)) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: "No knowledge directory. Run steer.init first." }) }] };
    }

    const files = readdirSync(knowledgeDir).filter((f) => f.endsWith(".md"));

    switch (args.action) {
      case "list": {
        const list = files.map((f) => {
          const content = readFileSync(join(knowledgeDir, f), "utf-8");
          const lines = content.split("\n").length;
          return { module: f.replace(".md", ""), file: f, lines };
        });
        return { content: [{ type: "text" as const, text: JSON.stringify({ modules: list, total: list.length }, null, 2) }] };
      }

      case "search": {
        if (!args.query) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ error: "query required for search action" }) }] };
        }
        const query = args.query.toLowerCase();
        const matches = files
          .map((f) => {
            const content = readFileSync(join(knowledgeDir, f), "utf-8");
            if (content.toLowerCase().includes(query) || f.toLowerCase().includes(query)) {
              // Find matching lines
              const matchLines = content.split("\n")
                .map((line, i) => ({ line: i + 1, text: line }))
                .filter((l) => l.text.toLowerCase().includes(query));
              return { module: f.replace(".md", ""), matches: matchLines.slice(0, 5) };
            }
            return null;
          })
          .filter(Boolean);

        return { content: [{ type: "text" as const, text: JSON.stringify({ query: args.query, results: matches }, null, 2) }] };
      }

      case "view": {
        if (!args.query) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ error: "query (module name) required for view action" }) }] };
        }
        const fileName = args.query.endsWith(".md") ? args.query : `${args.query}.md`;
        const filePath = join(knowledgeDir, fileName);
        if (!existsSync(filePath)) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Module not found: ${args.query}` }) }] };
        }
        const content = readFileSync(filePath, "utf-8");
        return { content: [{ type: "text" as const, text: content }] };
      }

      default:
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Unknown action: ${args.action}` }) }] };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }], isError: true };
  }
}
