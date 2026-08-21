import Link from "next/link";
import { getSessionOutcome } from "@/lib/session-outcome";
import type { SessionView } from "@/lib/types";
import type { WeaknessCategorySummary, WeaknessView } from "@/lib/weaknesses";

const copy = {
  en: {
    date: "THURSDAY, AUGUST 20", greeting: "Good morning, Shuo.", lede: "Your next breakthrough is hidden in the way you got stuck.", week: ["M", "T", "W", "T", "F", "S", "S"],
    reviewEyebrow: "TODAY'S REVIEW", reviewTitle: "6 focused questions", reviewBody: "Built from patterns across your recent attempts · about 12 minutes", start: "Start review",
    learning: "LEARNING SIGNALS", weakest: "Weakest concepts", profile: "View profile", noWeaknesses: "Analyze a completed session to reveal your learning signals.",
    month: "THIS MONTH", recurring: "Recurring mistakes", noCategories: "No categorized blockers yet.",
    context: "WORK IN CONTEXT", recent: "Recent sessions", all: "View all", problem: "Subarray Sum Equals K", tags: "Array · Prefix Sum · Hash Table", attempts: "Attempts", time: "Time", solved: "Solved",
  },
  zh: {
    date: "8 月 20 日 · 星期四", greeting: "早上好，Shuo。", lede: "下一次突破，往往藏在你卡住的地方。", week: ["一", "二", "三", "四", "五", "六", "日"],
    reviewEyebrow: "今日复习", reviewTitle: "6 道针对性练习", reviewBody: "根据近期解题中的重复模式生成 · 预计 12 分钟", start: "开始复习",
    learning: "学习信号", weakest: "最薄弱的知识点", profile: "查看能力档案", noWeaknesses: "分析一次已完成的解题记录后，这里会显示你的学习信号。",
    month: "本月", recurring: "重复出现的错误", noCategories: "尚无已分类的卡点。",
    context: "结合解题过程", recent: "最近的解题记录", all: "查看全部", problem: "和为 K 的子数组", tags: "数组 · 前缀和 · 哈希表", attempts: "尝试", time: "用时", solved: "已通过",
  },
};

const categoryLabel = (category: string, zh: boolean) => ({ PATTERN_RECOGNITION: zh ? "模式识别" : "Pattern recognition", IMPLEMENTATION: zh ? "代码实现" : "Implementation", INVARIANT_REASONING: zh ? "不变量推理" : "Invariant reasoning", COMPLEXITY_OPTIMIZATION: zh ? "复杂度优化" : "Complexity", EDGE_CASES: zh ? "边界情况" : "Edge cases", ALGORITHM_SELECTION: zh ? "算法选择" : "Algorithm selection", PROBLEM_MODELING: zh ? "问题建模" : "Problem modeling", STATE_DESIGN: zh ? "状态设计" : "State design", DEBUGGING: zh ? "调试" : "Debugging", LANGUAGE_KNOWLEDGE: zh ? "语言知识" : "Language knowledge" }[category] ?? category);

