import type { Metadata } from "next";
import { ProblemView } from "@/components/problem-view";
import { getProblems } from "@/lib/sessions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "题目库 | Reviewly", description: "按题目查看 LeetCode 解题与提交记录。" };
export default async function ChineseProblemsPage() { return <ProblemView problems={await getProblems()} locale="zh" />; }
