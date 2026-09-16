"use client";

import { useEffect, useState, useCallback } from "react";
import { getPublicClient } from "@/lib/supabase/public";
import { getScoreboard, subscribeToScoreboard, type ScoreboardRow } from "@/lib/scoreboard/live";

export default function ScoreboardPage({ params }: { params: { categoryId: string } }) {
  const [rows, setRows] = useState<ScoreboardRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const db = getPublicClient();
    const data = await getScoreboard(db, params.categoryId);
    setRows(data);
    setLoading(false);
  }, [params.categoryId]);

  useEffect(() => {
    refresh();
    const db = getPublicClient();
    const unsubscribe = subscribeToScoreboard(db, params.categoryId, refresh);
    return unsubscribe;
  }, [params.categoryId, refresh]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-ink dark:text-dark-ink">Live scoreboard</h1>
        <span className="flex items-center gap-2 text-xs uppercase tracking-wide text-forest dark:text-forest-light">
          <span className="h-2 w-2 rounded-full bg-forest" />
          Live
        </span>
      </div>

      {loading ? (
        <p className="mt-8 text-ink-soft dark:text-dark-ink/60">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="mt-8 text-ink-soft dark:text-dark-ink/60">No scores are visible for this category yet.</p>
      ) : (
        <table className="mt-8 w-full border-t border-hairline dark:border-dark-hairline text-sm">
          <thead>
            <tr className="border-b border-hairline dark:border-dark-hairline text-left text-ink-soft dark:text-dark-ink/60">
              <th className="py-3 font-normal">Position</th>
              <th className="py-3 font-normal">Participant</th>
              <th className="py-3 font-normal">ID</th>
              <th className="py-3 text-right font-normal">Score</th>
              <th className="py-3 text-right font-normal">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.participantId} className="border-b border-hairline dark:border-dark-hairline">
                <td className="py-3 tabnum">
                  {row.position ? (
                    <span className={row.position <= 3 ? "font-medium text-gold" : ""}>{row.position}</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-3 text-ink dark:text-dark-ink">{row.participantName}</td>
                <td className="py-3 tabnum text-ink-soft dark:text-dark-ink/60">{row.participantCode}</td>
                <td className="py-3 text-right tabnum text-ink dark:text-dark-ink">{row.finalScore?.toFixed(2) ?? "—"}</td>
                <td className="py-3 text-right text-xs uppercase tracking-wide text-ink-soft dark:text-dark-ink/50">{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
