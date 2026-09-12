"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewCompetitionForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/admin/competitions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        venue: form.get("venue") || undefined,
        city: form.get("city") || undefined,
        country: form.get("country") || undefined,
        startDate: form.get("startDate") || undefined,
        endDate: form.get("endDate") || undefined,
        registrationStart: form.get("registrationStart") || undefined,
        registrationEnd: form.get("registrationEnd") || undefined,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to create competition.");
      return;
    }
    router.push(`/admin/competitions/${data.id}`);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="border border-emerald px-4 py-2 text-sm text-emerald hover:bg-emerald hover:text-ivory">
        New competition
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4 border border-hairline p-5">
      <Field label="Name" name="name" required />
      <Field label="Venue" name="venue" />
      <div className="flex gap-3">
        <Field label="City" name="city" />
        <Field label="Country" name="country" />
      </div>
      <div className="flex gap-3">
        <Field label="Start date" name="startDate" type="date" />
        <Field label="End date" name="endDate" type="date" />
      </div>
      <div className="flex gap-3">
        <Field label="Registration opens" name="registrationStart" type="date" />
        <Field label="Registration closes" name="registrationEnd" type="date" />
      </div>
      {error && <p className="text-sm text-brick">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={loading} className="border border-emerald bg-emerald px-4 py-2 text-sm text-ivory hover:bg-emerald-dark disabled:opacity-50">
          {loading ? "Creating…" : "Create"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-sm text-ink/60">
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({ label, name, type = "text", required }: { label: string; name: string; type?: string; required?: boolean }) {
  return (
    <div className="flex-1">
      <label className="block text-sm text-ink/70">{label}</label>
      <input name={name} type={type} required={required} className="mt-1 w-full border border-hairline bg-ivory px-3 py-2 focus:border-emerald focus:outline-none" />
    </div>
  );
}
