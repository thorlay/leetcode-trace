"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { diffLines } from "diff";
import type { AnalysisView, AttemptView } from "@/lib/types";
import { groupConsecutiveAttempts, type AttemptGroup } from "@/lib/attempts/group-consecutive";

function titleCase(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const zhCategories: Record<string, string> = {
  PROBLEM_MODELING: "问题建模",
  PATTERN_RECOGNITION: "模式识别",
  ALGORITHM_SELECTION: "算法选择",
  INVARIANT_REASONING: "不变量推理",
  STATE_DESIGN: "状态设计",
  COMPLEXITY_OPTIMIZATION: "复杂度优化",
  IMPLEMENTATION: "代码实现",
  EDGE_CASES: "边界情况",
  DEBUGGING: "调试",
  LANGUAGE_KNOWLEDGE: "语言知识",
};

const zhVerdicts: Record<string, string> = {
  ACCEPTED: "通过",
  WRONG_ANSWER: "答案错误",
  TIME_LIMIT_EXCEEDED: "超出时间限制",
  MEMORY_LIMIT_EXCEEDED: "超出内存限制",
  RUNTIME_ERROR: "运行错误",
  COMPILE_ERROR: "编译错误",
  UNKNOWN: "未知",
  RUN: "运行",
  SUBMIT: "提交",
  MANUAL: "手动保存",
};

function verdictLabel(attempt: AttemptView, locale: "en" | "zh") {
  if (attempt.selfAssessment) {
    const labels =
      locale === "zh"
        ? {
            NO_INITIAL_IDEA: "完全没思路",
            ALGORITHM_SELECTION: "算法选择卡住",
            IMPLEMENTATION_STUCK: "实现卡住",
            SOLUTION_CONSULTED: "参考了答案 / 题解",
          }
        : {
            NO_INITIAL_IDEA: "No initial idea",
            ALGORITHM_SELECTION: "Algorithm selection",
            IMPLEMENTATION_STUCK: "Implementation stuck",
            SOLUTION_CONSULTED: "Used solution / explanation",
          };
    return labels[attempt.selfAssessment];
  }
  const value = attempt.verdict ?? attempt.action;
  return locale === "zh" ? (zhVerdicts[value] ?? value) : titleCase(value);
}

function groupVersionLabel(group: AttemptGroup) {
  const first = group.attempts[0].sequenceNumber;
  const last = group.attempts.at(-1)!.sequenceNumber;
  return first === last ? `v${first}` : `v${first}–v${last}`;
}

function groupResultLabel(group: AttemptGroup, locale: "en" | "zh") {
  const counts = new Map<string, number>();
  for (const attempt of group.attempts) {
    const action = locale === "zh"
      ? ({ RUN: "运行", SUBMIT: "提交", MANUAL: "保存" }[attempt.action])
      : titleCase(attempt.action);
    const label = attempt.selfAssessment
      ? verdictLabel(attempt, locale)
      : attempt.verdict
        ? `${action} ${verdictLabel(attempt, locale)}`
        : action;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts].map(([label, count]) => `${label}${count > 1 ? ` ×${count}` : ""}`).join(" · ");
}

function masteryLabel(value: AnalysisView["masteryEvidence"], locale: "en" | "zh") {
  const labels = locale === "zh"
    ? { INDEPENDENT: "记录推断：独立完成", ASSISTED: "参考后完成", INSUFFICIENT: "独立完成证据不足" }
    : { INDEPENDENT: "Trace suggests independent", ASSISTED: "Assisted completion", INSUFFICIENT: "Independent evidence insufficient" };
  return labels[value ?? "INSUFFICIENT"];
}

function optimalAlternativeLabel(value: AnalysisView["optimalAlternative"], locale: "en" | "zh") {
  if (value?.status === "MATERIALLY_BETTER_APPROACH_EXISTS") {
    return locale === "zh" ? "可选优化方案" : "Optional optimization";
  }
  return locale === "zh" ? "当前解法已合适" : "Current approach is appropriate";
}

export function SessionExplorer({
  sessionId,
  attempts,
  initialAnalysis,
  initialFeedback,
  initialAssessment: initialAssessmentProp,
  solutionConsulted: solutionConsultedProp = false,
  locale = "en",
}: {
  sessionId: string;
  attempts: AttemptView[];
  initialAnalysis: AnalysisView | null;
  initialFeedback?: string | null;
  initialAssessment?:
    | "NO_INITIAL_IDEA"
    | "ALGORITHM_SELECTION"
    | "IMPLEMENTATION_STUCK"
    | null;
  solutionConsulted?: boolean;
  locale?: "en" | "zh";
}) {
  const groups = useMemo(() => groupConsecutiveAttempts(attempts), [attempts]);
  const [selected, setSelected] = useState(groups.length - 1);
  const [showDiff, setShowDiff] = useState(false);
  const [analysis, setAnalysis] = useState(initialAnalysis);
  const [analysisState, setAnalysisState] = useState<
    "idle" | "loading" | "error"
  >("idle");
  const [showImport, setShowImport] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [importText, setImportText] = useState("");
  const [editText, setEditText] = useState("");
  const [feedback, setFeedback] = useState(initialFeedback ?? "");
  const [manualMessage, setManualMessage] = useState("");
  const [initialAssessment, setInitialAssessment] = useState(
    initialAssessmentProp ?? null,
  );
  const [solutionConsulted, setSolutionConsulted] = useState(
    solutionConsultedProp,
  );
  const router = useRouter();
  const selectedGroup = groups[selected];
  const attempt = selectedGroup.attempts[0];
  const latestAttempt = selectedGroup.attempts.at(-1)!;
  const previous = selected > 0 ? groups[selected - 1].attempts[0] : null;
  const changes = useMemo(
    () => (previous ? diffLines(previous.code, attempt.code) : []),
    [attempt, previous],
  );
  const zh = locale === "zh";
  const insufficientEvidence = analysis?.primaryBlocker.conceptKey === "insufficient_evidence.no_actionable_blocker";
  const categoryLabel = (value: string) =>
    zh ? (zhCategories[value] ?? value) : titleCase(value);

  async function saveLearningLabels(update: {
    initialAssessment?:
      | "NO_INITIAL_IDEA"
      | "ALGORITHM_SELECTION"
      | "IMPLEMENTATION_STUCK"
      | null;
    solutionConsulted?: boolean;
  }) {
    const response = await fetch(`/api/sessions/${sessionId}/learning`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    });
    const body = (await response.json()) as {
      initialAssessment?: typeof initialAssessment;
      solutionConsulted?: boolean;
      error?: string;
    };
    if (!response.ok) {
      setManualMessage(
        body.error ||
          (zh ? "学习标记保存失败" : "Could not save learning label"),
      );
      return;
    }
    if (update.initialAssessment !== undefined)
      setInitialAssessment(body.initialAssessment ?? null);
    if (update.solutionConsulted !== undefined)
      setSolutionConsulted(body.solutionConsulted ?? false);
    setManualMessage(
      zh
        ? "学习标记已保存。下次 AI 分析会使用这项信息。"
        : "Learning label saved. Your next AI analysis will use it.",
    );
  }

  async function analyze() {
    setAnalysisState("loading");
    try {
      const response = await fetch(`/api/sessions/${sessionId}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      if (!response.ok) throw new Error("analysis failed");
      const body = (await response.json()) as { analysis: AnalysisView };
      setAnalysis(body.analysis);
      setAnalysisState("idle");
    } catch {
      setAnalysisState("error");
    }
  }

  async function deleteSession() {
    if (
      !window.confirm(
        zh
          ? "确定删除本次解题记录及全部代码快照吗？"
          : "Delete this session and all of its code snapshots?",
      )
    )
      return;
    const response = await fetch(`/api/sessions/${sessionId}`, {
      method: "DELETE",
    });
    if (response.ok) router.push(zh ? "/zh" : "/");
    else setAnalysisState("error");
  }

  async function exportForAI() {
    setManualMessage(zh ? "正在生成提示词…" : "Preparing prompt…");
    const response = await fetch(
      `/api/sessions/${sessionId}/analysis-export?locale=${locale}`,
    );
    const body = (await response.json()) as { prompt?: string; error?: string };
    if (!response.ok || !body.prompt) {
      setManualMessage(body.error || (zh ? "导出失败" : "Export failed"));
      return;
    }
    try {
      await navigator.clipboard.writeText(body.prompt);
      setManualMessage(
        zh
          ? "已复制 AI 分析提示词，可以粘贴到任意 AI。"
          : "AI analysis prompt copied. Paste it into any AI chat.",
      );
    } catch {
      setImportText(body.prompt);
      setShowImport(true);
      setManualMessage(
        zh
          ? "浏览器无法自动复制，请从文本框复制。"
          : "Clipboard access failed; copy the prompt from the text box.",
      );
    }
  }

  async function importAIResponse() {
    setAnalysisState("loading");
    setManualMessage("");
    const response = await fetch(`/api/sessions/${sessionId}/analysis-import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response: importText }),
    });
    const body = (await response.json()) as {
      analysis?: AnalysisView;
      error?: string;
    };
    if (!response.ok || !body.analysis) {
      setAnalysisState("idle");
      setManualMessage(body.error || (zh ? "导入失败" : "Import failed"));
      return;
    }
    setAnalysis(body.analysis);
    setAnalysisState("idle");
    setShowImport(false);
    setImportText("");
    setManualMessage(
      zh
        ? "AI 分析已导入，薄弱项也已更新。"
        : "AI analysis imported and weaknesses updated.",
    );
  }

  async function saveFeedback(
    kind: "CONFIRMED" | "DISPUTED" | "EDITED",
    edited?: AnalysisView,
  ) {
    const response = await fetch(`/api/sessions/${sessionId}/analysis`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        feedback: kind,
        ...(edited ? { analysis: edited } : {}),
      }),
    });
    const body = (await response.json()) as {
      analysis?: AnalysisView;
      feedback?: string;
      error?: string;
    };
    if (!response.ok) {
      setManualMessage(
        body.error || (zh ? "保存失败" : "Could not save feedback"),
      );
      return;
    }
    if (body.analysis) setAnalysis(body.analysis);
    setFeedback(body.feedback ?? kind);
    setShowEdit(false);
    setManualMessage(
      zh
        ? "你的修正已保存，并会用于薄弱项统计。"
        : "Your correction was saved and applied to weakness tracking.",
    );
  }

  return (
    <>
      <section className="timeline-panel">
        <div className="timeline-line" />
        <div className="start-node">
          <span />
          <p>20:00</p>
          <b>{zh ? "开始" : "Started"}</b>
        </div>
        {groups.map((group, index) => {
          const item = group.attempts[0];
          const latest = group.attempts.at(-1)!;
          return (
          <button
            key={item.id}
            className={`attempt-node ${selected === index ? "selected" : ""}`}
            onClick={() => {
              setSelected(index);
              setShowDiff(false);
            }}
          >
            <span
              className={
                latest.verdict === "ACCEPTED"
                  ? "accepted"
                  : latest.verdict === "TIME_LIMIT_EXCEEDED"
                    ? "warning"
                    : "failed"
              }
            >
              {group.attempts.length > 1 ? `×${group.attempts.length}` : group.firstIndex + 1}
            </span>
            <p>
              {new Date(item.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            <b>{groupVersionLabel(group)}</b>
            <small>{groupResultLabel(group, locale)}</small>
          </button>
          );
        })}
      </section>

      <section className="code-card">
        <div className="code-toolbar">
          <div>
            <span className="file-dot" />
            <strong>
              {attempt.selfAssessment
                ? zh
                  ? "学习标记"
                  : "Learning marker"
                : zh
                  ? "尝试"
                  : "Attempt"}{" "}
              {groupVersionLabel(selectedGroup)}
            </strong>
            <span className="lang-pill">
              {attempt.selfAssessment
                ? verdictLabel(attempt, locale)
                : attempt.language}
            </span>
          </div>
          <div>
            <button
              className="ghost-button"
              disabled={!previous}
              onClick={() => setShowDiff((value) => !value)}
            >
              {showDiff
                ? zh
                  ? "显示当前版本"
                  : "Show snapshot"
                : zh
                  ? "与上一版对比"
                  : "Compare with previous"}
            </button>
            <span
              className={`verdict-badge ${latestAttempt.verdict === "ACCEPTED" ? "success" : "danger"}`}
            >
              {groupResultLabel(selectedGroup, locale)}
            </span>
          </div>
        </div>
        <pre className="code-view">
          <code>
            {attempt.selfAssessment ? (
              <span>
                {attempt.selfAssessment === "SOLUTION_CONSULTED"
                  ? zh
                    ? "此处标记：参考了答案或题解。之后的通过不应视为独立完成。"
                    : "Marked here: a solution or explanation was consulted. Later acceptance should not be treated as independent solving."
                  : zh
                    ? "尚未开始写代码。"
                    : "No code had been written yet."}
                {attempt.note
                  ? `\n\n${zh ? "备注：" : "Note: "}${attempt.note}`
                  : ""}
              </span>
            ) : showDiff && previous ? (
              changes.map((part, index) => (
                <span
                  key={index}
                  className={
                    part.added
                      ? "line-added"
                      : part.removed
                        ? "line-removed"
                        : ""
                  }
                >
                  {part.value}
                </span>
              ))
            ) : (
              attempt.code
            )}
          </code>
        </pre>
      </section>

      <section className="learning-label-card">
        <div>
          <p className="eyebrow">{zh ? "学习标记" : "LEARNING LABELS"}</p>
          <p>
            {zh
              ? "可选：帮助 AI 区分独立完成与参考后完成。"
              : "Optional: helps AI distinguish independent and assisted completion."}
          </p>
        </div>
        <div className="learning-controls">
          <button
            className={initialAssessment === "NO_INITIAL_IDEA" ? "selected" : ""}
            onClick={() =>
              void saveLearningLabels({
                initialAssessment:
                  initialAssessment === "NO_INITIAL_IDEA" ? null : "NO_INITIAL_IDEA",
              })
            }
          >
            {zh ? "一开始没思路" : "No initial idea"}
          </button>
          <label className="solution-toggle">
            <input
              type="checkbox"
              checked={solutionConsulted}
              onChange={(event) =>
                void saveLearningLabels({
                  solutionConsulted: event.target.checked,
                })
              }
            />
            <span>
              {zh
                ? "看过题解 / 答案"
                : "Consulted a solution"}
            </span>
          </label>
        </div>
      </section>

      <section className="analysis-section">
        <div className="section-heading analysis-heading">
          <div>
            <p className="eyebrow">
              {zh ? "解题轨迹分析" : "TRAJECTORY ANALYSIS"}
            </p>
            <h2>
              {zh
                ? "解题过程中发生了什么变化"
                : "What changed while you solved it"}
            </h2>
            <p className="provider-note">
              {zh
                ? "默认使用免费的手动 AI 模式，也可以选择 API 自动分析。"
                : "Manual AI is the free default; API analysis remains optional."}
            </p>
          </div>
          <div className="heading-actions">
            <button className="manual-primary" onClick={exportForAI}>
              {zh ? "复制 AI 提示词" : "Copy AI prompt"}
            </button>
            <button
              className="ghost-button"
              onClick={() => {
                setShowImport(true);
                setManualMessage("");
              }}
            >
              {zh ? "导入 AI 结果" : "Import AI result"}
            </button>
            <button
              className="ghost-button"
              onClick={analyze}
              disabled={analysisState === "loading"}
            >
              {analysisState === "loading"
                ? zh
                  ? "分析中…"
                  : "Analyzing…"
                : zh
                  ? "API 分析"
                  : "Analyze via API"}
            </button>
            <button className="danger-button" onClick={deleteSession}>
              {zh ? "删除" : "Delete"}
            </button>
          </div>
        </div>
        {manualMessage && (
          <p
            className={
              manualMessage.includes("失败") ||
              manualMessage.includes("failed") ||
              manualMessage.includes("match")
                ? "error-banner"
                : "success-banner"
            }
          >
            {manualMessage}
          </p>
        )}
        {analysisState === "error" && (
          <p className="error-banner">
            {zh
              ? "暂时无法完成分析。解题记录已保存，请在 AI 服务恢复后重试。"
              : "Analysis could not be completed. Your session is still saved; try again when the AI service is available."}
          </p>
        )}
        {analysis ? (
          <div className="analysis-grid">
            <article className="primary-analysis">
              <div className="analysis-label">
                <span>{insufficientEvidence ? (zh ? "本次结论" : "SESSION CONCLUSION") : (zh ? "主要卡点" : "Primary blocker")}</span>
                {!insufficientEvidence && <b>
                  {Math.round(analysis.primaryBlocker.confidence * 100)}%{" "}
                  {zh ? "置信度" : "confidence"}
                </b>}
              </div>
              <p className="category">
                {insufficientEvidence ? (zh ? "轨迹证据" : "TRAJECTORY EVIDENCE") : categoryLabel(analysis.primaryBlocker.category)}
              </p>
              <h3>{insufficientEvidence ? (zh ? "本次没有明确的学习卡点" : "No specific learning blocker in this session") : analysis.primaryBlocker.conceptLabel}</h3>
              <p className="analysis-summary">{analysis.summary}</p>
              <blockquote>{analysis.primaryBlocker.evidence}</blockquote>
              <div className="analysis-actions">
                <button onClick={() => void saveFeedback("CONFIRMED")}>
                  ✓ {zh ? "准确" : "Correct"}
                </button>
                <button onClick={() => void saveFeedback("DISPUTED")}>
                  × {zh ? "不准确" : "Incorrect"}
                </button>
                <button
                  onClick={() => {
                    setEditText(JSON.stringify(analysis, null, 2));
                    setShowEdit(true);
                  }}
                >
                  {zh ? "编辑" : "Edit"}
                </button>
                {feedback && (
                  <small>
                    {feedback === "CONFIRMED"
                      ? zh
                        ? "已确认"
                        : "Confirmed"
                      : feedback === "DISPUTED"
                        ? zh
                          ? "已标记不准确"
                          : "Marked inaccurate"
                        : zh
                          ? "已手动编辑"
                          : "Manually edited"}
                  </small>
                )}
              </div>
              {analysis.nextPractice ? (
                <div className="solution-patterns next-practice">
                  <p className="eyebrow">{zh ? "下一步练习" : "NEXT PRACTICE"}</p>
                  <div>
                    <b>{analysis.nextPractice.goal}</b>
                    <span>{masteryLabel(analysis.masteryEvidence, locale)}</span>
                    <small>
                      {analysis.nextPractice.constraints.join(" · ")}
                      <br />
                      {zh ? "推荐模式：" : "Pattern: "}{analysis.nextPractice.recommendedProblemType}
                    </small>
                  </div>
                </div>
              ) : null}
              {analysis.optimalAlternative ? (
                <div className="solution-patterns optimal-alternative">
                  <p className="eyebrow">{zh ? "最优方案判断" : "OPTIMAL APPROACH CHECK"}</p>
                  <div className="optimal-summary">
                    <b>{optimalAlternativeLabel(analysis.optimalAlternative, locale)}</b>
                    <small>{analysis.optimalAlternative.approach}</small>
                    <div className="complexity-grid">
                      <span><i>{zh ? "时间" : "Time"}</i>{analysis.optimalAlternative.timeComplexity}</span>
                      <span><i>{zh ? "空间" : "Space"}</i>{analysis.optimalAlternative.spaceComplexity}</span>
                    </div>
                    <small>{zh ? "取舍：" : "Tradeoff: "}{analysis.optimalAlternative.tradeoff}</small>
                  </div>
                </div>
              ) : null}
              {analysis.solutionPatterns?.length ? (
                <div className="solution-patterns">
                  <p className="eyebrow">
                    {zh ? "本题解法模式" : "SOLUTION PATTERNS"}
                  </p>
                  {analysis.solutionPatterns.map((pattern) => (
                    <div key={pattern.patternKey}>
                      <b>{pattern.patternLabel}</b>
                      <span>{Math.round(pattern.confidence * 100)}%</span>
                      <small>{pattern.evidence}</small>
                    </div>
                  ))}
                </div>
              ) : null}
              {analysis.attemptIssues?.length ? (
                <div className="solution-patterns attempt-issues">
                  <p className="eyebrow">
                    {zh ? "每次未通过提交" : "FAILED SUBMISSIONS"}
                  </p>
                  {analysis.attemptIssues.map((item) => (
                    <div key={`${item.attempt}-${item.verdict}`}>
                      <b>
                        v{item.attempt} · {item.verdict}
                      </b>
                      <small>
                        {zh ? "问题：" : "Issue: "}{item.issue}
                        <br />
                        {zh ? "修复：" : "Fix: "}{item.fix}
                      </small>
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
            <aside className="secondary-analysis">
              {analysis.secondaryBlockers.length ? <p className="eyebrow">{zh ? "次要问题" : "SECONDARY ISSUE"}</p> : null}
              {analysis.secondaryBlockers.map((blocker) => (
                <div key={blocker.conceptKey}>
                  <p className="category">{categoryLabel(blocker.category)}</p>
                  <h3>{blocker.conceptLabel}</h3>
                  <p>{blocker.evidence}</p>
                </div>
              ))}
              <div className="strength">
                <span>↗</span>
                <div>
                  <b>{zh ? "发现的优势" : "Strength spotted"}</b>
                  <p>{analysis.strengths[0]}</p>
                </div>
              </div>
            </aside>
          </div>
        ) : (
          <div className="empty-analysis">
            {zh
              ? "尚未分析。分析完整解题轨迹，找出最主要的卡点。"
              : "No analysis yet. Analyze the full attempt trajectory to identify the main blocker."}
          </div>
        )}
      </section>
      {showImport && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowImport(false);
          }}
        >
          <section
            className="import-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-title"
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">MANUAL AI</p>
                <h2 id="import-title">
                  {zh ? "导入结构化分析" : "Import structured analysis"}
                </h2>
              </div>
              <button
                aria-label={zh ? "关闭" : "Close"}
                onClick={() => setShowImport(false)}
              >
                ×
              </button>
            </div>
            <p>
              {zh
                ? "把 ChatGPT、Claude、Gemini 或其他模型返回的 JSON 粘贴到这里。Markdown 的 ```json 代码块也可以识别。"
                : "Paste JSON returned by ChatGPT, Claude, Gemini, or another model. A fenced ```json block is accepted too."}
            </p>
            <textarea
              autoFocus
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              placeholder='{ "summary": "...", "primaryBlocker": { ... } }'
            />
            {manualMessage && <p className="modal-error">{manualMessage}</p>}
            <div className="modal-actions">
              <button
                className="ghost-button"
                onClick={() => setShowImport(false)}
              >
                {zh ? "取消" : "Cancel"}
              </button>
              <button
                className="manual-primary"
                disabled={!importText.trim() || analysisState === "loading"}
                onClick={importAIResponse}
              >
                {analysisState === "loading"
                  ? zh
                    ? "校验并导入中…"
                    : "Validating…"
                  : zh
                    ? "校验并导入"
                    : "Validate and import"}
              </button>
            </div>
          </section>
        </div>
      )}
      {showEdit && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowEdit(false);
          }}
        >
          <section
            className="import-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-title"
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">
                  {zh ? "人工修正" : "HUMAN CORRECTION"}
                </p>
                <h2 id="edit-title">
                  {zh ? "编辑 AI 分类" : "Edit AI classification"}
                </h2>
              </div>
              <button
                aria-label={zh ? "关闭" : "Close"}
                onClick={() => setShowEdit(false)}
              >
                ×
              </button>
            </div>
            <p>
              {zh
                ? "修改后会校验 JSON，并重新计算相关薄弱项。"
                : "The JSON is validated before saving and related weaknesses are recalculated."}
            </p>
            <textarea
              autoFocus
              value={editText}
              onChange={(event) => setEditText(event.target.value)}
            />
            {manualMessage && <p className="modal-error">{manualMessage}</p>}
            <div className="modal-actions">
              <button
                className="ghost-button"
                onClick={() => setShowEdit(false)}
              >
                {zh ? "取消" : "Cancel"}
              </button>
              <button
                className="manual-primary"
                onClick={() => {
                  try {
                    void saveFeedback(
                      "EDITED",
                      JSON.parse(editText) as AnalysisView,
                    );
                  } catch {
                    setManualMessage(
                      zh ? "请输入有效 JSON。" : "Enter valid JSON.",
                    );
                  }
                }}
              >
                {zh ? "保存修正" : "Save correction"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
