import * as path from "node:path";
import { z } from "zod";
import { workflow } from "@steer-agent-tool/core";

const { getStatus } = workflow;

export const StatusParamsSchema = {
  repoPath: z.string().describe("Absolute path to the repository root"),
};

export async function handleStatus(args: { repoPath: string }) {
  try {
    const steerDir = path.join(args.repoPath, ".steer");
    const statusText = getStatus(steerDir);

    return {
      content: [{ type: "text" as const, text: statusText }],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }],
      isError: true,
    };
  }
}
