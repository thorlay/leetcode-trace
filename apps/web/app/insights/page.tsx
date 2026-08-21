import type { Metadata } from "next";
import { LearningInsights } from "@/components/learning-insights";
import { getLearningProfile } from "@/lib/global-learning";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Learning plan | Reviewly" };
export default async function InsightsPage() { return <LearningInsights profile={await getLearningProfile()} locale="en" />; }
