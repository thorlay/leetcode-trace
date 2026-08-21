"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { diffLines } from "diff";
import type { AnalysisView, AttemptView } from "@/lib/types";

function titleCase(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const zhCategories: Record<string, string> = {
  PROBLEM_MODELING: "问题建模", PATTERN_RECOGNITION: "模式识别", ALGORITHM_SELECTION: "算法选择", INVARIANT_REASONING: "不变量推理", STATE_DESIGN: "状态设计",
  COMPLEXITY_OPTIMIZATION: "复杂度优化", IMPLEMENTATION: "代码实现", EDGE_CASES: "边界情况", DEBUGGING: "调试", LANGUAGE_KNOWLEDGE: "语言知识",
};

const zhVerdicts: Record<string, string> = {
  ACCEPTED: "通过", WRONG_ANSWER: "答案错误", TIME_LIMIT_EXCEEDED: "超出时间限制", MEMORY_LIMIT_EXCEEDED: "超出内存限制", RUNTIME_ERROR: "运行错误", COMPILE_ERROR: "编译错误", UNKNOWN: "未知", RUN: "运行", SUBMIT: "提交", MANUAL: "手动保存",
};

function verdictLabel(attempt: AttemptView, locale: "en" | "zh") {
  if (attempt.selfAssessment) {
    const labels = locale === "zh" ? { NO_INITIAL_IDEA: "完全没思路", ALGORITHM_SELECTION: "算法选择卡住", IMPLEMENTATION_STUCK: "实现卡住", SOLUTION_CONSULTED: "参考了答案 / 题解" } : { NO_INITIAL_IDEA: "No initial idea", ALGORITHM_SELECTION: "Algorithm selection", IMPLEMENTATION_STUCK: "Implementation stuck", SOLUTION_CONSULTED: "Used solution / explanation" };
    return labels[attempt.selfAssessment];
  }
  const value = attempt.verdict ?? attempt.action;
  return locale === "zh" ? (zhVerdicts[value] ?? value) : titleCase(value);
}

export function SessionExplorer({ sessionId, attempts, initialAnalysis, initialFeedback, locale = "en" }: { sessionId: string; attempts: AttemptView[]; initialAnalysis: AnalysisView | null; initialFeedback?: string | null; locale?: "en" | "zh" }) {
  const [selected, setSelected] = useState(attempts.length - 1);
  const [showDiff, setShowDiff] = useState(false);
  const [analysis, setAnalysis] = useState(initialAnalysis);
  const [analysisState, setAnalysisState] = useState<"idle" | "loading" | "error">("idle");
  const [showImport, setShowImport] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [importText, setImportText] = useState("");
  const [editText, setEditText] = useState("");
  const [feedback, setFeedback] = useState(initialFeedback ?? "");
  const [manualMessage, setManualMessage] = useState("");
  const router = useRouter();
  const attempt = attempts[selected];
  const previous = selected > 0 ? attempts[selected - 1] : null;
  const changes = useMemo(() => previous ? diffLines(previous.code, attempt.code) : [], [attempt, previous]);
  const zh = locale === "zh";
  const categoryLabel = (value: string) => zh ? (zhCategories[value] ?? value) : titleCase(value);

  async function analyze() {
    setAnalysisState("loading");
    try {
      const response = await fetch(`/api/sessions/${sessionId}/analyze`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale }) });
      if (!response.ok) throw new Error("analysis failed");
      const body = await response.json() as { analysis: AnalysisView };
      setAnalysis(body.analysis);
      setAnalysisState("idle");
    } catch {
      setAnalysisState("error");
    }
  }

  async function deleteSession() {
    if (!window.confirm(zh ? "确定删除本次解题记录及全部代码快照吗？" : "Delete this session and all of its code snapshots?")) return;
    const response = await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
    if (response.ok) router.push(zh ? "/zh" : "/"); else setAnalysisState("error");
  }

  async function exportForAI() {
    setManualMessage(zh ? "正在生成提示词…" : "Preparing prompt…");
    const response = await fetch(`/api/sessions/${sessionId}/analysis-export?locale=${locale}`);
    const body = await response.json() as { prompt?: string; error?: string };
    if (!response.ok || !body.prompt) { setManualMessage(body.error || (zh ? "导出失败" : "Export failed")); return; }
    try {
      await navigator.clipboard.writeText(body.prompt);
      setManualMessage(zh ? "已复制 AI 分析提示词，可以粘贴到任意 AI。" : "AI analysis prompt copied. Paste it into any AI chat.");
    } catch {
      setImportText(body.prompt);
      setShowImport(true);
      setManualMessage(zh ? "浏览器无法自动复制，请从文本框复制。" : "Clipboard access failed; copy the prompt from the text box.");
    }
  }

  async function importAIResponse() {
    setAnalysisState("loading"); setManualMessage("");
    const response = await fetch(`/api/sessions/${sessionId}/analysis-import`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ response: importText }) });
    const body = await response.json() as { analysis?: AnalysisView; error?: string };
    if (!response.ok || !body.analysis) { setAnalysisState("idle"); setManualMessage(body.error || (zh ? "导入失败" : "Import failed")); return; }
    setAnalysis(body.analysis); setAnalysisState("idle"); setShowImport(false); setImportText("");
    setManualMessage(zh ? "AI 分析已导入，薄弱项也已更新。" : "AI analysis imported and weaknesses updated.");
  }

  async function saveFeedback(kind: "CONFIRMED" | "DISPUTED" | "EDITED", edited?: AnalysisView) {
    const response = await fetch(`/api/sessions/${sessionId}/analysis`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ feedback: kind, ...(edited ? { analysis: edited } : {}) }) });
    const body = await response.json() as { analysis?: AnalysisView; feedback?: string; error?: string };
    if (!response.ok) { setManualMessage(body.error || (zh ? "保存失败" : "Could not save feedback")); return; }
    if (body.analysis) setAnalysis(body.analysis); setFeedback(body.feedback ?? kind); setShowEdit(false); setManualMessage(zh ? "你的修正已保存，并会用于薄弱项统计。" : "Your correction was saved and applied to weakness tracking.");
  }

  return (
    <>
      <section className="timeline-panel">
        <div className="timeline-line" />
        <div className="start-node"><span /><p>20:00</p><b>{zh ? "开始" : "Started"}</b></div>
        {attempts.map((item, index) => (
          <button key={item.id} className={`attempt-node ${selected === index ? "selected" : ""}`} onClick={() => { setSelected(index); setShowDiff(false); }}>
            <span className={item.verdict === "ACCEPTED" ? "accepted" : item.verdict === "TIME_LIMIT_EXCEEDED" ? "warning" : "failed"}>{index + 1}</span>
            <p>{new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
            <b>v{item.sequenceNumber}</b>
            <small>{verdictLabel(item, locale)}</small>
          </button>
        ))}
      </section>

      <section className="code-card">
        <div className="code-toolbar">
          <div><span className="file-dot" /><strong>{attempt.selfAssessment ? (zh ? "学习标记" : "Learning marker") : (zh ? "尝试" : "Attempt")} v{attempt.sequenceNumber}</strong><span className="lang-pill">{attempt.selfAssessment ? verdictLabel(attempt, locale) : attempt.language}</span></div>
          <div><button className="ghost-button" disabled={!previous} onClick={() => setShowDiff((value) => !value)}>{showDiff ? (zh ? "显示当前版本" : "Show snapshot") : (zh ? "与上一版对比" : "Compare with previous")}</button><span className={`verdict-badge ${attempt.verdict === "ACCEPTED" ? "success" : "danger"}`}>{verdictLabel(attempt, locale)}</span></div>
        </div>
        <pre className="code-view"><code>{attempt.selfAssessment ? <span>{attempt.selfAssessment === "SOLUTION_CONSULTED" ? (zh ? "此处标记：参考了答案或题解。之后的通过不应视为独立完成。" : "Marked here: a solution or explanation was consulted. Later acceptance should not be treated as independent solving.") : (zh ? "尚未开始写代码。" : "No code had been written yet.")}{attempt.note ? `\n\n${zh ? "备注：" : "Note: "}${attempt.note}` : ""}</span> : showDiff && previous ? changes.map((part, index) => <span key={index} className={part.added ? "line-added" : part.removed ? "line-removed" : ""}>{part.value}</span>) : attempt.code}</code></pre>
      </section>

      <section className="analysis-section">
        <div className="section-heading analysis-heading"><div><p className="eyebrow">{zh ? "解题轨迹分析" : "TRAJECTORY ANALYSIS"}</p><h2>{zh ? "解题过程中发生了什么变化" : "What changed while you solved it"}</h2><p className="provider-note">{zh ? "默认使用免费的手动 AI 模式，也可以选择 API 自动分析。" : "Manual AI is the free default; API analysis remains optional."}</p></div><div className="heading-actions"><button className="manual-primary" onClick={exportForAI}>{zh ? "复制 AI 提示词" : "Copy AI prompt"}</button><button className="ghost-button" onClick={() => { setShowImport(true); setManualMessage(""); }}>{zh ? "导入 AI 结果" : "Import AI result"}</button><button className="ghost-button" onClick={analyze} disabled={analysisState === "loading"}>{analysisState === "loading" ? (zh ? "分析中…" : "Analyzing…") : (zh ? "API 分析" : "Analyze via API")}</button><button className="danger-button" onClick={deleteSession}>{zh ? "删除" : "Delete"}</button></div></div>
        {manualMessage && <p className={manualMessage.includes("失败") || manualMessage.includes("failed") || manualMessage.includes("match") ? "error-banner" : "success-banner"}>{manualMessage}</p>}
        {analysisState === "error" && <p className="error-banner">{zh ? "暂时无法完成分析。解题记录已保存，请在 AI 服务恢复后重试。" : "Analysis could not be completed. Your session is still saved; try again when the AI service is available."}</p>}
        {analysis ? <div className="analysis-grid">
          <article className="primary-analysis">
            <div className="analysis-label"><span>{zh ? "主要卡点" : "Primary blocker"}</span><b>{Math.round(analysis.primaryBlocker.confidence * 100)}% {zh ? "置信度" : "confidence"}</b></div>
            <p className="category">{categoryLabel(analysis.primaryBlocker.category)}</p>
            <h3>{analysis.primaryBlocker.conceptLabel}</h3>
            <p className="analysis-summary">{analysis.summary}</p>
            <blockquote>{analysis.primaryBlocker.evidence}</blockquote>
            <div className="analysis-actions"><button onClick={() => void saveFeedback("CONFIRMED")}>✓ {zh ? "准确" : "Correct"}</button><button onClick={() => void saveFeedback("DISPUTED")}>× {zh ? "不准确" : "Incorrect"}</button><button onClick={() => { setEditText(JSON.stringify(analysis, null, 2)); setShowEdit(true); }}>{zh ? "编辑" : "Edit"}</button>{feedback && <small>{feedback === "CONFIRMED" ? (zh ? "已确认" : "Confirmed") : feedback === "DISPUTED" ? (zh ? "已标记不准确" : "Marked inaccurate") : (zh ? "已手动编辑" : "Manually edited")}</small>}</div>
            {analysis.solutionPatterns?.length ? <div className="solution-patterns"><p className="eyebrow">{zh ? "本题解法模式" : "SOLUTION PATTERNS"}</p>{analysis.solutionPatterns.map((pattern) => <div key={pattern.patternKey}><b>{pattern.patternLabel}</b><span>{Math.round(pattern.confidence * 100)}%</span><small>{pattern.evidence}</small></div>)}</div> : null}
          </article>
          <aside className="secondary-analysis">
            <p className="eyebrow">{zh ? "次要问题" : "SECONDARY ISSUE"}</p>
            {analysis.secondaryBlockers.map((blocker) => <div key={blocker.conceptKey}><p className="category">{categoryLabel(blocker.category)}</p><h3>{blocker.conceptLabel}</h3><p>{blocker.evidence}</p></div>)}
            <div className="strength"><span>↗</span><div><b>{zh ? "发现的优势" : "Strength spotted"}</b><p>{analysis.strengths[0]}</p></div></div>
          </aside>
        </div> : <div className="empty-analysis">{zh ? "尚未分析。分析完整解题轨迹，找出最主要的卡点。" : "No analysis yet. Analyze the full attempt trajectory to identify the main blocker."}</div>}
      </section>
      {showImport && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowImport(false); }}><section className="import-modal" role="dialog" aria-modal="true" aria-labelledby="import-title"><div className="modal-heading"><div><p className="eyebrow">MANUAL AI</p><h2 id="import-title">{zh ? "导入结构化分析" : "Import structured analysis"}</h2></div><button aria-label={zh ? "关闭" : "Close"} onClick={() => setShowImport(false)}>×</button></div><p>{zh ? "把 ChatGPT、Claude、Gemini 或其他模型返回的 JSON 粘贴到这里。Markdown 的 ```json 代码块也可以识别。" : "Paste JSON returned by ChatGPT, Claude, Gemini, or another model. A fenced ```json block is accepted too."}</p><textarea autoFocus value={importText} onChange={(event) => setImportText(event.target.value)} placeholder='{ "summary": "...", "primaryBlocker": { ... } }' />{manualMessage && <p className="modal-error">{manualMessage}</p>}<div className="modal-actions"><button className="ghost-button" onClick={() => setShowImport(false)}>{zh ? "取消" : "Cancel"}</button><button className="manual-primary" disabled={!importText.trim() || analysisState === "loading"} onClick={importAIResponse}>{analysisState === "loading" ? (zh ? "校验并导入中…" : "Validating…") : (zh ? "校验并导入" : "Validate and import")}</button></div></section></div>}
      {showEdit && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowEdit(false); }}><section className="import-modal" role="dialog" aria-modal="true" aria-labelledby="edit-title"><div className="modal-heading"><div><p className="eyebrow">{zh ? "人工修正" : "HUMAN CORRECTION"}</p><h2 id="edit-title">{zh ? "编辑 AI 分类" : "Edit AI classification"}</h2></div><button aria-label={zh ? "关闭" : "Close"} onClick={() => setShowEdit(false)}>×</button></div><p>{zh ? "修改后会校验 JSON，并重新计算相关薄弱项。" : "The JSON is validated before saving and related weaknesses are recalculated."}</p><textarea autoFocus value={editText} onChange={(event) => setEditText(event.target.value)} />{manualMessage && <p className="modal-error">{manualMessage}</p>}<div className="modal-actions"><button className="ghost-button" onClick={() => setShowEdit(false)}>{zh ? "取消" : "Cancel"}</button><button className="manual-primary" onClick={() => { try { void saveFeedback("EDITED", JSON.parse(editText) as AnalysisView); } catch { setManualMessage(zh ? "请输入有效 JSON。" : "Enter valid JSON."); } }}>{zh ? "保存修正" : "Save correction"}</button></div></section></div>}
    </>
  );
}
