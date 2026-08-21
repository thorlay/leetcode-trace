import { NextResponse } from "next/server";
import { generateReviewTasks } from "@/lib/reviews/service";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { locale?: string; weaknessId?: string };
  try { return NextResponse.json({ tasks: await generateReviewTasks(body.locale === "zh" ? "zh" : "en", body.weaknessId) }, { status: 201 }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Reviews could not be generated" }, { status: 503 }); }
}
