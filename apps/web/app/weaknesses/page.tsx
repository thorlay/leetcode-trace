import { WeaknessDashboard } from "@/components/weakness-dashboard";
import { getWeaknessCategorySummary, getWeaknesses } from "@/lib/weaknesses";

export const dynamic = "force-dynamic";
export default async function WeaknessesPage() { const [weaknesses, categories] = await Promise.all([getWeaknesses(), getWeaknessCategorySummary()]); return <WeaknessDashboard weaknesses={weaknesses} categories={categories} locale="en" />; }
