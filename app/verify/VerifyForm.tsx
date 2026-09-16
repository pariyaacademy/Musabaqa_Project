"use client";

import { useState } from "react";
import type { Dictionary } from "@/lib/i18n/dictionaries";

interface VerificationResult {
  valid: boolean;
  participantName?: string;
  competitionName?: string;
  categoryName?: string;
  position?: number | null;
  issueDate?: string;
}

export default function VerifyForm({ t }: { t: Dictionary["verify"] }) {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [status, setStatus] = useState<"idle" | "checking" | "done">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setStatus("checking");
    const res = await fetch(`/api/verify?code=${encodeURIComponent(code.trim())}`);
    const data = await res.json();
    setResult(data);
    setStatus("done");
  }

  return (
    <div className="max-w-md">
      <h1 className="font-display text-3xl text-ink dark:text-dark-ink">{t.heading}</h1>
      <p className="mt-3 text-ink-soft dark:text-dark-ink/60">{t.intro}</p>

      <form onSubmit={handleSubmit} className="mt-8 flex gap-3">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t.placeholder}
          className="flex-1 border border-hairline dark:border-dark-hairline bg-surface dark:bg-dark-surface-alt px-3 py-2 focus:border-forest focus:outline-none"
        />
        <button
          type="submit"
          disabled={status === "checking"}
          className="border border-forest bg-forest px-5 py-2.5 text-sm text-white hover:bg-forest-dark disabled:opacity-50"
        >
          {t.verifyButton}
        </button>
      </form>

      {status === "done" && result && (
        <div className="mt-8 border border-hairline dark:border-dark-hairline p-6">
          {result.valid ? (
            <>
              <p className="text-sm uppercase tracking-wide text-forest dark:text-forest-light">{t.validCertificate}</p>
              <dl className="mt-4 space-y-2 text-sm">
                <Row label={t.participant} value={result.participantName} />
                <Row label={t.competition} value={result.competitionName} />
                <Row label={t.category} value={result.categoryName} />
                <Row label={t.position} value={result.position ? String(result.position) : "—"} />
                <Row label={t.issueDate} value={result.issueDate} />
              </dl>
              <a
                href={`/api/certificates/${encodeURIComponent(code.trim())}/pdf`}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-block border border-forest px-4 py-2 text-sm text-forest dark:text-forest-light hover:bg-forest hover:text-white"
              >
                {t.downloadPdf}
              </a>
            </>
          ) : (
            <p className="text-sm text-brick">{t.notFound}</p>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between border-b border-hairline dark:border-dark-hairline pb-2">
      <dt className="text-ink-soft dark:text-dark-ink/60">{label}</dt>
      <dd className="text-ink dark:text-dark-ink">{value ?? "—"}</dd>
    </div>
  );
}
