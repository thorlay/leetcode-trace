import { NextResponse } from "next/server";
import { getRecentSessions } from "@/lib/sessions";

export async function GET() {
  return NextResponse.json(await getRecentSessions());
}