export function Dashboard({ sessions, locale, reviewCount, weaknesses, categories }: { sessions: SessionView[]; locale: "en" | "zh"; reviewCount: number; weaknesses: WeaknessView[]; categories: WeaknessCategorySummary[] }) {
  const t = copy[locale];
  const chinese = locale === "zh";
  if (sessions.length === 0) return <main className="shell dashboard"><section className="welcome-card"><div className="welcome-icon">R</div><p className="eyebrow">{chinese ? "欢迎使用 REVIEWLY" : "WELCOME TO REVIEWLY"}</p><h1>{chinese ? "已经做过 LeetCode 题目？" : "Already solved LeetCode problems?"}</h1><p>{chinese ? "导入历史提交作为起点，不需要连接 AI，也不会上传你的 LeetCode 登录信息。" : "Import your past submissions as a starting point. No AI connection is required, and LeetCode credentials are never uploaded."}</p><Link className="primary-button" href={chinese ? "/zh/history" : "/history"}>{chinese ? "导入 LeetCode 历史" : "Import LeetCode history"} <span>→</span></Link></section></main>;
  return (
    <main className="shell dashboard">
      <section className="hero-row">
        <div><p className="eyebrow">{t.date}</p><h1>{t.greeting}</h1><p className="lede">{t.lede}</p></div>
        <div className="week-dots" aria-label={chinese ? "本周学习记录" : "Weekly activity"}>{t.week.map((day, index) => <span key={`${day}-${index}`} className={index === 3 ? "today" : ""}>{day}</span>)}</div>
      </section>
      <section className="review-callout">
        <div className="review-icon">↗</div><div className="review-copy"><p className="eyebrow warm">{t.reviewEyebrow}</p><h2>{chinese ? `${reviewCount} 道针对性练习` : `${reviewCount} focused question${reviewCount === 1 ? "" : "s"}`}</h2><p>{chinese ? `根据近期解题中的重复模式生成 · 预计 ${Math.max(2, reviewCount * 2)} 分钟` : `Built from patterns across your recent attempts · about ${Math.max(2, reviewCount * 2)} minutes`}</p></div>
        <Link className="primary-button" href={chinese ? "/zh/reviews" : "/reviews"}>{t.start} <span>→</span></Link>
      </section>
      <div className="dashboard-grid">
        <section>
          <div className="section-heading"><div><p className="eyebrow">{t.learning}</p><h2>{t.weakest}</h2></div><span className="text-link">{t.profile} →</span></div>
          <div className="concept-list">{weaknesses.length ? weaknesses.slice(0, 3).map((weakness) => { const score = Math.round(weakness.masteryScore * 100); return <Link className="concept-row" href={chinese ? "/zh/weaknesses" : "/weaknesses"} key={weakness.id}><div className="score-ring">{score}<small>%</small></div><div className="concept-copy"><strong>{weakness.conceptLabel}</strong><span>{categoryLabel(weakness.category, chinese)}</span><div className="meter"><i style={{ width: `${score}%` }} /></div></div></Link>; }) : <p className="dashboard-empty">{t.noWeaknesses}</p>}</div>
        </section>
        <section>
          <div className="section-heading"><div><p className="eyebrow">{t.month}</p><h2>{t.recurring}</h2></div></div>
          <div className="mistake-card">{categories.length ? categories.slice(0, 5).map((item) => <div className="bar-row" key={item.category}><span>{categoryLabel(item.category, chinese)}</span><div><i style={{ width: `${item.percentage}%` }} /></div><b>{item.count}</b></div>) : <p className="dashboard-empty">{t.noCategories}</p>}</div>
        </section>
      </div>
      <section className="recent-section">
        <div className="section-heading"><div><p className="eyebrow">{t.context}</p><h2>{t.recent}</h2></div><Link className="text-link" href={chinese ? "/zh/history" : "/history"}>{t.all} →</Link></div>
        <div className="session-table">{sessions.map((session) => {
          const seeded = session.problem.slug === "subarray-sum-equals-k";
          const minutes = session.endedAt ? Math.max(1, Math.round((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 60_000)) : "—";
          return <Link href={`${chinese ? "/zh" : ""}/sessions/${session.id}`} className="session-row" key={session.id}>
          <div className="problem-number">{seeded ? "560" : "LC"}</div><div className="session-title"><strong>{chinese && seeded ? t.problem : session.problem.title}</strong><span>{seeded ? t.tags : `LeetCode · ${session.attempts[0]?.language ?? "Code"}`}</span></div>
          <div className="session-metric"><span>{t.attempts}</span><b>{session.attempts.length}</b></div><div className="session-metric"><span>{t.time}</span><b>{minutes}{typeof minutes === "number" ? (chinese ? " 分" : "m") : ""}</b></div>
          {(() => { const outcome = getSessionOutcome(session.status, session.attempts).outcome; return <div className={`solved-pill ${outcome === "IN_PROGRESS" ? "active-pill" : outcome === "NO_AC" ? "no-ac-pill" : ""}`}>{outcome === "ACCEPTED" ? `✓ ${t.solved}` : outcome === "NO_AC" ? (chinese ? "未 AC" : "No AC") : (chinese ? "进行中" : "Active")}</div>; })()}<span className="row-arrow">›</span>
        </Link>;})}</div>
      </section>
    </main>
  );
}
