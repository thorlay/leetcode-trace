import { describe, expect, it } from "vitest";
import { parseRepairableAiJson } from "./json-repair";

describe("AI JSON repair", () => {
  it("repairs a common unescaped quote inside an AI explanation", () => {
    const value = parseRepairableAiJson('{"change":"将 lists[i] == "1" 修正为 lists[i] == 1。",}');
    expect(value).toEqual({ change: '将 lists[i] == "1" 修正为 lists[i] == 1。' });
  });

  it("still accepts fenced valid JSON", () => {
    expect(parseRepairableAiJson('```json\n{"ok": true}\n```')).toEqual({ ok: true });
  });
});
