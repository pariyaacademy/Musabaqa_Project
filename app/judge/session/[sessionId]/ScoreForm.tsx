"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Criterion {
  id: string;
  criterion_name: string;
  max_score: number;
}

interface ExistingScore {
  criterion_id: string;
  raw_score: number;
  deductions: number;
  locked: boolean;
}

interface Props {
  sessionId: string;
  criteria: Criterion[];
  existingScores: ExistingScore[];
}

export default function ScoreForm({ sessionId, criteria, existingScores }: Props) {
  const router = useRouter();
  const existingByCriterion = new Map(existingScores.map((s) => [s.criterion_id, s]));
  const anyLocked = existingScores.some((s) => s.locked);

  const [values, setValues] = useState<Record<string, { rawScore: string; deductions: string; comments: string }>>(
    Object.fromEntries(
      criteria.map((c) => {
        const existing = existingByCriterion.get(c.id);
        return [
          c.id,
          {
            rawScore: existing ? String(existing.raw_score) : "",
            deductions: existing ? String(existing.deductions) : "0",
            comments: "",
          },
        ];
      })
    )
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function saveCriterion(criterionId: string) {
    setSavingId(criterionId);
    setMessage("");
    const v = values[criterionId];
    const res = await fetch("/api/scoring/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        criterionId,
        rawScore: Number(v.rawScore),
        deductions: Number(v.deductions || 0),
        comments: v.comments || undefined,
      }),
    });
    const data = await res.json();
    setSavingId(null);
    setMessage(res.ok ? "Saved." : data.error ?? "Failed to save.");
    router.refresh();
  }

  async function lockAll() {
    const res = await fetch("/api/scoring/lock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    const data = await res.json();
    setMessage(res.ok ? "Scores locked." : data.error ?? "Failed to lock.");
    router.refresh();
  }

  return (
    <div className="mt-4 space-y-6">
      {criteria.map((c) => {
        const existing = existingByCriterion.get(c.id);
        const locked = existing?.locked ?? false;
        return (
          <div key={c.id} className="border border-hairline dark:border-dark-hairline p-4">
            <div className="flex items-baseline justify-between">
              <p className="font-display text-lg text-ink dark:text-dark-ink">{c.criterion_name}</p>
              <p className="text-xs text-ink-soft dark:text-dark-ink/50">max {c.max_score}</p>
            </div>
            <div className="mt-3 flex gap-4">
              <div className="flex-1">
                <label className="block text-xs text-ink-soft dark:text-dark-ink/60">Raw score</label>
                <input
                  type="number"
                  min={0}
                  max={c.max_score}
                  disabled={locked}
                  value={values[c.id]?.rawScore ?? ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, [c.id]: { ...prev[c.id], rawScore: e.target.value } }))}
                  className="mt-1 w-full border border-hairline dark:border-dark-hairline bg-surface dark:bg-dark-surface-alt px-3 py-2 tabnum focus:border-forest focus:outline-none disabled:opacity-50"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-ink-soft dark:text-dark-ink/60">Deductions</label>
                <input
                  type="number"
                  min={0}
                  disabled={locked}
                  value={values[c.id]?.deductions ?? "0"}
                  onChange={(e) => setValues((prev) => ({ ...prev, [c.id]: { ...prev[c.id], deductions: e.target.value } }))}
                  className="mt-1 w-full border border-hairline dark:border-dark-hairline bg-surface dark:bg-dark-surface-alt px-3 py-2 tabnum focus:border-forest focus:outline-none disabled:opacity-50"
                />
              </div>
            </div>
            <textarea
              placeholder="Comments (optional)"
              disabled={locked}
              value={values[c.id]?.comments ?? ""}
              onChange={(e) => setValues((prev) => ({ ...prev, [c.id]: { ...prev[c.id], comments: e.target.value } }))}
              className="mt-3 w-full border border-hairline dark:border-dark-hairline bg-surface dark:bg-dark-surface-alt px-3 py-2 text-sm focus:border-forest focus:outline-none disabled:opacity-50"
              rows={2}
            />
            <button
              onClick={() => saveCriterion(c.id)}
              disabled={locked || savingId === c.id || !values[c.id]?.rawScore}
              className="mt-3 border border-forest px-4 py-1.5 text-sm text-forest dark:text-forest-light hover:bg-forest hover:text-white disabled:opacity-50"
            >
              {savingId === c.id ? "Saving…" : locked ? "Locked" : "Save"}
            </button>
          </div>
        );
      })}

      {message && <p className="text-sm text-ink-soft dark:text-dark-ink/70">{message}</p>}

      <button
        onClick={lockAll}
        disabled={anyLocked}
        className="border border-brick px-5 py-2.5 text-sm text-brick hover:bg-brick hover:text-white disabled:opacity-40"
      >
        {anyLocked ? "Scores locked" : "Lock my scores for this session"}
      </button>
      <p className="text-xs text-ink-soft dark:text-dark-ink/50">
        Locking prevents further edits by you. Corrections after locking require an admin.
      </p>
    </div>
  );
}
