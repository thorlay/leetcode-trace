import { WeaknessDashboard } from "@/components/weakness-dashboard";
import { getWeaknessCategorySummary, getWeaknesses } from "@/lib/weaknesses";

export const dynamic = "force-dynamic";
export default async function ChineseWeaknessesPage() { const [weaknesses, categories] = await Promise.all([getWeaknesses(true), getWeaknessCategorySummary(true)]); return <WeaknessDashboard weaknesses={weaknesses} categories={categories} locale="zh" />; }
