"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GenerateQuestionsButton({ categoryId }: { categoryId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function generate() {
    setLoading(true);
    setMessage("");
    const res = await fetch("/api/admin/questions/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId, count: 10, minDistance: 3 }),
    });
    const data = await res.json();
    setLoading(false);
    setMessage(res.ok ? `Generated ${data.generated} questions.` : data.error ?? "Failed.");
    router.refresh();
  }

  return (
    <div>
      <button onClick={generate} disabled={loading} className="border border-forest px-4 py-2 text-sm text-forest dark:text-forest-light hover:bg-forest hover:text-white disabled:opacity-50">
        {loading ? "Generating…" : "Generate 10 questions"}
      </button>
      {message && <p className="mt-2 text-sm text-ink-soft dark:text-dark-ink/60">{message}</p>}
    </div>
  );
}

export function AddCriterionForm({ categoryId }: { categoryId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    await fetch("/api/admin/categories/criteria", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryId,
        criterionName: form.get("criterionName"),
        maxScore: Number(form.get("maxScore")),
        weight: Number(form.get("weight") || 1),
      }),
    });
    setLoading(false);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="border border-forest px-4 py-2 text-sm text-forest dark:text-forest-light hover:bg-forest hover:text-white">
        Add criterion
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md items-end gap-3">
      <div className="flex-1">
        <label className="block text-xs text-ink-soft dark:text-dark-ink/60">Name</label>
        <input name="criterionName" required className="mt-1 w-full border border-hairline dark:border-dark-hairline bg-surface dark:bg-dark-surface-alt px-3 py-2" />
      </div>
      <div>
        <label className="block text-xs text-ink-soft dark:text-dark-ink/60">Max</label>
        <input name="maxScore" type="number" required className="mt-1 w-20 border border-hairline dark:border-dark-hairline bg-surface dark:bg-dark-surface-alt px-3 py-2" />
      </div>
      <div>
        <label className="block text-xs text-ink-soft dark:text-dark-ink/60">Weight</label>
        <input name="weight" type="number" step="0.1" defaultValue={1} className="mt-1 w-20 border border-hairline dark:border-dark-hairline bg-surface dark:bg-dark-surface-alt px-3 py-2" />
      </div>
      <button type="submit" disabled={loading} className="border border-forest bg-forest px-3 py-2 text-sm text-white hover:bg-forest-dark">
        Add
      </button>
    </form>
  );
}

export function NewSessionForm({
  competitionId,
  categoryId,
  participants,
  judges,
}: {
  competitionId: string;
  categoryId: string;
  participants: { id: string; participant_code: string; full_name: string }[];
  judges: { id: string; full_name: string }[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    const form = new FormData(e.currentTarget);
    const judgeIds = form.getAll("judgeIds") as string[];
    const scheduledTime = form.get("scheduledTime") as string;
    const res = await fetch("/api/admin/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        competitionId,
        categoryId,
        participantId: form.get("participantId"),
        room: form.get("room") || undefined,
        scheduledTime: scheduledTime ? new Date(scheduledTime).toISOString() : undefined,
        judgeIds,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage(data.error);
      return;
    }
    let msg = `Session created — ${data.questionsAssigned} questions assigned (pool has ${data.poolSize}).`;
    if (data.warnings?.length) {
      msg += " ⚠ " + data.warnings.join(" ");
    }
    setMessage(msg);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4 border border-hairline dark:border-dark-hairline p-5">
      <div>
        <label className="block text-sm text-ink-soft dark:text-dark-ink/70">Participant</label>
        <select name="participantId" required className="mt-1 w-full border border-hairline dark:border-dark-hairline bg-surface dark:bg-dark-surface-alt px-3 py-2">
          <option value="">Select…</option>
          {participants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name} ({p.participant_code})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm text-ink-soft dark:text-dark-ink/70">Judges</label>
        <select name="judgeIds" multiple className="mt-1 w-full border border-hairline dark:border-dark-hairline bg-surface dark:bg-dark-surface-alt px-3 py-2">
          {judges.map((j) => (
            <option key={j.id} value={j.id}>
              {j.full_name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-ink-soft dark:text-dark-ink/50">First selected judge becomes chairman. Cmd/Ctrl-click for multiple.</p>
      </div>
      <div>
        <label className="block text-sm text-ink-soft dark:text-dark-ink/70">Date &amp; time (optional)</label>
        <input name="scheduledTime" type="datetime-local" className="mt-1 w-full border border-hairline dark:border-dark-hairline bg-surface dark:bg-dark-surface-alt px-3 py-2" />
      </div>
      <div>
        <label className="block text-sm text-ink-soft dark:text-dark-ink/70">Room (optional)</label>
        <input name="room" className="mt-1 w-full border border-hairline dark:border-dark-hairline bg-surface dark:bg-dark-surface-alt px-3 py-2" />
      </div>
      {message && <p className="text-sm text-ink-soft dark:text-dark-ink/70">{message}</p>}
      <button type="submit" disabled={loading} className="border border-forest bg-forest px-4 py-2 text-sm text-white hover:bg-forest-dark disabled:opacity-50">
        {loading ? "Creating…" : "Create session"}
      </button>
    </form>
  );
}
