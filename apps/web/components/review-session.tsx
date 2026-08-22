"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Task = { id: string; type: string; question: string; difficulty: number; weakness: { id: string; conceptKey: string; conceptLabel: string; masteryScore: number } };
type Result = { score: number; rating: "AGAIN" | "HARD" | "GOOD" | "EASY"; feedback: string; missingConcepts: string[]; masteryScore: number; intervalDays: number };

export function ReviewSession({ initialTasks, locale }: { initialTasks: Task[]; locale: "en" | "zh" }) {
  const zh = locale === "zh";
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const task = tasks[index];

  async function generate() {
    setBusy(true); setError("");
    const response = await fetch("/api/reviews/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale }) });
    const body = await response.json();
    if (!response.ok) setError(body.error || (zh ? "生成失败" : "Generation failed"));
    else { setTasks(body.tasks); setIndex(0); router.refresh(); }
    setBusy(false);
  }

  async function submit() {
    if (!task || !answer.trim()) return;
    setBusy(true); setError("");
    const response = await fetch(`/api/reviews/${task.id}/answer`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answer, locale }) });
    const body = await response.json();
    if (!response.ok) setError(body.error || (zh ? "评分失败" : "Evaluation failed")); else setResult(body);
    setBusy(false);
  }

  function next() { setAnswer(""); setResult(null); setIndex((value) => value + 1); }

  if (!task) return <section className="review-empty"><div>✓</div><h1>{zh ? "今天的复习已完成" : "You're caught up"}</h1><p>{zh ? "生成一组核心算法复习题：优先复习重复弱点；暂未重复时，用具体信号做一次验证复习。" : "Generate core-algorithm reviews: recurring weaknesses first, then specific one-off signals as validation."}</p><button className="primary-button" onClick={generate} disabled={busy}>{busy ? (zh ? "生成中…" : "Generating…") : (zh ? "生成复习题" : "Generate review")}</button>{error && <p className="error-banner">{error}</p>}</section>;

  const question = zh && task.weakness.conceptKey === "prefix_sum.hashmap" ? "一个数组包含正数和负数。你需要统计和为 K 的连续子数组，但暂时不写代码：你会先尝试什么方法？为什么？" : task.question;
  return <main className="review-page shell">
    <header className="review-progress"><div><p className="eyebrow">{zh ? "今日复习" : "TODAY'S REVIEW"}</p><h1>{zh ? `第 ${index + 1} 题，共 ${tasks.length} 题` : `Question ${index + 1} of ${tasks.length}`}</h1></div><div className="progress-track"><i style={{ width: `${((index + (result ? 1 : 0)) / tasks.length) * 100}%` }} /></div></header>
    <section className="review-question-card">
      <div className="question-meta"><span>{task.type.replaceAll("_", " ")}</span><b>{zh ? "难度" : "Difficulty"} {task.difficulty}/5</b></div><h2>{question}</h2>
      {!result ? <><label htmlFor="review-answer">{zh ? "你的回答" : "Your answer"}</label><textarea id="review-answer" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder={zh ? "解释你的思路，不需要写完整代码…" : "Explain your reasoning; full code is not required…"} /><button className="primary-button" onClick={submit} disabled={busy || !answer.trim()}>{busy ? (zh ? "评分中…" : "Evaluating…") : (zh ? "提交回答" : "Submit answer")}</button></> : <div className="review-feedback"><div className={`rating rating-${result.rating.toLowerCase()}`}>{result.rating}</div><h3>{zh ? "反馈" : "Feedback"}</h3><p>{result.feedback}</p><div className="feedback-stats"><span>{zh ? "得分" : "Score"} <b>{Math.round(result.score * 100)}%</b></span><span>{zh ? "新掌握度" : "New mastery"} <b>{Math.round(result.masteryScore * 100)}%</b></span><span>{zh ? "下次间隔" : "Next interval"} <b>{result.intervalDays} {zh ? "天" : "days"}</b></span></div><button className="primary-button" onClick={next}>{index + 1 < tasks.length ? (zh ? "下一题" : "Next question") : (zh ? "完成复习" : "Finish review")}</button></div>}
      {error && <p className="error-banner">{error}</p>}
    </section>
  </main>;
}
