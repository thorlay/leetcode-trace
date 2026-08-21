import type { Metadata } from "next";
import { LearningInsights } from "@/components/learning-insights";
import { getLearningProfile } from "@/lib/global-learning";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "学习计划 | Reviewly" };
export default async function ChineseInsightsPage() { return <LearningInsights profile={await getLearningProfile()} locale="zh" />; }
