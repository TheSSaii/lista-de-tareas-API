import type { NextResponse } from "next/server";
import { ErrorAutenticacion } from "./errores-auth";
import { respuestaError, respuestaJson, type DetalleError } from "./respuestas";

export function sinCache(respuesta: NextResponse): NextResponse {
  respuesta.headers.set("cache-control", "no-store");
  return respuesta;
}

export function respuestaSesion(cuerpo: unknown, estado = 200): NextResponse {
  return respuestaJson(cuerpo, estado);
}

export function respuestaErrorAuth(
  estado: number,
  error: string,
  detalles?: DetalleError[],
): NextResponse {
  return sinCache(respuestaError(estado, error, detalles));
}

export function respuestaDeErrorAuth(error: unknown): NextResponse {
  if (error instanceof ErrorAutenticacion) {
    return respuestaErrorAuth(error.estado, error.mensaje, error.detalles);
  }

  return respuestaErrorAuth(500, "Error interno");
}
