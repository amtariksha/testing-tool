"use client";

import { useState } from "react";
import type { TargetedQuestion } from "../types";

interface QuestionsPanelProps {
  questions: TargetedQuestion[];
  readOnly?: boolean;
  busy: boolean;
  onAnswer: (questionId: string, answer: string) => void;
  onSubmitAndRefuse: () => void;
}

/**
 * Scout's targeted questions (§4.3): inline answer boxes; saved answers become
 * human evidence and "Submit & re-fuse" feeds them into a fresh Scout run.
 */
export function QuestionsPanel({
  questions,
  readOnly,
  busy,
  onAnswer,
  onSubmitAndRefuse,
}: QuestionsPanelProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  if (questions.length === 0) return null;

  const answeredCount = questions.filter((q) => q.answer?.text).length;

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div>
          <h2 className="font-semibold">Scout&apos;s questions</h2>
          <p className="text-xs text-muted-foreground">
            Unknowns whose answers would change the model. Answers are saved as evidence.
          </p>
        </div>
        {!readOnly && (
          <button
            onClick={onSubmitAndRefuse}
            disabled={busy || answeredCount === 0}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl brand-gradient text-black hover:opacity-90 disabled:opacity-50"
          >
            Submit {answeredCount > 0 ? `${answeredCount} answer(s)` : "answers"} &amp; re-fuse
          </button>
        )}
      </div>
      <ul className="space-y-3">
        {questions.map((q) => (
          <li key={q.id} className="text-sm">
            <p>
              {q.question}
              {q.reason && (
                <span className="block text-xs text-muted-foreground">why: {q.reason}</span>
              )}
            </p>
            {q.answer?.text ? (
              <p className="mt-1 text-xs text-green-400">
                ✓ {q.answer.text}
                {q.answer.by && <span className="text-muted-foreground"> — {q.answer.by}</span>}
              </p>
            ) : readOnly ? (
              <p className="mt-1 text-xs text-muted-foreground italic">unanswered</p>
            ) : (
              <div className="mt-1 flex gap-2">
                <input
                  value={drafts[q.id] ?? ""}
                  onChange={(e) => setDrafts({ ...drafts, [q.id]: e.target.value })}
                  placeholder="Type an answer…"
                  className="flex-1 bg-card border border-border rounded-lg px-3 py-1.5 text-xs"
                />
                <button
                  onClick={() => {
                    const text = (drafts[q.id] ?? "").trim();
                    if (text) onAnswer(q.id, text);
                  }}
                  disabled={busy || !(drafts[q.id] ?? "").trim()}
                  className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-card disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
