"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewJudgeForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/admin/judges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: form.get("fullName"),
        phone: form.get("phone") || undefined,
        email: form.get("email") || undefined,
        specialization: form.get("specialization") || undefined,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to create judge.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="border border-forest px-4 py-2 text-sm text-forest dark:text-forest-light hover:bg-forest hover:text-white">
        New judge
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4 border border-hairline dark:border-dark-hairline p-5">
      <div>
        <label className="block text-sm text-ink-soft dark:text-dark-ink/70">Full name</label>
        <input name="fullName" required className="mt-1 w-full border border-hairline dark:border-dark-hairline bg-surface dark:bg-dark-surface-alt px-3 py-2" />
      </div>
      <div>
        <label className="block text-sm text-ink-soft dark:text-dark-ink/70">Specialization</label>
        <input name="specialization" placeholder="e.g. Tajweed, 30 Juz Hafiz" className="mt-1 w-full border border-hairline dark:border-dark-hairline bg-surface dark:bg-dark-surface-alt px-3 py-2" />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-sm text-ink-soft dark:text-dark-ink/70">Phone</label>
          <input name="phone" className="mt-1 w-full border border-hairline dark:border-dark-hairline bg-surface dark:bg-dark-surface-alt px-3 py-2" />
        </div>
        <div className="flex-1">
          <label className="block text-sm text-ink-soft dark:text-dark-ink/70">Email</label>
          <input name="email" type="email" className="mt-1 w-full border border-hairline dark:border-dark-hairline bg-surface dark:bg-dark-surface-alt px-3 py-2" />
        </div>
      </div>
      <p className="text-xs text-ink-soft dark:text-dark-ink/50">
        This just records the judge. Use &quot;Invite&quot; afterward to send them an account.
      </p>
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

export function InviteJudgeButton({ judgeId, defaultEmail }: { judgeId: string; defaultEmail: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function sendInvite() {
    if (!email.trim()) return;
    setLoading(true);
    setMessage("");
    const res = await fetch("/api/admin/judges/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ judgeId, email: email.trim() }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage(data.error ?? "Failed to invite.");
      return;
    }
    setMessage("Invite sent.");
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <button onClick={() => setEditing(true)} className="border border-hairline dark:border-dark-hairline px-3 py-1.5 text-xs text-ink-soft dark:text-dark-ink/70 hover:border-ink hover:text-ink dark:text-dark-ink">
          Invite
        </button>
        {message && <span className="text-xs text-ink-soft dark:text-dark-ink/50">{message}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="email@example.com"
        className="w-48 border border-hairline dark:border-dark-hairline bg-surface dark:bg-dark-surface-alt px-2 py-1 text-xs"
      />
      <button onClick={sendInvite} disabled={loading} className="border border-forest px-3 py-1.5 text-xs text-forest dark:text-forest-light hover:bg-forest hover:text-white disabled:opacity-50">
        {loading ? "Sending…" : "Send"}
      </button>
    </div>
  );
}
