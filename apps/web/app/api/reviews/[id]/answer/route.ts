import { NextResponse } from "next/server";
import { z } from "zod";
import { answerReviewTask } from "@/lib/reviews/service";

const schema = z.object({ answer: z.string().min(1).max(20_000), locale: z.enum(["en", "zh"]).default("en") });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "An answer is required" }, { status: 400 });
  try { return NextResponse.json(await answerReviewTask((await params).id, parsed.data.answer, parsed.data.locale)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Answer could not be evaluated" }, { status: 503 }); }
}
