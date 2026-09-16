"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

async function callResultsApi(action: string, payload: Record<string, unknown>) {
  const res = await fetch("/api/admin/results", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json();
  return { ok: res.ok, data };
}

export function AggregateButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function run() {
    setLoading(true);
    const { ok, data } = await callResultsApi("aggregate", { sessionId });
    setLoading(false);
    if (!ok) alert(data.error);
    router.refresh();
  }
  return (
    <button onClick={run} disabled={loading} className="border border-forest px-3 py-1.5 text-xs text-forest dark:text-forest-light hover:bg-forest hover:text-white disabled:opacity-50">
      {loading ? "…" : "Aggregate"}
    </button>
  );
}

export function RankCategoryButton({ categoryId }: { categoryId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function run() {
    setLoading(true);
    const { ok, data } = await callResultsApi("rank", { categoryId });
    setLoading(false);
    if (!ok) alert(data.error);
    router.refresh();
  }
  return (
    <button onClick={run} disabled={loading} className="border border-forest px-4 py-2 text-sm text-forest dark:text-forest-light hover:bg-forest hover:text-white disabled:opacity-50">
      {loading ? "Ranking…" : "Rank category"}
    </button>
  );
}

export function PublishButton({ resultId }: { resultId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function run() {
    setLoading(true);
    const { ok, data } = await callResultsApi("publish", { resultId });
    setLoading(false);
    if (!ok) alert(data.error);
    router.refresh();
  }
  return (
    <button onClick={run} disabled={loading} className="border border-gold px-3 py-1.5 text-xs text-gold hover:bg-gold hover:text-white disabled:opacity-50">
      {loading ? "…" : "Publish"}
    </button>
  );
}

export function GenerateCertificateButton({ resultId, existingCode }: { resultId: string; existingCode?: string | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState(existingCode ?? "");
  async function run() {
    setLoading(true);
    const res = await fetch("/api/admin/certificates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resultId }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      alert(data.error);
      return;
    }
    setCode(data.certificate_code);
    router.refresh();
  }
  if (code) {
    return (
      <a
        href={`/api/certificates/${encodeURIComponent(code)}/pdf`}
        target="_blank"
        rel="noreferrer"
        className="tabnum text-xs text-forest dark:text-forest-light underline"
      >
        {code} (PDF)
      </a>
    );
  }
  return (
    <button onClick={run} disabled={loading} className="border border-hairline dark:border-dark-hairline px-3 py-1.5 text-xs text-ink-soft dark:text-dark-ink/70 hover:border-ink hover:text-ink dark:text-dark-ink disabled:opacity-50">
      {loading ? "…" : "Generate certificate"}
    </button>
  );
}
