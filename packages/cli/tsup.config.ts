import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/mcp-entry.ts", "src/hooks/prompt-submit.ts"],
  format: ["esm"],
  clean: true,
  sourcemap: true,
  banner: { js: "#!/usr/bin/env node" },
});
