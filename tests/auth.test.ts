import { beforeEach, describe, expect, it, vi } from "vitest";
import { verificarToken } from "@/src/lib/auth";

const sdk = vi.hoisted(() => ({ verifyIdToken: vi.fn() }));

vi.mock("@/src/lib/firebase", () => ({
  getAuthAdmin: () => ({ verifyIdToken: sdk.verifyIdToken }),
}));

function peticion(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/tareas", { headers });
}

async function esperarNoAutorizado(resultado: Awaited<ReturnType<typeof verificarToken>>) {
  if (resultado.autorizado) throw new Error("Se esperaba una respuesta no autorizada");

  const cuerpo: unknown = await resultado.respuesta.json();
  expect(resultado.respuesta.status).toBe(401);
  expect(cuerpo).toEqual({ error: "No autorizado" });
}

describe("verificarToken", () => {
  beforeEach(() => {
    sdk.verifyIdToken.mockReset();
  });

  it("devuelve 401 sin header Authorization", async () => {
    await esperarNoAutorizado(await verificarToken(peticion()));
  });

  it("devuelve 401 si el esquema no es Bearer", async () => {
    await esperarNoAutorizado(await verificarToken(peticion({ authorization: "Basic abc" })));
  });

  it("devuelve 401 con el mismo mensaje si el token es inválido", async () => {
    sdk.verifyIdToken.mockRejectedValue(new Error("token inválido"));

    await esperarNoAutorizado(
      await verificarToken(peticion({ authorization: "Bearer token-invalido" })),
    );
  });

  it("devuelve el uid del token verificado", async () => {
    sdk.verifyIdToken.mockResolvedValue({ uid: "ana" });

    const resultado = await verificarToken(peticion({ authorization: "Bearer token-valido" }));

    expect(resultado).toEqual({ autorizado: true, uid: "ana" });
    expect(sdk.verifyIdToken).toHaveBeenCalledWith("token-valido");
  });

  it("devuelve 401 si el token verificado no trae uid", async () => {
    sdk.verifyIdToken.mockResolvedValue({});

    await esperarNoAutorizado(
      await verificarToken(peticion({ authorization: "Bearer token-sin-uid" })),
    );
  });
});
