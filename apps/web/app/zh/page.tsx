import type { Metadata } from "next";
import { Dashboard } from "@/components/dashboard";
import { getRecentSessions } from "@/lib/sessions";
import { getTodayReviewTasks } from "@/lib/reviews/service";
import { getWeaknessCategorySummary, getWeaknesses } from "@/lib/weaknesses";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Reviewly — AI 算法面试复习",
  description: "看清自己为什么卡住，再针对真正薄弱的知识点进行练习。",
};

export default async function ChineseHome() {
  const [sessions, reviews, weaknesses, categories] = await Promise.all([getRecentSessions(), getTodayReviewTasks().catch(() => []), getWeaknesses(), getWeaknessCategorySummary()]);
  return <Dashboard sessions={sessions} reviewCount={reviews.length} weaknesses={weaknesses} categories={categories} locale="zh" />;
}
