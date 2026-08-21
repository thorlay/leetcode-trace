import { describe, expect, it } from "vitest";
import { ingestAttempt, type AttemptIngestionRepository, type IngestedAttempt } from "./ingest";
import type { IngestAttemptInput } from "./schema";

class MemoryRepository implements AttemptIngestionRepository {
  attempts: Array<Omit<IngestedAttempt, "duplicate">> = [];
  sessions = new Set<string>();

  async findByEventId(eventId: string) { return this.attempts.find((attempt) => attempt.eventId === eventId) ?? null; }
  async ensureProblem() { return "problem-1"; }
  async ensureSession({ id }: { id: string }) { this.sessions.add(id); }
  async nextSequence(sessionId: string) { return this.attempts.filter((attempt) => attempt.sessionId === sessionId).length + 1; }
  async createAttempt(input: { eventId: string; sessionId: string; sequenceNumber: number }) {
    const row = { id: `attempt-${this.attempts.length + 1}`, eventId: input.eventId, sessionId: input.sessionId, sequenceNumber: input.sequenceNumber };
    this.attempts.push(row);
    return row;
  }
}

const base: IngestAttemptInput = {
  eventId: "10000000-0000-4000-8000-000000000001",
  sessionId: "20000000-0000-4000-8000-000000000001",
  problem: { slug: "two-sum", title: "Two Sum", statement: "Find two indices." },
  action: "RUN",
  language: "python3",
  code: "class Solution: pass",
  timestamp: "2026-08-20T20:00:00.000Z",
};

describe("attempt ingestion", () => {
  it("does not create a duplicate for the same eventId", async () => {
    const repository = new MemoryRepository();
    const first = await ingestAttempt(repository, base);
    const duplicate = await ingestAttempt(repository, base);
    expect(first.duplicate).toBe(false);
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.id).toBe(first.id);
    expect(repository.attempts).toHaveLength(1);
  });

  it("assigns attempts to the session in capture order", async () => {
    const repository = new MemoryRepository();
    const first = await ingestAttempt(repository, base);
    const second = await ingestAttempt(repository, { ...base, eventId: "10000000-0000-4000-8000-000000000002", action: "SUBMIT" });
    expect([first.sequenceNumber, second.sequenceNumber]).toEqual([1, 2]);
    expect(repository.sessions).toEqual(new Set([base.sessionId]));
  });
});
