"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function SiteHeader() {
  const pathname = usePathname();
  const chinese = pathname === "/zh" || pathname.startsWith("/zh/");
  const sessionMatch = pathname.match(/\/(?:zh\/)?sessions\/([^/]+)/);
  const section = pathname.includes("/history") ? "history" : pathname.includes("/problems") ? "problems" : pathname.includes("/insights") ? "insights" : pathname.includes("/data") ? "data" : pathname.includes("/weaknesses") ? "weaknesses" : pathname.includes("/reviews") ? "reviews" : null;
  const alternateHref = sessionMatch
    ? chinese ? `/sessions/${sessionMatch[1]}` : `/zh/sessions/${sessionMatch[1]}`
    : section ? chinese ? `/${section}` : `/zh/${section}` : chinese ? "/" : "/zh";

  useEffect(() => {
    document.documentElement.lang = chinese ? "zh-CN" : "en";
  }, [chinese]);

  return (
    <header className="topbar">
      <Link href={chinese ? "/zh" : "/"} className="brand"><span className="brand-mark">R</span> Reviewly</Link>
      <nav aria-label={chinese ? "主导航" : "Main navigation"}>
        <Link href={chinese ? "/zh" : "/"} className={!section && !sessionMatch ? "nav-active" : ""}>{chinese ? "概览" : "Overview"}</Link>
        <Link className={section === "history" || Boolean(sessionMatch) ? "nav-active" : ""} href={chinese ? "/zh/history" : "/history"}>{chinese ? "解题记录" : "Sessions"}</Link>
        <Link className={section === "problems" ? "nav-active" : ""} href={chinese ? "/zh/problems" : "/problems"}>{chinese ? "题目" : "Problems"}</Link>
        <Link className={section === "weaknesses" ? "nav-active" : ""} href={chinese ? "/zh/weaknesses" : "/weaknesses"}>{chinese ? "薄弱项" : "Weaknesses"}</Link>
        <Link className={section === "insights" ? "nav-active" : ""} href={chinese ? "/zh/insights" : "/insights"}>{chinese ? "学习计划" : "Plan"}</Link>
        <Link className={section === "reviews" ? "nav-active" : ""} href={chinese ? "/zh/reviews" : "/reviews"}>{chinese ? "复习" : "Reviews"}</Link>
      </nav>
      <div className="header-actions">
        <div className="streak"><span>●</span> {chinese ? "连续 7 天" : "7 day streak"}</div>
        <Link className="language-switch" href={alternateHref} aria-label={chinese ? "Switch to English" : "切换到中文"}>{chinese ? "EN" : "中文"}</Link>
      </div>
    </header>
  );
}
