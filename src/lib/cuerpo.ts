export type CuerpoLeido = { ok: true; valor: unknown } | { ok: false };

export async function leerCuerpoJson(request: Request): Promise<CuerpoLeido> {
  try {
    return { ok: true, valor: await request.json() };
  } catch {
    return { ok: false };
  }
}
