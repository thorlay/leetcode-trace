import { Dashboard } from "@/components/dashboard";
import { getRecentSessions } from "@/lib/sessions";
import { getTodayReviewTasks } from "@/lib/reviews/service";
import { getWeaknessCategorySummary, getWeaknesses } from "@/lib/weaknesses";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [sessions, reviews, weaknesses, categories] = await Promise.all([getRecentSessions(), getTodayReviewTasks().catch(() => []), getWeaknesses(), getWeaknessCategorySummary()]);
  return <Dashboard sessions={sessions} reviewCount={reviews.length} weaknesses={weaknesses} categories={categories} locale="en" />;
}
