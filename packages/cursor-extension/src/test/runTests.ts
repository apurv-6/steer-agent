import * as path from "path";
import { runTests } from "@vscode/test-electron";

async function main() {
  try {
    // The folder containing the extension's package.json
    const extensionDevelopmentPath = path.resolve(__dirname, "../../");

    // The path to the extension test script
    const extensionTestsPath = path.resolve(__dirname, "./suite/index");

    await runTests({ extensionDevelopmentPath, extensionTestsPath });
  } catch (err) {
    console.error("Failed to run integration tests:", err);
    process.exit(1);
  }
}

main();
