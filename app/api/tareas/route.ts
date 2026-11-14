import { NextResponse } from "next/server";
import { verificarToken } from "@/src/lib/auth";
import { esquemaSince } from "@/src/lib/esquema-tarea";
import { respuestaError, respuestaInterna } from "@/src/lib/respuestas";
import { listarTareas } from "@/src/servicios/tareas";

export const runtime = "nodejs";

async function responderLista(uid: string, since: string | null): Promise<NextResponse> {
  try {
    return NextResponse.json(await listarTareas(uid, since));
  } catch {
    return respuestaInterna();
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await verificarToken(request);
  if (!auth.autorizado) return auth.respuesta;

  const since = new URL(request.url).searchParams.get("since");
  if (since === null) return responderLista(auth.uid, null);

  const valido = esquemaSince.safeParse(since);
  if (!valido.success) {
    const mensaje = valido.error.issues[0]?.message ?? "Debe ser una fecha ISO 8601";
    return respuestaError(400, "Parámetro inválido", [{ campo: "since", mensaje }]);
  }

  return responderLista(auth.uid, valido.data);
}
