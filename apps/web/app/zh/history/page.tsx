import type { Metadata } from "next";
import { HistoryView } from "@/components/history-view";
import { getHistorySessions } from "@/lib/sessions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "解题记录 | Reviewly", description: "导入并查看 LeetCode 历史提交与解题轨迹。" };
export default async function ChineseHistoryPage() { return <HistoryView sessions={await getHistorySessions()} locale="zh" />; }
