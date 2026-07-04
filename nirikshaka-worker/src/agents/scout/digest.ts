/**
 * Pure builders for the extra context Scout feeds into SpecMiner on re-fuse:
 * human answers to targeted questions (gap 4) and Critic findings that caused
 * a rejection (gap 5). Both are appended to the PRD source content so the
 * LLM treats them as authoritative spec input.
 */

export interface QuestionAnswer {
  questionId: string;
  question: string;
  answer: string;
  featureId?: string;
  by?: string;
}

export interface CriticGuidance {
  severity: string;
  claim: string;
  detail: string;
  suggestedFix?: string;
}

export function buildAnswerDigest(answers: QuestionAnswer[]): string {
  if (answers.length === 0) return "";
  const lines = answers.map((a) => `Q: ${a.question}\nA: ${a.answer}`);
  return `\n\n## Human answers to Scout's questions (authoritative)\n\n${lines.join("\n\n")}`;
}

export function buildGuidanceDigest(guidance: CriticGuidance[]): string {
  if (guidance.length === 0) return "";
  const lines = guidance.map(
    (g) =>
      `- [${g.severity}] ${g.claim}: ${g.detail}${g.suggestedFix ? ` (fix: ${g.suggestedFix})` : ""}`
  );
  return `\n\n## Reviewer findings to address in this revision\n\n${lines.join("\n")}`;
}
