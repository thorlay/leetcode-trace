import { ProblemView } from "@/components/problem-view";
import { getProblems } from "@/lib/sessions";

export const dynamic = "force-dynamic";
export default async function ProblemsPage() { return <ProblemView problems={await getProblems()} locale="en" />; }
