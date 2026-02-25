import { z } from "zod";
import { initSteer } from "@steer-agent-tool/core";

export const InitSchema = {
  cwd: z.string().optional().describe("Root directory to initialize (defaults to current working directory)"),
};

export async function handleInit(args: { cwd?: string }) {
  try {
    const cwd = args.cwd || process.cwd();
    const result = await initSteer(cwd);

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: JSON.stringify({ error: msg }) }],
      isError: true,
    };
  }
}
