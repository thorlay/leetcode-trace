"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseLeetCodeDump, type LeetCodeDumpFile } from "@/lib/history/leetcode-dump";

const copy = {
  en: { eyebrow: "OFFLINE IMPORT", title: "Import a LeetCode-Dump folder", body: "Select a previously exported folder to import its .cache.json and local source files.", command: "Or run the integrated local history importer:", copyCommand: "Copy local command", copied: "Command copied. Paste it in a project terminal.", copyFailed: "Could not copy the command. Copy the text shown above.", choose: "Choose exported folder", working: "Importing…", note: "The local command prompts for session and CSRF cookies invisibly; neither is stored or uploaded to Reviewly.", done: (saved: number, duplicates: number, skipped: number) => `Imported ${saved} submissions; skipped ${duplicates} existing and ${skipped} incomplete records.` },
  zh: { eyebrow: "离线导入", title: "导入 LeetCode-Dump 文件夹", body: "选择以前导出的文件夹，Reviewly 会读取其中的 .cache.json 和本地代码文件。", command: "或运行内置的本地历史导入命令：", copyCommand: "复制本地导入命令", copied: "命令已复制，请在项目终端中粘贴运行。", copyFailed: "无法自动复制，请手动复制上方命令。", choose: "选择导出文件夹", working: "导入中…", note: "本地命令会隐藏输入 Session 和 CSRF Cookie；二者均不会保存或上传到 Reviewly。", done: (saved: number, duplicates: number, skipped: number) => `已导入 ${saved} 条提交；跳过 ${duplicates} 条已有记录和 ${skipped} 条不完整记录。` },
} as const;

async function readFiles(list: FileList) { return Promise.all(Array.from(list).map(async (file): Promise<LeetCodeDumpFile> => ({ name: file.name, relativePath: file.webkitRelativePath || file.name, text: await file.text() }))); }

export function LeetCodeDumpImport({ locale }: { locale: "en" | "zh" }) {
  const t = copy[locale]; const router = useRouter(); const inputRef = useRef<HTMLInputElement>(null); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function importFolder(files: FileList) {
    setBusy(true); setMessage("");
    try {
      const parsed = parseLeetCodeDump(await readFiles(files));
      if (!parsed.submissions.length) throw new Error(locale === "zh" ? "没有找到可导入的代码提交。请确认选择的是 LeetCode-Dump 的输出文件夹。" : "No importable code submissions were found. Select the LeetCode-Dump output folder.");
      let saved = 0; let duplicates = 0;
      for (let index = 0; index < parsed.submissions.length; index += 100) {
        const response = await fetch("/api/import/leetcode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ submissions: parsed.submissions.slice(index, index + 100) }) });
        const body = await response.json() as { imported?: number; duplicates?: number; error?: string };
        if (!response.ok) throw new Error(body.error || "Import failed");
        saved += body.imported ?? 0; duplicates += body.duplicates ?? 0;
      }
      const finalized = await fetch("/api/import/leetcode/finalize", { method: "POST" });
      if (!finalized.ok) throw new Error("Imported records could not be organized into sessions.");
      setMessage(t.done(saved, duplicates, parsed.skipped)); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Import failed"); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ""; }
  }
  async function copyCommand() {
    try { await navigator.clipboard.writeText("pnpm leetcode:dump"); setMessage(t.copied); }
    catch { setMessage(t.copyFailed); }
  }
  return <section className="dump-import"><div><p className="eyebrow">{t.eyebrow}</p><h2>{t.title}</h2><p>{t.body}</p><p className="dump-command-label">{t.command} <code>pnpm leetcode:dump</code></p><small>{t.note}</small></div><div className="dump-import-actions"><input ref={inputRef} type="file" multiple {...({ webkitdirectory: "" } as Record<string, string>)} onChange={(event) => { const files = event.target.files; if (files?.length) void importFolder(files); }} /><button className="manual-primary" onClick={copyCommand}>{t.copyCommand}</button><button className="ghost-button" disabled={busy} onClick={() => inputRef.current?.click()}>{busy ? t.working : t.choose}</button>{message && <p className={message.includes("失败") || message.includes("failed") || message.includes("无法") ? "error-banner" : "success-banner"}>{message}</p>}</div></section>;
}
