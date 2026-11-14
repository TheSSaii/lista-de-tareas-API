import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/tareas/route";
import { DELETE, PUT } from "@/app/api/tareas/[id]/route";
import type { TareaGuardada } from "@/src/tipos/tarea";
import {
  configurarFalloListado,
  leerTareaFalsa,
  reiniciarTareasFalsas,
  sembrarTareaFalsa,
} from "./ayuda/tareas-falsas";

const sesion = vi.hoisted(() => ({ uid: "ana" as string | null }));

vi.mock("@/src/lib/auth", async () => {
  const { NextResponse } = await import("next/server");

  return {
    verificarToken: async () => {
      if (sesion.uid === null) {
        return {
          autorizado: false,
          respuesta: NextResponse.json({ error: "No autorizado" }, { status: 401 }),
        };
      }

      return { autorizado: true, uid: sesion.uid };
    },
  };
});

vi.mock("@/src/lib/tareas-firestore", () => import("./ayuda/tareas-falsas"));

const camposBase = {
  titulo: "Entregar informe",
  descripcion: "Revisar bibliografía",
  prioridad: 2 as const,
  vence_en: "2026-11-01T15:04:05.000Z",
  completada: false,
};

const tareaBase: TareaGuardada = {
  ...camposBase,
  created_at: "2026-11-01T10:00:00.000Z",
  updated_at: "2026-11-01T10:00:00.000Z",
  deleted_at: null,
};

function contexto(id: string) {
  return { params: Promise.resolve({ id }) };
}

function peticion(metodo: string, url: string, cuerpo?: unknown): Request {
  return new Request(url, {
    method: metodo,
    headers: { "content-type": "application/json", authorization: "Bearer token" },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
}

async function cuerpoJson(respuesta: Response): Promise<Record<string, unknown>> {
  return respuesta.json();
}

describe("GET /api/tareas", () => {
  beforeEach(() => {
    sesion.uid = "ana";
    reiniciarTareasFalsas();
  });

  it("devuelve 401 sin token", async () => {
    sesion.uid = null;

    const respuesta = await GET(peticion("GET", "http://localhost/api/tareas"));

    expect(respuesta.status).toBe(401);
    expect(await cuerpoJson(respuesta)).toEqual({ error: "No autorizado" });
  });

  it("devuelve items con id y servidor_ahora", async () => {
    sembrarTareaFalsa("ana", "t1", tareaBase);

    const respuesta = await GET(peticion("GET", "http://localhost/api/tareas"));
    const cuerpo = await cuerpoJson(respuesta);

    expect(respuesta.status).toBe(200);
    expect(cuerpo.servidor_ahora).toEqual(expect.any(String));
    expect(cuerpo.items).toEqual([{ id: "t1", ...tareaBase }]);
  });

  it("aísla los datos entre usuarios", async () => {
    sembrarTareaFalsa("ana", "t1", tareaBase);
    sembrarTareaFalsa("beto", "t2", { ...tareaBase, titulo: "Tarea de otro usuario" });

    const respuesta = await GET(peticion("GET", "http://localhost/api/tareas"));
    const cuerpo = await cuerpoJson(respuesta);

    expect(cuerpo.items).toEqual([{ id: "t1", ...tareaBase }]);
    expect(leerTareaFalsa("beto", "t2")).not.toBeNull();
  });
});

describe("GET /api/tareas: sincronización", () => {
  beforeEach(() => {
    sesion.uid = "ana";
    reiniciarTareasFalsas();
  });

  it("filtra con since y valida su formato", async () => {
    sembrarTareaFalsa("ana", "vieja", {
      ...tareaBase,
      updated_at: "2026-11-01T09:00:00.000Z",
    });
    sembrarTareaFalsa("ana", "nueva", {
      ...tareaBase,
      updated_at: "2026-11-01T11:00:00.000Z",
    });

    const respuesta = await GET(
      peticion("GET", "http://localhost/api/tareas?since=2026-11-01T10:00:00.000Z"),
    );
    const cuerpo = await cuerpoJson(respuesta);

    expect(cuerpo.items).toEqual([
      { id: "nueva", ...tareaBase, updated_at: "2026-11-01T11:00:00.000Z" },
    ]);

    const invalida = await GET(peticion("GET", "http://localhost/api/tareas?since=ayer"));

    expect(invalida.status).toBe(400);
    expect(await cuerpoJson(invalida)).toMatchObject({ error: "Parámetro inválido" });
  });

  it("responde 500 sin detalles si falla el almacenamiento", async () => {
    configurarFalloListado(true);

    const respuesta = await GET(peticion("GET", "http://localhost/api/tareas"));
    const cuerpo = await cuerpoJson(respuesta);

    expect(respuesta.status).toBe(500);
    expect(cuerpo).toEqual({ error: "Error interno" });
  });
});

describe("PUT /api/tareas/[id]", () => {
  beforeEach(() => {
    sesion.uid = "ana";
    reiniciarTareasFalsas();
  });

  it("responde 401 sin token", async () => {
    sesion.uid = null;

    const respuesta = await PUT(
      peticion("PUT", "http://localhost/api/tareas/t1", tareaBase),
      contexto("t1"),
    );

    expect(respuesta.status).toBe(401);
    expect(await cuerpoJson(respuesta)).toEqual({ error: "No autorizado" });
  });

  it("responde 400 con detalles por cuerpo inválido", async () => {
    const respuesta = await PUT(
      peticion("PUT", "http://localhost/api/tareas/t1", {
        titulo: "ab",
        prioridad: 9,
        vence_en: "01/11/2026",
      }),
      contexto("t1"),
    );
    const cuerpo = await cuerpoJson(respuesta);

    expect(respuesta.status).toBe(400);
    expect(cuerpo.error).toBe("Datos inválidos");
    expect(cuerpo.detalles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ campo: "titulo" }),
        expect.objectContaining({ campo: "prioridad" }),
        expect.objectContaining({ campo: "vence_en" }),
      ]),
    );
  });
});

