import type { NextResponse } from "next/server";
import { leerCuerpoJson } from "@/src/lib/cuerpo";
import { detallesZod } from "@/src/lib/detalles-zod";
import { esquemaLogin } from "@/src/lib/esquema-auth";
import {
  respuestaDeErrorAuth,
  respuestaErrorAuth,
  respuestaSesion,
} from "@/src/lib/respuestas-auth";
import { iniciarSesion } from "@/src/servicios/auth";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const cuerpo = await leerCuerpoJson(request);
  if (!cuerpo.ok) {
    return respuestaErrorAuth(400, "Cuerpo inválido", [
      { campo: "(cuerpo)", mensaje: "Debe ser JSON válido" },
    ]);
  }

  const datos = esquemaLogin.safeParse(cuerpo.valor);
  if (!datos.success) {
    return respuestaErrorAuth(400, "Datos inválidos", detallesZod(datos.error));
  }

  try {
    return respuestaSesion(await iniciarSesion(datos.data));
  } catch (error) {
    return respuestaDeErrorAuth(error);
  }
}
