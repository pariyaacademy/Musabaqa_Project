"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddCompetitionAdminForm({ competitionId }: { competitionId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    const res = await fetch(`/api/admin/competitions/${competitionId}/admins`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setLoading(false);
    setIsError(!res.ok);
    setMessage(res.ok ? `Added ${email} as an admin of this competition.` : data.error ?? "Failed.");
    if (res.ok) {
      setEmail("");
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md items-end gap-3">
      <div className="flex-1">
        <label className="block text-xs text-ink-soft dark:text-dark-ink/60">Add admin by email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full border border-hairline dark:border-dark-hairline bg-surface dark:bg-dark-surface-alt px-3 py-2"
        />
      </div>
      <button type="submit" disabled={loading} className="border border-forest bg-forest px-4 py-2 text-sm text-white hover:bg-forest-dark disabled:opacity-50">
        {loading ? "Adding…" : "Add"}
      </button>
      {message && <p className={`text-xs ${isError ? "text-brick" : "text-forest dark:text-forest-light"}`}>{message}</p>}
    </form>
  );
}
