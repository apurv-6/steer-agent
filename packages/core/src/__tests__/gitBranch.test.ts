import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "child_process";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  getCurrentBranch,
  isWorkingTreeClean,
  createAttemptBranch,
  deleteAttemptBranch,
  mergeAttemptBranch,
  runBuildChecks,
} from "../gitBranch.js";

function initGitRepo(dir: string): void {
  execSync("git init", { cwd: dir });
  execSync("git config user.email test@test.com", { cwd: dir });
  execSync("git config user.name Test", { cwd: dir });
  // Create initial commit so HEAD exists
  execSync("git commit --allow-empty -m 'init'", { cwd: dir });
}

describe("gitBranch", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "steer-git-"));
    initGitRepo(tmpDir);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("getCurrentBranch", () => {
    it("returns the current branch name", () => {
      const branch = getCurrentBranch(tmpDir);
      // git init creates main or master depending on config
      expect(["main", "master"]).toContain(branch);
    });

    it("returns a custom branch after checkout", () => {
      execSync("git checkout -b feature/test", { cwd: tmpDir });
      expect(getCurrentBranch(tmpDir)).toBe("feature/test");
    });
  });

  describe("isWorkingTreeClean", () => {
    it("returns true for a clean repo", () => {
      expect(isWorkingTreeClean(tmpDir)).toBe(true);
    });

    it("returns false when there are untracked files", () => {
      require("fs").writeFileSync(join(tmpDir, "dirty.txt"), "hello");
      expect(isWorkingTreeClean(tmpDir)).toBe(false);
    });

    it("returns false when there are staged changes", () => {
      require("fs").writeFileSync(join(tmpDir, "staged.txt"), "hello");
      execSync("git add staged.txt", { cwd: tmpDir });
      expect(isWorkingTreeClean(tmpDir)).toBe(false);
    });
  });

  describe("createAttemptBranch", () => {
    it("creates and checks out an attempt branch", () => {
      const branchName = createAttemptBranch(tmpDir, "task-123", 1);
      expect(branchName).toBe("steer/task-123-attempt-1");
      expect(getCurrentBranch(tmpDir)).toBe("steer/task-123-attempt-1");
    });

    it("increments attempt number in branch name", () => {
      const b1 = createAttemptBranch(tmpDir, "task-456", 2);
      expect(b1).toBe("steer/task-456-attempt-2");
    });
  });

  describe("deleteAttemptBranch", () => {
    it("deletes a branch and returns to origin", () => {
      const origin = getCurrentBranch(tmpDir);
      createAttemptBranch(tmpDir, "task-del", 1);
      // We're on the attempt branch now
      expect(getCurrentBranch(tmpDir)).toBe("steer/task-del-attempt-1");

      deleteAttemptBranch(tmpDir, "steer/task-del-attempt-1", origin);
      expect(getCurrentBranch(tmpDir)).toBe(origin);

      // Branch should no longer exist
      const branches = execSync("git branch", { cwd: tmpDir, encoding: "utf-8" });
      expect(branches).not.toContain("steer/task-del-attempt-1");
    });

    it("deletes a branch when not currently on it", () => {
      const origin = getCurrentBranch(tmpDir);
      createAttemptBranch(tmpDir, "task-other", 1);
      // Go back to origin manually
      execSync(`git checkout ${origin}`, { cwd: tmpDir });

      deleteAttemptBranch(tmpDir, "steer/task-other-attempt-1", origin);
      const branches = execSync("git branch", { cwd: tmpDir, encoding: "utf-8" });
      expect(branches).not.toContain("steer/task-other-attempt-1");
    });
  });

  describe("mergeAttemptBranch", () => {
    it("squash merges an attempt branch", () => {
      const origin = getCurrentBranch(tmpDir);
      createAttemptBranch(tmpDir, "task-merge", 1);

      // Make a commit on the attempt branch
      require("fs").writeFileSync(join(tmpDir, "feature.txt"), "new feature");
      execSync("git add feature.txt", { cwd: tmpDir });
      execSync("git commit -m 'add feature'", { cwd: tmpDir });

      mergeAttemptBranch(tmpDir, "steer/task-merge-attempt-1", origin, "squash");

      expect(getCurrentBranch(tmpDir)).toBe(origin);
      // feature.txt should exist after merge
      expect(require("fs").existsSync(join(tmpDir, "feature.txt"))).toBe(true);
      // Branch should be deleted
      const branches = execSync("git branch", { cwd: tmpDir, encoding: "utf-8" });
      expect(branches).not.toContain("steer/task-merge-attempt-1");
    });

    it("ff merges an attempt branch", () => {
      const origin = getCurrentBranch(tmpDir);
      createAttemptBranch(tmpDir, "task-ff", 1);

      require("fs").writeFileSync(join(tmpDir, "ff.txt"), "ff content");
      execSync("git add ff.txt", { cwd: tmpDir });
      execSync("git commit -m 'ff commit'", { cwd: tmpDir });

      mergeAttemptBranch(tmpDir, "steer/task-ff-attempt-1", origin, "ff");

      expect(getCurrentBranch(tmpDir)).toBe(origin);
      expect(require("fs").existsSync(join(tmpDir, "ff.txt"))).toBe(true);
    });
  });

  describe("runBuildChecks", () => {
    it("passes when scripts succeed", () => {
      // Create a minimal package.json with a passing script
      require("fs").writeFileSync(
        join(tmpDir, "package.json"),
        JSON.stringify({ scripts: { build: "echo ok" } }),
      );

      const result = runBuildChecks(tmpDir, ["build"]);
      expect(result.passed).toBe(true);
      expect(result.checks).toHaveLength(1);
      expect(result.checks[0].name).toBe("build");
      expect(result.checks[0].passed).toBe(true);
    });

    it("fails when a script fails", () => {
      require("fs").writeFileSync(
        join(tmpDir, "package.json"),
        JSON.stringify({ scripts: { test: "exit 1" } }),
      );

      const result = runBuildChecks(tmpDir, ["test"]);
      expect(result.passed).toBe(false);
      expect(result.checks[0].passed).toBe(false);
    });

    it("passes when no scripts exist (--if-present)", () => {
      require("fs").writeFileSync(
        join(tmpDir, "package.json"),
        JSON.stringify({}),
      );

      const result = runBuildChecks(tmpDir, ["build", "lint", "test"]);
      expect(result.passed).toBe(true);
      expect(result.checks).toHaveLength(3);
    });
  });
});
