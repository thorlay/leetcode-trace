import { NextResponse } from "next/server";
import { getTodayReviewTasks } from "@/lib/reviews/service";

export async function GET() {
  try { return NextResponse.json(await getTodayReviewTasks()); }
  catch { return NextResponse.json({ error: "Reviews could not be loaded" }, { status: 500 }); }
}
