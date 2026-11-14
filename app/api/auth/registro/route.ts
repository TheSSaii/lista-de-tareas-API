import type { NextResponse } from "next/server";
import { leerCuerpoJson } from "@/src/lib/cuerpo";
import { detallesZod } from "@/src/lib/detalles-zod";
import { esquemaRegistro } from "@/src/lib/esquema-auth";
import {
  respuestaDeErrorAuth,
  respuestaErrorAuth,
  respuestaSesion,
} from "@/src/lib/respuestas-auth";
import { registrarUsuario } from "@/src/servicios/auth";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const cuerpo = await leerCuerpoJson(request);
  if (!cuerpo.ok) {
    return respuestaErrorAuth(400, "Cuerpo inválido", [
      { campo: "(cuerpo)", mensaje: "Debe ser JSON válido" },
    ]);
  }

  const datos = esquemaRegistro.safeParse(cuerpo.valor);
  if (!datos.success) {
    return respuestaErrorAuth(400, "Datos inválidos", detallesZod(datos.error));
  }

  try {
    return respuestaSesion(await registrarUsuario(datos.data), 201);
  } catch (error) {
    return respuestaDeErrorAuth(error);
  }
}
