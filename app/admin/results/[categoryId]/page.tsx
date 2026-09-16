import { notFound } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { AggregateButton, RankCategoryButton, PublishButton, GenerateCertificateButton } from "./Controls";

export const dynamic = "force-dynamic";

async function getData(categoryId: string) {
  const db = getServerClient();

  const { data: category, error } = await db
    .schema("musabaqa")
    .from("competition_categories")
    .select("id, category_name")
    .eq("id", categoryId)
    .maybeSingle();
  if (error) throw error;
  if (!category) return null;

  const { data: submittedSessions } = await db
    .schema("musabaqa")
    .from("competition_sessions")
    .select("id, status, participants(full_name, participant_code)")
    .eq("category_id", categoryId)
    .eq("status", "SUBMITTED");

  const { data: results } = await db
    .schema("musabaqa")
    .from("results")
    .select("id, position, final_score, award, published, participants(full_name, participant_code), certificates(certificate_code)")
    .eq("category_id", categoryId)
    .order("position", { ascending: true, nullsFirst: false });

  return { category, submittedSessions: submittedSessions ?? [], results: results ?? [] };
}

export default async function ResultsPage({ params }: { params: { categoryId: string } }) {
  const data = await getData(params.categoryId);
  if (!data) notFound();
  const { category, submittedSessions, results } = data;

  return (
    <div>
      <h1 className="font-display text-3xl text-ink dark:text-dark-ink">Results — {category.category_name}</h1>

      {submittedSessions.length > 0 && (
        <>
          <div className="star-divider my-8" />
          <h2 className="font-display text-xl text-ink dark:text-dark-ink">Awaiting aggregation</h2>
          <ul className="mt-4 divide-y divide-hairline dark:divide-dark-hairline border-t border-hairline dark:border-dark-hairline">
            {submittedSessions.map((s) => {
              const p = Array.isArray(s.participants) ? s.participants[0] : s.participants;
              return (
                <li key={s.id} className="flex items-center justify-between py-3">
                  <span className="text-ink dark:text-dark-ink">{p?.full_name}</span>
                  <AggregateButton sessionId={s.id} />
                </li>
              );
            })}
          </ul>
        </>
      )}

      <div className="star-divider my-8" />

      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-ink dark:text-dark-ink">Ranked results</h2>
        <RankCategoryButton categoryId={category.id} />
      </div>

      {results.length === 0 ? (
        <p className="mt-4 text-ink-soft dark:text-dark-ink/60">No aggregated results yet.</p>
      ) : (
        <table className="mt-6 w-full border-t border-hairline dark:border-dark-hairline text-sm">
          <thead>
            <tr className="border-b border-hairline dark:border-dark-hairline text-left text-ink-soft dark:text-dark-ink/60">
              <th className="py-2 font-normal">Pos</th>
              <th className="py-2 font-normal">Participant</th>
              <th className="py-2 text-right font-normal">Score</th>
              <th className="py-2 font-normal">Award</th>
              <th className="py-2 font-normal">Status</th>
              <th className="py-2 font-normal">Certificate</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => {
              const p = Array.isArray(r.participants) ? r.participants[0] : r.participants;
              const cert = Array.isArray(r.certificates) ? r.certificates[0] : r.certificates;
              return (
                <tr key={r.id} className="border-b border-hairline dark:border-dark-hairline">
                  <td className="py-3 tabnum">{r.position ?? "—"}</td>
                  <td className="py-3 text-ink dark:text-dark-ink">{p?.full_name}</td>
                  <td className="py-3 text-right tabnum">{r.final_score?.toFixed(2) ?? "—"}</td>
                  <td className="py-3 text-ink-soft dark:text-dark-ink/70">{r.award ?? "—"}</td>
                  <td className="py-3">
                    {r.published ? (
                      <span className="text-xs uppercase tracking-wide text-forest dark:text-forest-light">Published</span>
                    ) : (
                      <PublishButton resultId={r.id} />
                    )}
                  </td>
                  <td className="py-3">
                    {r.published && <GenerateCertificateButton resultId={r.id} existingCode={cert?.certificate_code} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
