import { NextResponse } from "next/server";
import { persistAttempt } from "@/lib/attempts/service";
import { ingestAttemptSchema } from "@/lib/attempts/schema";

export async function POST(request: Request) {
  const parsed = ingestAttemptSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid attempt payload", details: parsed.error.flatten() }, { status: 400 });
  try {
    const attempt = await persistAttempt(parsed.data);
    return NextResponse.json(attempt, { status: attempt.duplicate ? 200 : 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save attempt" }, { status: 500 });
  }
}
