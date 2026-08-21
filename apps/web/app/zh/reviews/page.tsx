import { ReviewSession } from "@/components/review-session";
import { getTodayReviewTasks } from "@/lib/reviews/service";
export const dynamic = "force-dynamic";
export default async function ChineseReviewsPage() { const tasks = await getTodayReviewTasks().catch(() => []); return <ReviewSession initialTasks={tasks} locale="zh" />; }
