import process from "node:process";

const appUrl = (process.env.REVIEWLY_URL ?? "http://localhost:3000").replace(/\/$/, "");
const leetCodeUrl = (process.env.REVIEWLY_LEETCODE_DOMAIN ?? "https://leetcode.com").replace(/\/$/, "");

type Tag = { slug: string; label: string };
type Question = { questionFrontendId?: string; difficulty?: string; isPaidOnly?: boolean; likes?: number; dislikes?: number; stats?: string; topicTags?: Array<{ slug?: string; name?: string }> };
type Metadata = { slug: string; frontendId?: string; difficulty?: string; isPremium?: boolean; acceptanceRate?: number; likes?: number; dislikes?: number; tags: Tag[] };

function askForSecret(prompt: string, environmentName: string) {
  if (!process.stdin.isTTY) throw new Error(`Set ${environmentName} in your shell when running without an interactive terminal.`);
  return new Promise<string>((resolve) => {
    process.stdout.write(prompt); let value = ""; process.stdin.setRawMode(true); process.stdin.resume();
    process.stdin.on("data", function onData(chunk: Buffer) {
      const key = chunk.toString("utf8");
      if (key === "\r" || key === "\n") { process.stdin.setRawMode(false); process.stdin.pause(); process.stdin.off("data", onData); process.stdout.write("\n"); resolve(value.trim()); return; }
      if (key === "\u0003") { process.stdin.setRawMode(false); process.stdin.pause(); process.stdin.off("data", onData); process.stdout.write("\n"); resolve(""); return; }
      if (key === "\u007f") { value = value.slice(0, -1); return; }
      if (!key.startsWith("\u001b")) value += key;
    });
  });
}

function wait(milliseconds: number) { return new Promise<void>((resolve) => setTimeout(resolve, milliseconds)); }

function headers(session: string, csrf: string) {
  return { Accept: "application/json", "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36", Referer: `${leetCodeUrl}/`, Origin: leetCodeUrl, Cookie: `LEETCODE_SESSION=${session}; csrftoken=${csrf}`, "x-csrftoken": csrf };
}

async function queryLeetCode(query: string, session: string, csrf: string) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${leetCodeUrl}/graphql/`, { method: "POST", headers: headers(session, csrf), body: JSON.stringify({ query }) });
    if (response.ok) return response.json() as Promise<{ data?: Record<string, Question | null>; errors?: Array<{ message?: string }> }>;
    if ((response.status === 403 || response.status === 429) && attempt < 3) { const delay = 10_000 * 2 ** attempt; console.log(`LeetCode returned ${response.status}; waiting ${delay / 1_000} seconds before retrying…`); await wait(delay); continue; }
    throw new Error(`LeetCode metadata request failed (${response.status}). Open the Submissions page on ${leetCodeUrl} once, verify both cookies use that domain, then retry.`);
  }
  throw new Error("LeetCode metadata request could not be retried.");
}

function acceptanceRate(stats: string | undefined) {
  if (!stats) return undefined;
  const match = stats.match(/"acRate"\s*:\s*"?([\d.]+)/);
  const value = Number(match?.[1]);
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : undefined;
}

function toMetadata(slug: string, question: Question): Metadata {
  return { slug, frontendId: question.questionFrontendId, difficulty: question.difficulty, isPremium: question.isPaidOnly, acceptanceRate: acceptanceRate(question.stats), likes: question.likes, dislikes: question.dislikes, tags: (question.topicTags ?? []).flatMap((tag) => tag.slug && tag.name ? [{ slug: tag.slug, label: tag.name }] : []) };
}

async function main() {
  let session = process.env.LEETCODE_SESSION || await askForSecret("Paste LEETCODE_SESSION (hidden; never saved): ", "LEETCODE_SESSION");
  let csrf = process.env.LEETCODE_CSRFTOKEN || await askForSecret("Paste csrftoken (hidden; never saved): ", "LEETCODE_CSRFTOKEN");
  if (!session || !csrf) throw new Error("Both LEETCODE_SESSION and csrftoken are required.");
  const response = await fetch(`${appUrl}/api/import/leetcode/metadata`); const source = await response.json().catch(() => ({})) as { slugs?: string[]; error?: string };
  if (!response.ok) throw new Error(source.error ?? `Reviewly is unavailable at ${appUrl}. Is pnpm dev running?`);
  const slugs = source.slugs ?? [];
  if (!slugs.length) { console.log("No local problems to sync."); return; }
  console.log(`Syncing metadata for ${slugs.length} local problems from ${leetCodeUrl}…`);
  let updated = 0; let skipped = 0;
  try {
    for (let index = 0; index < slugs.length; index += 20) {
      const chunk = slugs.slice(index, index + 20);
      const fields = chunk.map((slug, offset) => `q${offset}: question(titleSlug: ${JSON.stringify(slug)}) { questionFrontendId difficulty isPaidOnly likes dislikes stats topicTags { name slug } }`).join(" ");
      const body = await queryLeetCode(`query ReviewlyProblemMetadata { ${fields} }`, session, csrf);
      if (body.errors?.length) throw new Error(`LeetCode metadata query failed: ${body.errors[0]?.message ?? "unknown error"}`);
      const problems = chunk.flatMap((slug, offset) => { const question = body.data?.[`q${offset}`]; return question ? [toMetadata(slug, question)] : []; });
      if (problems.length) {
        const saved = await fetch(`${appUrl}/api/import/leetcode/metadata`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ problems }) });
        const result = await saved.json().catch(() => ({})) as { updated?: number; skipped?: number; error?: string };
        if (!saved.ok) throw new Error(result.error ?? `Reviewly metadata import failed (${saved.status}).`);
        updated += result.updated ?? 0; skipped += result.skipped ?? 0;
      }
      console.log(`Processed ${Math.min(index + chunk.length, slugs.length)}/${slugs.length} problems.`);
      if (index + chunk.length < slugs.length) await wait(10_000);
    }
  } finally { session = ""; csrf = ""; }
  console.log(`Done. Updated metadata for ${updated} problems; skipped ${skipped}.`);
}

void main().catch((error) => { console.error(`\nTag sync failed: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1; });
