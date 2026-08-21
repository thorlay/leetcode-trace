# Reviewly — AI LeetCode Review System

This repository implements the local MVP loop: capture LeetCode attempts, analyze the trajectory, aggregate weaknesses, generate focused reviews, evaluate answers, and schedule the next review.

Manual AI export/import is the default provider: copy a complete Markdown trajectory prompt into ChatGPT, Claude, Gemini, or another model, then paste its structured JSON response back into the session page. OpenAI API analysis is an optional adapter.

The app intentionally remains useful without PostgreSQL or an OpenAI key: the dashboard and LC560 demo render from an in-app fixture. Database-backed analysis and re-analysis activate once local services and environment variables are configured.

## Prerequisites

- Node.js 22+
- pnpm 10+
- Docker Desktop (for PostgreSQL)
- An OpenAI API key (only required to run or retry analysis)

## Setup

```bash
pnpm install
cp apps/web/.env.example apps/web/.env
docker compose up -d
pnpm db:generate
pnpm db:migrate -- --name init
pnpm db:seed
pnpm dev
pnpm build:extension
```

Open [http://localhost:3000](http://localhost:3000). The seeded session is linked from the Recent Sessions card.

If port 5432 is already occupied, start with `POSTGRES_PORT=5433 docker compose up -d` and change the port in `apps/web/.env` to match.

## Environment variables

Configure these in `apps/web/.env`:

```text
DATABASE_URL=postgresql://leetcode:leetcode@localhost:5432/leetcode_review?schema=public
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-mini
```

`OPENAI_MODEL` is configurable. All model calls live under `apps/web/lib/ai`, use structured output, and are validated before persistence. If the model call fails, the session remains available and its analysis status becomes `FAILED`.

No API key is required for trajectory analysis. On a session page, use **Copy AI prompt**, paste it into any AI chat, then use **Import AI result**. Imports accept plain JSON or a fenced `json` block, validate against the same Zod schema, and feed the normal analysis → weakness → review pipeline.

## Install the Chrome extension

1. Run `pnpm build:extension`.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select `apps/extension`.
5. Keep the local web app running at `http://localhost:3000`.
6. Open any `https://leetcode.com/*` page and reload it once after installation.

The extension automatically captures **Run** and **Submit** on problem pages, waits up to 60 seconds for the verdict, and assigns `UNKNOWN` if no verdict appears. Its popup provides an ON/OFF toggle, a manual **Capture snapshot** fallback, and **Import LeetCode history**.

Historical import reads paginated submissions through the already signed-in LeetCode page, deduplicates them by `submissionId`, and reconstructs sessions when adjacent submissions for the same problem are less than 24 hours apart. It works on `leetcode.com` and `leetcode.cn`, and never copies authentication cookies or headers to Reviewly. Historical sessions are marked `FINAL_ONLY` or `SUBMISSIONS_ONLY`; new live sessions remain `FULL`. AI analysis is not run during import.

Use `/history` or `/zh/history` to browse imported sessions. Use `/data` or `/zh/data` to export a full JSON backup, CSV summary, Markdown history, or JSONL AI dataset. A JSON backup containing problem metadata, submissions, and code can be restored idempotently from the same page.

### Reliable local history import

For a large history export, run the built-in local importer while the web app is running:

```bash
pnpm leetcode:dump
```

It asks for `LEETCODE_SESSION` and `csrftoken` without echoing or storing either value, reads your submissions directly at a conservative two requests per ten seconds with retries, and imports them into Reviewly. Both values stay only in the local command process and are sent only to LeetCode; they never enter Reviewly's browser UI, database, extension storage, or logs. Re-runs are safe: Reviewly deduplicates by submission ID. The command defaults to `https://leetcode.com`; set `REVIEWLY_LEETCODE_DOMAIN=https://leetcode.cn` when both cookies were copied from the China site.

All LeetCode DOM assumptions are isolated in `apps/extension/src/page/leetcodeAdapter.ts`. The extension never reads cookies, authentication headers, browser history, passwords, or keystrokes.

## Useful commands

```bash
pnpm dev          # local Next.js app
pnpm build        # production build
pnpm build:extension # build the unpacked Chrome extension
pnpm test         # unit tests
pnpm lint         # lint
pnpm db:seed      # idempotently reload demo data
```

## Current milestone

- PostgreSQL + Prisma schema for problems, sessions, attempts, analyses, weaknesses, and reviews
- Idempotent LC560 development seed with five complete code snapshots
- Dashboard that works before the Chrome extension exists
- Session timeline with selectable versions and a previous-version line diff
- Deterministic attempt counts, timing, verdict counts, and change-size classifications
- Manual trajectory analysis endpoint using configurable OpenAI structured output
- Prompt version, model, raw JSON, observations, and aggregated weaknesses persisted together
- Graceful demo mode when PostgreSQL or OpenAI is unavailable
- Manifest V3 extension with automatic Run/Submit capture and manual fallback
- Paginated, idempotent LeetCode history import with 24-hour session reconstruction
- Capture completeness and optional trajectory status across live and historical sessions
- Filtered JSON/CSV/Markdown/AI Dataset export plus idempotent JSON restore
- Verdict observation, 60-second timeout, tab-scoped sessions, inactivity expiry, and Accepted completion
- Idempotent attempt ingestion and verdict update endpoints
- Weakness profile with recurring-pattern evidence and mastery scores
- Review generation, today's queue, answer evaluation, and deterministic scheduling
- English and Simplified Chinese experiences for dashboards, sessions, weaknesses, reviews, and AI output
- Session deletion and privacy-preserving local-only capture

The seeded LC560 flow works without an API key using deterministic review fallbacks. Configure OpenAI to use model-generated trajectory analysis, questions, and evaluation.
