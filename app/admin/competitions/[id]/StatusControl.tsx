"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUSES = [
  "DRAFT",
  "REGISTRATION_OPEN",
  "REGISTRATION_CLOSED",
  "UPCOMING",
  "LIVE",
  "COMPLETED",
  "ARCHIVED",
];

export default function StatusControl({ competitionId, currentStatus }: { competitionId: string; currentStatus: string }) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleChange(newStatus: string) {
    setLoading(true);
    setMessage("");
    const res = await fetch(`/api/admin/competitions/${competitionId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage(data.error ?? "Failed to change status.");
      return;
    }
    setStatus(newStatus);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <select
        value={status}
        onChange={(e) => handleChange(e.target.value)}
        disabled={loading}
        className="border border-hairline dark:border-dark-hairline bg-surface dark:bg-dark-surface-alt px-3 py-1.5 text-xs uppercase tracking-wide text-forest dark:text-forest-light disabled:opacity-50"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.replace(/_/g, " ")}
          </option>
        ))}
      </select>
      {status === "DRAFT" && (
        <span className="text-xs text-brick">Hidden from the public site until this changes</span>
      )}
      {message && <span className="text-xs text-brick">{message}</span>}
    </div>
  );
}
