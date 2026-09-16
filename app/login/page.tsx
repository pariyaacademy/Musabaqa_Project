"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = getBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (signInError) {
      setError("Incorrect email or password.");
      return;
    }

    const next = searchParams.get("next") ?? "/";
    router.push(next);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="font-display text-3xl text-ink dark:text-dark-ink">Sign in</h1>
      <p className="mt-2 text-sm text-ink-soft dark:text-dark-ink/60">For judges and organizers. Participants don&apos;t need an account.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
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
          <label className="block text-sm text-ink-soft dark:text-dark-ink/70">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full border border-hairline dark:border-dark-hairline bg-surface dark:bg-dark-surface-alt px-3 py-2 focus:border-forest focus:outline-none"
          />
        </div>

        {error && <p className="text-sm text-brick">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full border border-forest bg-forest px-5 py-2.5 text-sm text-white hover:bg-forest-dark disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
