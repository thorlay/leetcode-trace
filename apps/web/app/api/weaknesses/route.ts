import { NextResponse } from "next/server";
import { getWeaknesses } from "@/lib/weaknesses";
export async function GET() { return NextResponse.json(await getWeaknesses()); }
