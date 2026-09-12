"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ApproveParticipantButtons({ participantId }: { participantId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"APPROVED" | "REJECTED" | null>(null);

  async function decide(decision: "APPROVED" | "REJECTED") {
    setLoading(decision);
    await fetch(`/api/admin/participants/${participantId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    setLoading(null);
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => decide("APPROVED")}
        disabled={loading !== null}
        className="border border-emerald px-3 py-1.5 text-xs text-emerald hover:bg-emerald hover:text-ivory disabled:opacity-50"
      >
        {loading === "APPROVED" ? "…" : "Approve"}
      </button>
      <button
        onClick={() => decide("REJECTED")}
        disabled={loading !== null}
        className="border border-brick px-3 py-1.5 text-xs text-brick hover:bg-brick hover:text-ivory disabled:opacity-50"
      >
        {loading === "REJECTED" ? "…" : "Reject"}
      </button>
    </div>
  );
}
