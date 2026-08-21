import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const initialAssessment = z.enum(["NO_INITIAL_IDEA", "ALGORITHM_SELECTION", "IMPLEMENTATION_STUCK"]);
const schema = z.object({ initialAssessment: initialAssessment.nullable().optional(), solutionConsulted: z.boolean().optional() }).refine((input) => input.initialAssessment !== undefined || input.solutionConsulted !== undefined, "No learning label supplied");

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid learning label" }, { status: 400 });
  const { id } = await params;
  try {
    const session = await prisma.problemSession.update({ where: { id }, data: { ...parsed.data, analysisStatus: "PENDING" }, select: { initialAssessment: true, solutionConsulted: true } });
    return NextResponse.json(session);
  } catch {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
}
