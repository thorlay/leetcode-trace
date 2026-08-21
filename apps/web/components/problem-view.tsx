import Link from "next/link";
import type { ProblemView } from "@/lib/types";
import { MetadataSyncCommand } from "./metadata-sync-command";

const copy = {
  en: { eyebrow: "PROBLEM LIBRARY", title: "Problems", lede: "One row per problem. Open the latest solving session to inspect its complete submission history.", sessions: "Sessions", submissions: "Submissions", lastActivity: "Last activity", status: "Latest result", history: "View all sessions", empty: "No problems yet. Import your LeetCode history to build your library." },
  zh: { eyebrow: "题目库", title: "题目", lede: "每题只显示一行；进入最近场次可查看该题完整的提交历史。", sessions: "场次", submissions: "提交", lastActivity: "最近记录", status: "最近结果", history: "查看全部场次", empty: "还没有题目。导入 LeetCode 历史后会在这里建立题库。" },
} as const;

function date(value: string, locale: "en" | "zh") { return new Date(value).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", { year: "numeric", month: "short", day: "numeric" }); }

export function ProblemView({ problems, locale }: { problems: ProblemView[]; locale: "en" | "zh" }) {
  const t = copy[locale]; const base = locale === "zh" ? "/zh" : "";
  return <main className="shell problem-page"><header className="history-hero"><div><p className="eyebrow">{t.eyebrow}</p><h1>{t.title}</h1><p className="lede">{t.lede}</p></div><Link className="ghost-button data-link" href={`${base}/history`}>{t.history} →</Link></header><MetadataSyncCommand locale={locale} />
    {problems.length === 0 ? <div className="history-empty">{t.empty}</div> : <section className="problem-table"><div className="problem-table-head"><span>{locale === "zh" ? "题目" : "Problem"}</span><span>{t.sessions}</span><span>{t.submissions}</span><span>{t.lastActivity}</span><span>{t.status}</span></div>
      {problems.map((problem) => <Link className="problem-row" key={problem.slug} href={problem.latestSessionId ? `${base}/sessions/${problem.latestSessionId}` : `${base}/history`}><div><strong>{problem.frontendId ? `${problem.frontendId}. ` : ""}{problem.title}</strong><small>{problem.difficulty && <em>{problem.difficulty}</em>}{problem.tags.slice(0, 4).map((tag) => <i key={tag.slug}>{tag.label}</i>)}{problem.patterns.slice(0, 2).map((pattern) => <u key={pattern.patternKey}>{pattern.label}</u>)}{!problem.tags.length && !problem.patterns.length && problem.slug}</small></div><span>{problem.sessionCount}</span><span>{problem.submissionCount}</span><time>{date(problem.lastActivityAt, locale)}</time><b className={problem.latestSessionStatus === "SOLVED" ? "problem-solved" : "problem-open"}>{problem.latestSessionStatus === "SOLVED" ? (locale === "zh" ? "已通过" : "Solved") : (locale === "zh" ? "未通过" : "Unsolved")}</b></Link>)}</section>}
  </main>;
}
