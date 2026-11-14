import type { NextResponse } from "next/server";
import { verificarToken } from "@/src/lib/auth";
import { respuestaDeErrorAuth, respuestaSesion, sinCache } from "@/src/lib/respuestas-auth";
import { obtenerPerfil } from "@/src/servicios/auth";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await verificarToken(request);
  if (!auth.autorizado) return sinCache(auth.respuesta);

  try {
    return respuestaSesion(await obtenerPerfil(auth.uid));
  } catch (error) {
    return respuestaDeErrorAuth(error);
  }
}
