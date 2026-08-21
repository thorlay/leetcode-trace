import type { AnalysisView } from "./types";

export function localizeAnalysisToChinese(analysis: AnalysisView | null): AnalysisView | null {
  if (!analysis || /[\u3400-\u9fff]/.test(analysis.summary)) return analysis;
  if (analysis.primaryBlocker.conceptKey !== "prefix_sum.hashmap") return analysis;

  return {
    ...analysis,
    summary: "这次解题先使用了不适用于含负数数组的滑动窗口，随后转向 O(n²) 前缀和，最终发现了前缀和频次查找。最后一个问题是遗漏了初始零前缀。",
    primaryBlocker: {
      ...analysis.primaryBlocker,
      conceptLabel: "前缀和 + 频次表转换",
      evidence: "第 1～3 次尝试没有把 prefix[j] - prefix[i] = k 转化为对 prefix[j] - k 的快速查找。",
      explanation: "大部分解题时间都花在识别线性模式上；发现正确思路后，代码很快就收敛了。",
    },
    secondaryBlockers: analysis.secondaryBlockers.map((blocker) => blocker.conceptKey === "prefix_sum.quadratic_to_linear" ? {
      ...blocker,
      conceptLabel: "把前缀和的两两查找从平方级优化到线性",
      evidence: "第 3 次尝试会为每个新前缀遍历此前的所有前缀，因此仍是 O(n²)。",
      explanation: "前缀和抽象已经正确，但查找过程还没有优化。",
    } : blocker),
    strengths: ["频次表思路出现后，只剩下一个局部边界问题需要修正。"],
    recommendedReviews: analysis.recommendedReviews.map((review) => ({ ...review, reason: "练习把前缀差等式转换为哈希表查找。" })),
  };
}
