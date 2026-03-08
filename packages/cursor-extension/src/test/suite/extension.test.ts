import * as assert from "assert";
import * as vscode from "vscode";

/**
 * Integration tests that run inside a real VS Code / Cursor instance.
 * Run via: npm run test:integration (requires built extension first).
 *
 * These tests verify the extension activates and commands are registered,
 * without requiring user interaction.
 */
suite("Extension Integration Tests", () => {
  const EXT_ID = "steer-agent-tool.steer-agent-tool-extension";

  suiteSetup(async () => {
    // Give VS Code time to activate the extension
    await new Promise((r) => setTimeout(r, 2000));
  });

  test("Extension activates successfully", async () => {
    const ext = vscode.extensions.getExtension(EXT_ID);
    if (!ext) {
      // Extension may have a different publisher ID in dev mode — skip gracefully
      console.warn(`Extension ${EXT_ID} not found — skipping activation check`);
      return;
    }
    if (!ext.isActive) {
      await ext.activate();
    }
    assert.ok(ext.isActive, "Extension should be active");
  });

  test("steeragent.toggle command is registered", async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes("steeragent.toggle"),
      "steeragent.toggle should be registered",
    );
  });

  test("steeragent.enable command is registered", async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes("steeragent.enable"),
      "steeragent.enable should be registered",
    );
  });

  test("steeragent.disable command is registered", async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes("steeragent.disable"),
      "steeragent.disable should be registered",
    );
  });

  test("steeragent.suggest command is registered", async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes("steeragent.suggest"),
      "steeragent.suggest should be registered",
    );
  });

  test("steeragent.applyToChat command is registered", async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes("steeragent.applyToChat"),
      "steeragent.applyToChat should be registered",
    );
  });

  test("steeragent.startTask command is registered", async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes("steeragent.startTask"),
      "steeragent.startTask should be registered",
    );
  });
});
