import { notFound } from "next/navigation";
import { getPublicClient } from "@/lib/supabase/public";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import RegisterForm from "./RegisterForm";

export const revalidate = 30;

async function getCategory(categoryId: string) {
  const db = getPublicClient();
  const { data, error } = await db
    .schema("musabaqa")
    .from("competition_categories")
    .select("id, category_name, status, age_min, age_max, gender_restriction, competition_id, competitions(name)")
    .eq("id", categoryId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export default async function RegisterPage({ params }: { params: { categoryId: string } }) {
  const t = getDictionary(getLocale());
  const category = await getCategory(params.categoryId);
  if (!category || category.status !== "ACTIVE") notFound();

  const competition = Array.isArray(category.competitions) ? category.competitions[0] : category.competitions;

  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-emerald">{competition?.name}</p>
      <h1 className="mt-2 font-display text-3xl text-ink">
        {t.register.heading} — {category.category_name}
      </h1>
      <p className="mt-4 max-w-md text-ink/60">{t.register.intro}</p>
      <div className="mt-8">
        <RegisterForm
          competitionId={category.competition_id}
          categoryId={category.id}
          categoryName={category.category_name}
          requiresAge={category.age_min != null || category.age_max != null}
          requiresGender={category.gender_restriction !== "ANY"}
          t={t.register}
        />
      </div>
    </div>
  );
}
