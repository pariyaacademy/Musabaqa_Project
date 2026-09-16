import Link from "next/link";
import { getServerClient } from "@/lib/supabase/server";
import NewCompetitionForm from "./NewCompetitionForm";

export const dynamic = "force-dynamic";

export default async function AdminCompetitionsPage() {
  const db = getServerClient();
  // RLS (competitions_admin_read) already limits this to competitions the
  // signed-in user administers, or everything for super_admin.
  const { data: competitions, error } = await db
    .schema("musabaqa")
    .from("competitions")
    .select("id, name, status, city, country, start_date")
    .order("start_date", { ascending: true });
  if (error) throw error;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-ink dark:text-dark-ink">Competitions</h1>
      </div>

      <div className="mt-8">
        <NewCompetitionForm />
      </div>

      <div className="star-divider my-8" />

      {!competitions || competitions.length === 0 ? (
        <p className="text-ink-soft dark:text-dark-ink/60">No competitions yet.</p>
      ) : (
        <ul className="divide-y divide-hairline dark:divide-dark-hairline border-t border-hairline dark:border-dark-hairline">
          {competitions.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-4">
              <div>
                <Link href={`/admin/competitions/${c.id}`} className="font-display text-lg text-ink dark:text-dark-ink hover:text-forest dark:text-forest-light">
                  {c.name}
                </Link>
                <p className="text-sm text-ink-soft dark:text-dark-ink/60">{[c.city, c.country].filter(Boolean).join(", ")}</p>
              </div>
              <span className="text-xs uppercase tracking-wide text-ink-soft dark:text-dark-ink/50">{c.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
