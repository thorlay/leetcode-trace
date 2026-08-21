import { NextResponse } from "next/server";
import { getLearningProfile } from "@/lib/global-learning";
export async function GET() { return NextResponse.json(await getLearningProfile()); }
