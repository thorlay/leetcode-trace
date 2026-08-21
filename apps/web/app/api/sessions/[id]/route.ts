import { NextResponse } from "next/server";
import { getSession } from "@/lib/sessions";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession(id);
  return session ? NextResponse.json(session) : NextResponse.json({ error: "Session not found" }, { status: 404 });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.problemSession.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Session not found or could not be deleted" }, { status: 404 });
  }
}
