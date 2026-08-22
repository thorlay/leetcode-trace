import Link from "next/link";
import type { WeaknessCategorySummary, WeaknessView } from "@/lib/weaknesses";

const categoryLabels: Record<string, [string, string]> = {
  PROBLEM_MODELING: ["Problem modeling", "问题建模"],
  PATTERN_RECOGNITION: ["Pattern recognition", "模式识别"],
  ALGORITHM_SELECTION: ["Algorithm selection", "算法选择"],
  INVARIANT_REASONING: ["Invariant reasoning", "不变量推理"],
  STATE_DESIGN: ["State design", "状态设计"],
  COMPLEXITY_OPTIMIZATION: ["Complexity", "复杂度优化"],
  IMPLEMENTATION: ["Implementation", "代码实现"],
  EDGE_CASES: ["Edge cases", "边界情况"],
  DEBUGGING: ["Debugging", "调试"],
  LANGUAGE_KNOWLEDGE: ["Language knowledge", "语言知识"],
};

export function WeaknessDashboard({
  weaknesses,
  candidates,
  categories,
  locale,
}: {
  weaknesses: WeaknessView[];
  candidates: WeaknessView[];
  categories: WeaknessCategorySummary[];
  locale: "en" | "zh";
}) {
  const zh = locale === "zh";
  const localizedConcept = (key: string, fallback: string) =>
    key === "prefix_sum.hashmap" && zh ? "前缀和 + 频次表转换" : fallback;
  const showingCandidates = weaknesses.length === 0 && candidates.length > 0;
  const displayedWeaknesses = weaknesses.length ? weaknesses : candidates;
  return (
    <main className="shell profile-page">
      <header className="profile-hero">
        <p className="eyebrow">
          {zh ? "核心算法画像" : "CORE ALGORITHM PROFILE"}
        </p>
        <h1>{zh ? "把注意力放在解题思路上" : "Focus on solving approaches"}</h1>
        <p>
          {zh
            ? "这里优先展示建模、模式识别、算法选择、状态、不变量与复杂度；实现和语法细节不会干扰主视图。"
            : "This view prioritizes modeling, patterns, algorithm choice, state, invariants, and complexity; implementation details stay out of the way."}
        </p>
      </header>
      <section className="profile-summary">
        {categories.length ? (
          categories.map((item) => (
            <div key={item.category}>
              <span>
                {categoryLabels[item.category]?.[zh ? 1 : 0] ?? item.category}
              </span>
              <div className="profile-bar">
                <i style={{ width: `${item.percentage}%` }} />
              </div>
              <b>{item.percentage}%</b>
            </div>
          ))
        ) : (
          <p className="dashboard-empty">
            {zh
              ? "目前还没有重复出现的核心算法薄弱点。"
              : "No recurring core-algorithm weakness has appeared yet."}
          </p>
        )}
      </section>
      <section className="weakness-list-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{showingCandidates ? (zh ? "待验证信号" : "SIGNALS TO VERIFY") : (zh ? "核心模式" : "CORE PATTERNS")}</p>
            <h2>
              {showingCandidates ? (zh ? "这些信号各出现一次，暂不判定为薄弱项" : "Seen once each — not yet called weaknesses") : (zh ? "优先巩固的算法能力" : "Algorithm skills to reinforce")}
            </h2>
          </div>
        </div>
        <div className="weakness-grid">
          {displayedWeaknesses.length ? (
            displayedWeaknesses.map((weakness) => (
              <article className="weakness-card" key={weakness.id}>
                <div className="weakness-top">
                  <span>
                    {categoryLabels[weakness.category]?.[zh ? 1 : 0] ??
                      weakness.category}
                  </span>
                  {weakness.recurring ? <b>{zh ? "重复出现" : "Recurring"}</b> : showingCandidates ? <b>{zh ? "待验证" : "To verify"}</b> : null}
                </div>
                <h3>
                  {localizedConcept(weakness.conceptKey, weakness.conceptLabel)}
                </h3>
                <code>{weakness.conceptKey}</code>
                <div className="mastery-row">
                  <div>
                    <span>{zh ? "掌握度" : "Mastery"}</span>
                    <strong>{Math.round(weakness.masteryScore * 100)}%</strong>
                  </div>
                  <div className="mastery-meter">
                    <i style={{ width: `${weakness.masteryScore * 100}%` }} />
                  </div>
                </div>
                <p>
                  {zh
                    ? `已在 ${weakness.observationCount} 次解题中观察到`
                    : `Observed across ${weakness.observationCount} problem sessions`}
                </p>
                <div className="weakness-sessions">
                  {weakness.sessions.map((session) => (
                    <Link
                      key={session.id}
                      href={`${zh ? "/zh" : ""}/sessions/${session.id}`}
                    >
                      {session.title}
                    </Link>
                  ))}
                </div>
                <Link
                  className="practice-link"
                  href={`${zh ? "/zh" : ""}/reviews?weakness=${weakness.id}`}
                >
                  {zh ? "开始针对性练习" : "Practice this concept"} →
                </Link>
              </article>
            ))
          ) : (
            <p className="dashboard-empty">
              {zh
                    ? "还没有足够的核心算法信号。"
                    : "No core algorithm signals yet."}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
