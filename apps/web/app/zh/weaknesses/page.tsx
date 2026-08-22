import { WeaknessDashboard } from "@/components/weakness-dashboard";
import { getWeaknessCategorySummary, getWeaknesses } from "@/lib/weaknesses";

export const dynamic = "force-dynamic";
export default async function ChineseWeaknessesPage() {
  const [weaknesses, allCoreSignals, categories] = await Promise.all([
    getWeaknesses(true),
    getWeaknesses(true, 1),
    getWeaknessCategorySummary(true),
  ]);
  return (
    <WeaknessDashboard
      weaknesses={weaknesses}
      candidates={allCoreSignals.filter((item) => item.observationCount < 2)}
      categories={categories}
      locale="zh"
    />
  );
}
