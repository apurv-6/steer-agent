import type { Mode, ScoreResult, FollowUp } from "./types.js";

const MAX_QUESTIONS = 3;

export function generateFollowUps(result: ScoreResult, mode?: Mode): FollowUp[] {
  const questions: FollowUp[] = [];

  if (result.missing.includes("GOAL")) {
    questions.push({
      question: "What is the measurable outcome you expect from this task?",
      type: "open",
    });
  }

  if (questions.length >= MAX_QUESTIONS) return questions;

  if (result.missing.includes("LIMITS")) {
    questions.push({
      question: "What is the scope of this change?",
      type: "mcq",
      options: ["Only referenced files", "Module-level (related files ok)", "Repo-wide", "Not sure yet"],
    });
  }

  if (questions.length >= MAX_QUESTIONS) return questions;

  if (result.missing.includes("REVIEW")) {
    questions.push({
      question: "How should the result be verified?",
      type: "mcq",
      options: ["Run existing tests", "Manual testing", "Code review", "New tests required"],
    });
  }

  if (questions.length >= MAX_QUESTIONS) return questions;

  // File-scope MCQ when fileRefs exist
  if (result.fileRefs.length > 0) {
    questions.push({
      question: "Should changes be limited to referenced file(s) only?",
      type: "mcq",
      options: ["Yes, only these files", "Related files allowed", "Not sure"],
    });
  }

  if (questions.length >= MAX_QUESTIONS) return questions;

  // Bugfix/debug mode: ask for repro steps if no verification section
  if ((mode === "bugfix" || mode === "debug") && result.missing.includes("REVIEW")) {
    questions.push({
      question: "Do you have repro steps or error logs?",
      type: "mcq",
      options: ["Yes, have repro steps", "Have error logs only", "No repro steps yet"],
    });
  }

  return questions.slice(0, MAX_QUESTIONS);
}
