import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({ status: z.literal("ABANDONED") });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!schema.safeParse(await request.json().catch(() => null)).success) return NextResponse.json({ error: "Invalid session status" }, { status: 400 });
  try {
    const session = await prisma.problemSession.updateMany({ where: { id, status: "ACTIVE" }, data: { status: "ABANDONED", endedAt: new Date() } });
    return NextResponse.json({ id, ended: session.count > 0 });
  } catch {
    return NextResponse.json({ error: "Session could not be ended" }, { status: 500 });
  }
}
