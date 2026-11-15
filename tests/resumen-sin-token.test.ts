import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/tareas/resumen/route";

describe("GET /api/tareas/resumen sin token", () => {
  it("responde 401 cuando falta la cabecera Authorization", async () => {
    const respuesta = await GET(new Request("http://localhost/api/tareas/resumen"));

    expect(respuesta.status).toBe(401);
    expect(await respuesta.json()).toEqual({ error: "No autorizado" });
  });

  it("responde 401 con un esquema distinto de Bearer", async () => {
    const respuesta = await GET(
      new Request("http://localhost/api/tareas/resumen", {
        headers: { authorization: "Basic dXN1YXJpbzpjbGF2ZQ==" },
      }),
    );

    expect(respuesta.status).toBe(401);
    expect(await respuesta.json()).toEqual({ error: "No autorizado" });
  });
});
