import { HistoryView } from "@/components/history-view";
import { getHistorySessions } from "@/lib/sessions";

export const dynamic = "force-dynamic";
export default async function HistoryPage() { return <HistoryView sessions={await getHistorySessions()} locale="en" />; }
