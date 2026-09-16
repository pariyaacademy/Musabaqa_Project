"use client";

import { useState } from "react";

export default function AdminRolesPage() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("competition_admin");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    const res = await fetch("/api/admin/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setIsError(true);
      setMessage(data.error ?? "Failed to grant role.");
      return;
    }
    setIsError(false);
    setMessage(`Granted "${role}" to ${email}. If they didn't have an account, an invite email was sent.`);
    setEmail("");
  }

  return (
    <div className="max-w-md">
      <h1 className="font-display text-3xl text-ink dark:text-dark-ink">User roles</h1>
      <p className="mt-2 text-ink-soft dark:text-dark-ink/60">
        Grant a Musabaqa role by email. Requires the super_admin role on your own account — if you
        don&apos;t have it, this will return an authorization error.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label className="block text-sm text-ink-soft dark:text-dark-ink/70">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full border border-hairline dark:border-dark-hairline bg-surface dark:bg-dark-surface-alt px-3 py-2 focus:border-forest focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm text-ink-soft dark:text-dark-ink/70">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="mt-1 w-full border border-hairline dark:border-dark-hairline bg-surface dark:bg-dark-surface-alt px-3 py-2"
          >
            <option value="competition_admin">Competition admin</option>
            <option value="judge">Judge</option>
            <option value="super_admin">Super admin</option>
          </select>
        </div>

        {message && <p className={`text-sm ${isError ? "text-brick" : "text-forest dark:text-forest-light"}`}>{message}</p>}

        <button
          type="submit"
          disabled={loading}
          className="border border-forest bg-forest px-5 py-2.5 text-sm text-white hover:bg-forest-dark disabled:opacity-50"
        >
          {loading ? "Granting…" : "Grant role"}
        </button>
      </form>

      <p className="mt-8 text-xs text-ink-soft dark:text-dark-ink/50">
        Note: granting &quot;Competition admin&quot; here gives the role generally, without
        attaching them to a specific competition. To manage a <em>specific</em> competition, use the
        &quot;Administrators&quot; section on that competition&apos;s own admin page instead.
      </p>
    </div>
  );
}
