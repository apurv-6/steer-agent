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
      question: "What constraints or scope boundaries should apply?",
      type: "open",
    });
  }

  if (questions.length >= MAX_QUESTIONS) return questions;

  if (result.missing.includes("REVIEW")) {
    questions.push({
      question: "How should the result be verified or tested?",
      type: "open",
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
      type: "open",
    });
  }

  return questions.slice(0, MAX_QUESTIONS);
}
