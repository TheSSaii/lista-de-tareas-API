import type { NextResponse } from "next/server";
import { getAuthAdmin } from "./firebase";
import { respuestaError } from "./respuestas";

export type ResultadoAuth =
  { autorizado: true; uid: string } | { autorizado: false; respuesta: NextResponse };

function extraerToken(request: Request): string | null {
  const cabecera = request.headers.get("authorization");
  if (!cabecera) return null;

  const coincidencia = /^Bearer\s+(.+)$/i.exec(cabecera.trim());
  const token = coincidencia?.[1]?.trim();
  return token ? token : null;
}

function noAutorizado(): ResultadoAuth {
  return { autorizado: false, respuesta: respuestaError(401, "No autorizado") };
}

export async function verificarToken(request: Request): Promise<ResultadoAuth> {
  const token = extraerToken(request);
  if (!token) return noAutorizado();

  try {
    const { uid } = await getAuthAdmin().verifyIdToken(token);
    if (!uid) return noAutorizado();
    return { autorizado: true, uid };
  } catch {
    return noAutorizado();
  }
}
