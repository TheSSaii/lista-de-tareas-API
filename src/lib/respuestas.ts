import { NextResponse } from "next/server";

export type DetalleError = {
  campo: string;
  mensaje: string;
};

export function respuestaError(
  estado: number,
  error: string,
  detalles?: DetalleError[],
): NextResponse {
  const cuerpo = detalles ? { error, detalles } : { error };
  return NextResponse.json(cuerpo, { status: estado });
}

export function respuestaJson(cuerpo: unknown, estado = 200): NextResponse {
  const respuesta = NextResponse.json(cuerpo, { status: estado });
  respuesta.headers.set("cache-control", "no-store");
  return respuesta;
}

export function respuestaInterna(): NextResponse {
  return respuestaError(500, "Error interno");
}
