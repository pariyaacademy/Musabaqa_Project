"use client";

import { useState } from "react";
import type { Dictionary } from "@/lib/i18n/dictionaries";

interface Props {
  competitionId: string;
  categoryId: string;
  categoryName: string;
  requiresAge: boolean;
  requiresGender: boolean;
  t: Dictionary["register"];
}

export default function RegisterForm({ competitionId, categoryId, categoryName, requiresAge, requiresGender, t }: Props) {
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [participantCode, setParticipantCode] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage("");

    const form = new FormData(e.currentTarget);
    const payload = {
      competitionId,
      categoryId,
      fullName: form.get("fullName"),
      dateOfBirth: form.get("dateOfBirth") || undefined,
      gender: form.get("gender") || undefined,
      city: form.get("city") || undefined,
      state: form.get("state") || undefined,
      country: form.get("country") || undefined,
      organization: form.get("organization") || undefined,
      teacher: form.get("teacher") || undefined,
      phone: form.get("phone") || undefined,
      email: form.get("email") || undefined,
    };

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setErrorMessage(data.error ?? "Registration failed.");
        return;
      }
      setParticipantCode(data.participantCode);
      setStatus("done");
    } catch {
      setStatus("error");
      setErrorMessage("Could not reach the server. Please try again.");
    }
  }

  if (status === "done") {
    return (
      <div className="border border-emerald p-6">
        <p className="text-sm uppercase tracking-wide text-emerald">{t.registeredHeading}</p>
        <p className="mt-2 text-ink/80">
          {t.registeredBody} <strong>{categoryName}</strong>.
        </p>
        <p className="mt-3 font-display text-2xl tabnum text-ink">{participantCode}</p>
        <p className="mt-3 text-sm text-ink/60">{t.participantIdNote}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-5">
      <Field label={t.fullName} name="fullName" required />
      {requiresAge && <Field label={t.dateOfBirth} name="dateOfBirth" type="date" required />}
      {requiresGender && (
        <div>
          <label className="block text-sm text-ink/70">{t.gender}</label>
          <select name="gender" required className="mt-1 w-full border border-hairline bg-ivory px-3 py-2">
            <option value="">{t.selectGender}</option>
            <option value="Male">{t.male}</option>
            <option value="Female">{t.female}</option>
          </select>
        </div>
      )}
      <Field label={t.city} name="city" />
      <Field label={t.state} name="state" />
      <Field label={t.country} name="country" />
      <Field label={t.organization} name="organization" />
      <Field label={t.teacher} name="teacher" />
      <Field label={t.phone} name="phone" type="tel" />
      <Field label={t.email} name="email" type="email" />

      {status === "error" && <p className="text-sm text-brick">{errorMessage}</p>}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="border border-emerald bg-emerald px-5 py-2.5 text-sm text-ivory hover:bg-emerald-dark disabled:opacity-50"
      >
        {status === "submitting" ? t.submitting : t.submit}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm text-ink/70">{label}</label>
      <input
        name={name}
        type={type}
        required={required}
        className="mt-1 w-full border border-hairline bg-ivory px-3 py-2 focus:border-emerald focus:outline-none"
      />
    </div>
  );
}
