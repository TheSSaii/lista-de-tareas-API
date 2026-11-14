import type { NextResponse } from "next/server";
import { respuestaJson } from "@/src/lib/respuestas";

export const runtime = "nodejs";

export function GET(): NextResponse {
  return respuestaJson({ ok: true });
}
