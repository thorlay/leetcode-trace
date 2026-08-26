import Link from "next/link";
import type { SessionView } from "@/lib/types";
import { LeetCodeDumpImport } from "./leetcode-dump-import";
import { getSessionOutcome } from "@/lib/session-outcome";

const label = {
  en: {
    eyebrow: "LEETCODE LIBRARY", title: "Your solving history", lede: "Import past submissions once, then review or analyze any reconstructed session on demand.",
    problems: "Problems", submissions: "Submissions", sessions: "Sessions", analyzable: "Analyzable",
    importTitle: "Import from LeetCode", importBody: "Open LeetCode while signed in, then click “Import LeetCode history” in the Reviewly extension. Reviewly receives only normalized submission data—never your password, cookies, or authorization headers.",
    step1: "Reload the extension after installing this update.", step2: "Open any leetcode.com page while signed in.", step3: "Open Reviewly Capture and select Import LeetCode history.",
    data: "Export or restore data", date: "Date", attempts: "Records / submits", outcome: "Outcome", completeness: "Capture", trajectory: "Trajectory", empty: "No sessions yet. Import your LeetCode history or capture a Run/Submit to get started.",
  },
  zh: {
    eyebrow: "LEETCODE 题库", title: "你的解题记录", lede: "一次导入历史提交，系统自动还原解题场次；需要时再选择 AI 分析。",
    problems: "题目", submissions: "提交", sessions: "场次", analyzable: "可分析",
    importTitle: "从 LeetCode 导入", importBody: "登录 LeetCode 后，在 Reviewly 浏览器扩展中点击“导入 LeetCode 历史”。Reviewly 只接收整理后的提交数据，绝不会保存密码、Cookie 或鉴权请求头。",
    step1: "安装本次更新后，先重新加载扩展。", step2: "保持登录并打开任意 leetcode.com 页面。", step3: "打开 Reviewly Capture，点击导入 LeetCode 历史。",
    data: "导出或恢复数据", date: "日期", attempts: "记录 / 提交", outcome: "结果", completeness: "记录完整度", trajectory: "轨迹状态", empty: "暂无解题记录。可以先导入 LeetCode 历史，或记录一次 Run / Submit。",
  },
} as const;

function completenessText(value: SessionView["captureCompleteness"], zh: boolean) {
  const labels = zh ? { FINAL_ONLY: "仅最终提交", SUBMISSIONS_ONLY: "仅提交快照", PARTIAL_LIVE: "部分实时记录", FULL: "完整实时记录" } : { FINAL_ONLY: "Final only", SUBMISSIONS_ONLY: "Submissions only", PARTIAL_LIVE: "Partial live capture", FULL: "Full live capture" };
  return labels[value];
}

function trajectoryText(value: SessionView["trajectoryStatus"], zh: boolean) {
  const labels = zh ? { NONE: "证据不足", AVAILABLE: "可分析", ANALYZED: "已分析" } : { NONE: "Insufficient", AVAILABLE: "Available", ANALYZED: "Analyzed" };
  return labels[value];
}

function outcomeText(session: SessionView, zh: boolean) {
  const { outcome, unsuccessfulSubmissionCount } = getSessionOutcome(session.status, session.attempts);
  if (outcome === "ACCEPTED") return `${zh ? "✓ AC" : "✓ Accepted"}${unsuccessfulSubmissionCount ? ` · ${unsuccessfulSubmissionCount} ${zh ? "次未通过" : "unsuccessful"}` : ""}`;
  if (outcome === "NO_AC") return zh ? "× 未 AC" : "× No AC";
  return zh ? "· 进行中" : "· In progress";
}

function recordCountText(session: SessionView, zh: boolean) {
  const records = session.attempts.length;
  const submissions = session.attempts.filter((attempt) => attempt.action === "SUBMIT").length;
  if (records === submissions) return String(records);
  return zh ? `${records} 条 · ${submissions} 次提交` : `${records} records · ${submissions} submit${submissions === 1 ? "" : "s"}`;
}

export function HistoryView({ sessions, locale }: { sessions: SessionView[]; locale: "en" | "zh" }) {
  const copy = label[locale]; const zh = locale === "zh";
  const problemCount = new Set(sessions.map((session) => session.problem.slug)).size;
  const submissionCount = sessions.reduce((sum, session) => sum + session.attempts.filter((attempt) => attempt.action === "SUBMIT").length, 0);
  const analyzableCount = sessions.filter((session) => session.trajectoryStatus === "AVAILABLE" && !session.analysis).length;
  return <main className="shell history-page">
    <header className="history-hero"><div><p className="eyebrow">{copy.eyebrow}</p><h1>{copy.title}</h1><p className="lede">{copy.lede}</p></div><Link className="ghost-button data-link" href={zh ? "/zh/data" : "/data"}>{copy.data} →</Link></header>
    <section className="history-stats">
      <div><b>{problemCount}</b><span>{copy.problems}</span></div><div><b>{submissionCount}</b><span>{copy.submissions}</span></div><div><b>{sessions.length}</b><span>{copy.sessions}</span></div><div><b>{analyzableCount}</b><span>{copy.analyzable}</span></div>
    </section>
    <section className="import-guide"><div className="import-guide-icon">↧</div><div><p className="eyebrow">{zh ? "安全导入" : "SAFE IMPORT"}</p><h2>{copy.importTitle}</h2><p>{copy.importBody}</p><ol><li>{copy.step1}</li><li>{copy.step2}</li><li>{copy.step3}</li></ol></div></section>
    <LeetCodeDumpImport locale={locale} />
    <section className="history-list"><div className="section-heading"><div><p className="eyebrow">{zh ? "全部场次" : "ALL SESSIONS"}</p><h2>{zh ? "按时间排列" : "Ordered by time"}</h2></div></div>
      {sessions.length === 0 ? <div className="history-empty">{copy.empty}</div> : <div className="history-table">
        <div className="history-table-head"><span>{copy.date}</span><span>{zh ? "题目" : "Problem"}</span><span>{copy.attempts}</span><span>{copy.outcome}</span><span>{copy.completeness}</span><span>{copy.trajectory}</span></div>
        {sessions.map((session) => { const completeness = session.captureCompleteness ?? "FULL"; const trajectory = session.trajectoryStatus ?? (session.analysis ? "ANALYZED" : session.attempts.length >= 2 ? "AVAILABLE" : "NONE"); const outcome = getSessionOutcome(session.status, session.attempts).outcome; return <Link className="history-row" key={session.id} href={`${zh ? "/zh" : ""}/sessions/${session.id}`}>
          <time>{new Date(session.startedAt).toLocaleDateString(zh ? "zh-CN" : "en-US", { year: "numeric", month: "short", day: "numeric" })}</time>
          <div><strong>{session.problem.title}</strong><small>{session.problem.slug}</small></div>
          <span>{recordCountText(session, zh)}</span>
          <span className={`outcome-pill outcome-${outcome.toLowerCase()}`}>{outcomeText(session, zh)}</span>
          <span className={`capture-pill capture-${completeness.toLowerCase()}`}>{completenessText(completeness, zh)}</span>
          <span className={`trajectory-pill trajectory-${trajectory.toLowerCase()}`}>{trajectoryText(trajectory, zh)}</span>
        </Link>; })}
      </div>}
    </section>
  </main>;
}
