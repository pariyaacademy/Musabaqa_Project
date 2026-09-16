import { getServerClient } from "@/lib/supabase/server";
import { NewJudgeForm, InviteJudgeButton } from "./Controls";

export const dynamic = "force-dynamic";

export default async function AdminJudgesPage() {
  const db = getServerClient();
  const { data: judges, error } = await db
    .schema("musabaqa")
    .from("judges")
    .select("id, full_name, email, phone, specialization, status, user_id")
    .order("full_name", { ascending: true });
  if (error) throw error;

  return (
    <div>
      <h1 className="font-display text-3xl text-ink dark:text-dark-ink">Judges</h1>
      <p className="mt-2 text-ink-soft dark:text-dark-ink/60">
        Judges are a shared pool across competitions. Create a judge, then invite them by email to
        give them a sign-in — they&apos;ll get a link to set a password and access{" "}
        <span className="font-mono text-sm">/judge</span>.
      </p>

      <div className="mt-6">
        <NewJudgeForm />
      </div>

      <div className="star-divider my-8" />

      {!judges || judges.length === 0 ? (
        <p className="text-ink-soft dark:text-dark-ink/60">No judges yet.</p>
      ) : (
        <ul className="divide-y divide-hairline dark:divide-dark-hairline border-t border-hairline dark:border-dark-hairline">
          {judges.map((j) => (
            <li key={j.id} className="flex items-center justify-between py-4">
              <div>
                <p className="text-ink dark:text-dark-ink">{j.full_name}</p>
                <p className="text-sm text-ink-soft dark:text-dark-ink/60">
                  {j.specialization ?? "—"}
                  {j.email ? ` · ${j.email}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-4">
                {j.user_id ? (
                  <span className="text-xs uppercase tracking-wide text-forest dark:text-forest-light">Account linked</span>
                ) : (
                  <InviteJudgeButton judgeId={j.id} defaultEmail={j.email} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
