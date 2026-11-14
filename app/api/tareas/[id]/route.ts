import { NextResponse } from "next/server";
import { verificarToken } from "@/src/lib/auth";
import { detallesZod, esquemaIdTarea, esquemaTarea } from "@/src/lib/esquema-tarea";
import { respuestaError, respuestaInterna } from "@/src/lib/respuestas";
import { eliminarTarea, guardarTarea } from "@/src/servicios/tareas";

export const runtime = "nodejs";

type Contexto = { params: Promise<{ id: string }> };

type CuerpoLeido = { ok: true; valor: unknown } | { ok: false };

function errorId(): NextResponse {
  return respuestaError(400, "Id inválido", [
    { campo: "id", mensaje: "El id debe ser un UUID o un identificador seguro" },
  ]);
}

async function leerCuerpo(request: Request): Promise<CuerpoLeido> {
  try {
    return { ok: true, valor: await request.json() };
  } catch {
    return { ok: false };
  }
}

export async function PUT(request: Request, contexto: Contexto): Promise<NextResponse> {
  const auth = await verificarToken(request);
  if (!auth.autorizado) return auth.respuesta;

  try {
    const { id } = await contexto.params;
    if (!esquemaIdTarea.safeParse(id).success) return errorId();

    const cuerpo = await leerCuerpo(request);
    if (!cuerpo.ok) {
      return respuestaError(400, "Cuerpo inválido", [
        { campo: "(cuerpo)", mensaje: "Debe ser JSON válido" },
      ]);
    }

    const tarea = esquemaTarea.safeParse(cuerpo.valor);
    if (!tarea.success) return respuestaError(400, "Datos inválidos", detallesZod(tarea.error));

    return NextResponse.json(await guardarTarea(auth.uid, id, tarea.data));
  } catch {
    return respuestaInterna();
  }
}

export async function DELETE(request: Request, contexto: Contexto): Promise<NextResponse> {
  const auth = await verificarToken(request);
  if (!auth.autorizado) return auth.respuesta;

  try {
    const { id } = await contexto.params;
    if (!esquemaIdTarea.safeParse(id).success) return errorId();

    const eliminada = await eliminarTarea(auth.uid, id);
    if (!eliminada) return respuestaError(404, "No encontrado");

    return NextResponse.json({ ok: true });
  } catch {
    return respuestaInterna();
  }
}
