import type { Metadata } from "next";
import { DataManager } from "@/components/data-manager";
export const metadata: Metadata = { title: "数据导出与恢复 | Reviewly" };
export default function ChineseDataPage() { return <DataManager locale="zh" />; }
