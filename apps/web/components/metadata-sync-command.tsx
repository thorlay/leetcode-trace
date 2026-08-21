"use client";

import { useState } from "react";

const copy = {
  en: { button: "Copy sync command", copied: "Command copied. Run it in the project terminal.", failed: "Could not copy the command; copy it manually.", note: "Syncs topic tags, difficulty, problem number, Premium status, and acceptance rate. Cookies are requested only by the local command and are never stored." },
  zh: { button: "复制标签同步命令", copied: "命令已复制，请在项目终端运行。", failed: "无法自动复制，请手动复制命令。", note: "同步主题标签、难度、题号、Premium 状态和通过率。Cookie 只由本地命令隐藏输入，绝不保存。" },
} as const;

export function MetadataSyncCommand({ locale }: { locale: "en" | "zh" }) {
  const [message, setMessage] = useState(""); const t = copy[locale];
  async function copyCommand() { try { await navigator.clipboard.writeText("pnpm leetcode:metadata"); setMessage(t.copied); } catch { setMessage(t.failed); } }
  return <section className="metadata-sync"><div><p className="eyebrow">{locale === "zh" ? "本地元数据同步" : "LOCAL METADATA SYNC"}</p><p>{t.note}</p><code>pnpm leetcode:metadata</code></div><div><button className="manual-primary" onClick={copyCommand}>{t.button}</button>{message && <small>{message}</small>}</div></section>;
}
