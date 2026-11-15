import type { NextResponse } from "next/server";
import { verificarToken } from "@/src/lib/auth";
import { respuestaInterna, respuestaJson } from "@/src/lib/respuestas";
import { obtenerResumenTareas } from "@/src/servicios/tareas";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await verificarToken(request);
  if (!auth.autorizado) return auth.respuesta;

  try {
    return respuestaJson(await obtenerResumenTareas(auth.uid));
  } catch {
    return respuestaInterna();
  }
}
