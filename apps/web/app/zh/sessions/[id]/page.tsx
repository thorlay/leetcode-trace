import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SessionExplorer } from "@/components/session-explorer";
import { localizeAnalysisToChinese } from "@/lib/localize-analysis";
import { getSession } from "@/lib/sessions";
import { getSessionOutcome } from "@/lib/session-outcome";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const session = await getSession((await params).id);
  return {
    title: session ? `${session.problem.slug === "subarray-sum-equals-k" ? "和为 K 的子数组" : session.problem.title} — 解题记录 | Reviewly` : "解题记录 | Reviewly",
    description: session ? `查看 ${session.attempts.length} 次尝试的代码变化与 AI 解题轨迹分析。` : "Reviewly 解题记录",
  };
}

export default async function ChineseSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) notFound();
  const minutes = session.endedAt ? Math.round((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 60_000) : null;
  const title = session.problem.slug === "subarray-sum-equals-k" ? "和为 K 的子数组" : session.problem.title;
  const { outcome, unsuccessfulSubmissionCount } = getSessionOutcome(session.status, session.attempts);

  return (
    <main className="shell session-page">
      <Link href="/zh" className="back-link">← 返回概览</Link>
      <header className="session-header">
        <div><p className="eyebrow">解题记录 · {session.problem.slug}</p><h1>{title}</h1><div className="tag-row"><span>LeetCode</span><span>{session.attempts[0]?.language ?? "代码"}</span><span>{session.captureCompleteness === "FULL" ? "完整实时记录" : session.captureCompleteness === "FINAL_ONLY" ? "仅最终提交" : "仅提交快照"}</span><span>{session.trajectoryStatus === "ANALYZED" ? "轨迹已分析" : session.trajectoryStatus === "AVAILABLE" ? "轨迹可分析" : "轨迹证据有限"}</span>{session.problem.slug === "subarray-sum-equals-k" && <span>前缀和</span>}</div></div>
        <div className="session-stats"><div><span>状态</span><b className={outcome === "ACCEPTED" ? "status-solved" : outcome === "NO_AC" ? "status-no-ac" : ""}>{outcome === "ACCEPTED" ? "● 已 AC" : outcome === "NO_AC" ? "● 未 AC" : "● 进行中"}</b></div><div><span>解题用时</span><b>{minutes === null ? "—" : `${minutes} 分钟`}</b></div><div><span>{unsuccessfulSubmissionCount ? "未通过提交" : "尝试次数"}</span><b>{unsuccessfulSubmissionCount || session.attempts.length}</b></div></div>
      </header>
      <section className="timeline-heading"><div><p className="eyebrow">尝试时间线</p><h2>{outcome === "ACCEPTED" ? "从第一个思路到最终通过" : "从第一个思路到本次结果"}</h2></div><p>选择任意版本查看当时的代码。</p></section>
      <SessionExplorer sessionId={session.id} attempts={session.attempts} initialAnalysis={localizeAnalysisToChinese(session.analysis)} initialFeedback={session.analysisFeedback} initialAssessment={session.initialAssessment} solutionConsulted={session.solutionConsulted} locale="zh" />
    </main>
  );
}
