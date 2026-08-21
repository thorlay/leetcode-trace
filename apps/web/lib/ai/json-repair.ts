import { jsonrepair } from "jsonrepair";

export function extractJson(raw: string) {
  const fenced = raw.trim().match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced?.[1]?.trim() ?? raw.trim();
}

function escapeInteriorQuotes(source: string) {
  let repaired = "";
  let inString = false;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (inString && character === '"' && !escaped) {
      const next = source.slice(index + 1).match(/\S/)?.[0];
      // A JSON string can only close before a structural delimiter. Any other
      // quote is almost certainly a model's unescaped quote in prose/code.
      if (next && ![",", "}", "]", ":"].includes(next)) {
        repaired += '\\"';
        continue;
      }
      inString = false;
    } else if (!inString && character === '"') {
      inString = true;
    }
    repaired += character;
    escaped = character === "\\" && !escaped;
    if (character !== "\\") escaped = false;
  }
  return repaired;
}

/**
 * AI responses commonly contain harmless JSON mistakes (fences, smart quotes,
 * trailing commas, or an unescaped quote inside a Chinese explanation). Repair
 * only the syntax here; the caller still validates the complete schema.
 */
export function parseRepairableAiJson(raw: string): unknown {
  const source = extractJson(raw);
  try {
    return JSON.parse(source);
  } catch {
    try {
      const parsed = JSON.parse(jsonrepair(escapeInteriorQuotes(source)));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Expected an object");
      return parsed;
    } catch {
      throw new Error("AI response is not valid JSON, even after automatic repair");
    }
  }
}