describe("PUT /api/tareas/[id]: upsert idempotente", () => {
  beforeEach(() => {
    sesion.uid = "ana";
    reiniciarTareasFalsas();
  });

  it("hace upsert idempotente y devuelve el documento completo", async () => {
    const primera = await PUT(
      peticion("PUT", "http://localhost/api/tareas/t1", { ...tareaBase, campo_intruso: true }),
      contexto("t1"),
    );
    const primerCuerpo = await cuerpoJson(primera);

    expect(primera.status).toBe(200);
    expect(primerCuerpo).toMatchObject({ id: "t1", ...camposBase });
    expect(primerCuerpo).not.toHaveProperty("campo_intruso");
    expect(primerCuerpo.created_at).toEqual(expect.any(String));
    expect(primerCuerpo.updated_at).toEqual(expect.any(String));
    expect(primerCuerpo.deleted_at).toBeNull();

    const segunda = await PUT(
      peticion("PUT", "http://localhost/api/tareas/t1", tareaBase),
      contexto("t1"),
    );
    const segundoCuerpo = await cuerpoJson(segunda);

    expect(segundoCuerpo.created_at).toBe(primerCuerpo.created_at);
  });
});

describe("DELETE /api/tareas/[id]", () => {
  beforeEach(() => {
    sesion.uid = "ana";
    reiniciarTareasFalsas();
  });

  it("responde 404 si la tarea no existe", async () => {
    const respuesta = await DELETE(
      peticion("DELETE", "http://localhost/api/tareas/inexistente"),
      contexto("inexistente"),
    );

    expect(respuesta.status).toBe(404);
    expect(await cuerpoJson(respuesta)).toEqual({ error: "No encontrado" });
  });

  it("hace borrado lógico y devuelve { ok: true }", async () => {
    sembrarTareaFalsa("ana", "t1", tareaBase);

    const respuesta = await DELETE(
      peticion("DELETE", "http://localhost/api/tareas/t1"),
      contexto("t1"),
    );

    expect(respuesta.status).toBe(200);
    expect(await cuerpoJson(respuesta)).toEqual({ ok: true });
    expect(leerTareaFalsa("ana", "t1")?.deleted_at).toEqual(expect.any(String));
  });
});
