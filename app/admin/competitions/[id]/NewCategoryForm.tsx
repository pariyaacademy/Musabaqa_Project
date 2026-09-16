"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewCategoryForm({ competitionId }: { competitionId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        competitionId,
        categoryName: form.get("categoryName"),
        startJuz: form.get("startJuz") ? Number(form.get("startJuz")) : undefined,
        endJuz: form.get("endJuz") ? Number(form.get("endJuz")) : undefined,
        durationMinutes: form.get("durationMinutes") ? Number(form.get("durationMinutes")) : undefined,
        numberOfQuestions: form.get("numberOfQuestions") ? Number(form.get("numberOfQuestions")) : undefined,
        numberOfJudges: form.get("numberOfJudges") ? Number(form.get("numberOfJudges")) : undefined,
        aggregationMethod: form.get("aggregationMethod"),
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to create category.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="border border-forest px-4 py-2 text-sm text-forest dark:text-forest-light hover:bg-forest hover:text-white">
        New category
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4 border border-hairline dark:border-dark-hairline p-5">
      <Field label="Category name (e.g. 10 Juz)" name="categoryName" required />
      <div className="flex gap-3">
        <Field label="Start Juz" name="startJuz" type="number" />
        <Field label="End Juz" name="endJuz" type="number" />
      </div>
      <div className="flex gap-3">
        <Field label="Duration (min)" name="durationMinutes" type="number" />
        <Field label="# Questions" name="numberOfQuestions" type="number" />
        <Field label="# Judges" name="numberOfJudges" type="number" />
      </div>
      <div>
        <label className="block text-sm text-ink-soft dark:text-dark-ink/70">Aggregation method</label>
        <select name="aggregationMethod" className="mt-1 w-full border border-hairline dark:border-dark-hairline bg-surface dark:bg-dark-surface-alt px-3 py-2">
          <option value="AVERAGE_ALL">Average all judges</option>
          <option value="DROP_LOWEST">Drop lowest</option>
          <option value="DROP_HIGHEST_AND_LOWEST">Drop highest and lowest</option>
          <option value="WEIGHTED_AVERAGE">Weighted average</option>
          <option value="CHAIRMAN_OVERRIDE">Chairman override</option>
        </select>
      </div>
      {error && <p className="text-sm text-brick">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={loading} className="border border-forest bg-forest px-4 py-2 text-sm text-white hover:bg-forest-dark disabled:opacity-50">
          {loading ? "Creating…" : "Create"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-sm text-ink-soft dark:text-dark-ink/60">
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({ label, name, type = "text", required }: { label: string; name: string; type?: string; required?: boolean }) {
  return (
    <div className="flex-1">
      <label className="block text-sm text-ink-soft dark:text-dark-ink/70">{label}</label>
      <input name={name} type={type} required={required} className="mt-1 w-full border border-hairline dark:border-dark-hairline bg-surface dark:bg-dark-surface-alt px-3 py-2 focus:border-forest focus:outline-none" />
    </div>
  );
}
