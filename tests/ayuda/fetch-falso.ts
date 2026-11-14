export function respuestaJson(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { "content-type": "application/json" },
  });
}

export function respuestaTexto(estado = 200): Response {
  return new Response("respuesta no json", {
    status: estado,
    headers: { "content-type": "text/plain" },
  });
}
