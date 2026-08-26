import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SessionExplorer } from "@/components/session-explorer";
import { getSession } from "@/lib/sessions";
import { getSessionOutcome } from "@/lib/session-outcome";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const session = await getSession((await params).id);
  return {
    title: session ? `${session.problem.title} — Session | Reviewly` : "Session | Reviewly",
    description: session ? `Inspect ${session.attempts.length} attempts, code changes, and AI trajectory analysis for ${session.problem.title}.` : "Reviewly problem session",
  };
}

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) notFound();
  const minutes = session.endedAt ? Math.round((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 60_000) : null;
  const { outcome, unsuccessfulSubmissionCount } = getSessionOutcome(session.status, session.attempts);

  return (
    <main className="shell session-page">
      <Link href="/" className="back-link">← Back to overview</Link>
      <header className="session-header">
        <div><p className="eyebrow">SESSION · {session.problem.slug}</p><h1>{session.problem.title}</h1><div className="tag-row"><span>LeetCode</span><span>{session.attempts[0]?.language ?? "Code"}</span><span>{session.captureCompleteness === "FULL" ? "Full live capture" : session.captureCompleteness === "PARTIAL_LIVE" ? "Partial live capture" : session.captureCompleteness === "FINAL_ONLY" ? "Final submission only" : "Submission snapshots"}</span><span>{session.trajectoryStatus === "ANALYZED" ? "Trajectory analyzed" : session.trajectoryStatus === "AVAILABLE" ? "Trajectory available" : "Limited trajectory"}</span>{session.problem.slug === "subarray-sum-equals-k" && <span>Prefix Sum</span>}</div></div>
        <div className="session-stats"><div><span>Status</span><b className={outcome === "ACCEPTED" ? "status-solved" : outcome === "NO_AC" ? "status-no-ac" : ""}>{outcome === "ACCEPTED" ? "● Solved" : outcome === "NO_AC" ? "● No AC" : "● Active"}</b></div><div><span>{outcome === "ACCEPTED" ? "Solved in" : "Elapsed"}</span><b>{minutes === null ? "—" : `${minutes} min`}</b></div><div><span>{unsuccessfulSubmissionCount ? "Unsuccessful submissions" : "Attempts"}</span><b>{unsuccessfulSubmissionCount || session.attempts.length}</b></div></div>
      </header>
      <section className="timeline-heading"><div><p className="eyebrow">ATTEMPT TIMELINE</p><h2>{outcome === "ACCEPTED" ? "From first idea to accepted" : "From first idea to outcome"}</h2></div><p>Select any version to inspect the code.</p></section>
      <SessionExplorer sessionId={session.id} attempts={session.attempts} initialAnalysis={session.analysis} initialFeedback={session.analysisFeedback} initialAssessment={session.initialAssessment} solutionConsulted={session.solutionConsulted} />
    </main>
  );
}
