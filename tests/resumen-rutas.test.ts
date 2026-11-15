import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/tareas/resumen/route";
import type { TareaGuardada } from "@/src/tipos/tarea";
import {
  configurarFalloConteo,
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

const HOY = new Date().toISOString();
const HACE_OCHO_DIAS = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
const FUTURO = "2999-01-01T00:00:00.000Z";
const PASADO = "2020-01-01T00:00:00.000Z";

const tareaBase: TareaGuardada = {
  titulo: "Tarea de prueba",
  descripcion: null,
  prioridad: 2,
  vence_en: null,
  completada: false,
  created_at: "2026-11-01T10:00:00.000Z",
  updated_at: "2026-11-01T10:00:00.000Z",
  deleted_at: null,
  completada_en: null,
};

function peticion(url = "http://localhost/api/tareas/resumen"): Request {
  return new Request(url, {
    method: "GET",
    headers: { authorization: "Bearer token" },
  });
}

async function cuerpoJson(respuesta: Response): Promise<Record<string, unknown>> {
  return respuesta.json();
}

function sembrarMezcla(uid: string): void {
  sembrarTareaFalsa(uid, "pendiente-futura", { ...tareaBase, vence_en: FUTURO });
  sembrarTareaFalsa(uid, "pendiente-vencida", { ...tareaBase, vence_en: PASADO });
  sembrarTareaFalsa(uid, "pendiente-sin-fecha", { ...tareaBase, vence_en: null });
  sembrarTareaFalsa(uid, "completada-semana", {
    ...tareaBase,
    completada: true,
    completada_en: HOY,
  });
  sembrarTareaFalsa(uid, "completada-vieja", {
    ...tareaBase,
    completada: true,
    completada_en: HACE_OCHO_DIAS,
  });
  sembrarTareaFalsa(uid, "completada-legada", {
    ...tareaBase,
    completada: true,
    completada_en: null,
  });
  sembrarTareaFalsa(uid, "borrada-pendiente", {
    ...tareaBase,
    vence_en: PASADO,
    deleted_at: HOY,
  });
  sembrarTareaFalsa(uid, "borrada-completada", {
    ...tareaBase,
    completada: true,
    completada_en: HOY,
    deleted_at: HOY,
  });
}

function sembrarBorrados(uid: string): void {
  sembrarTareaFalsa(uid, "borrada-pendiente", {
    ...tareaBase,
    vence_en: PASADO,
    deleted_at: HOY,
  });
  sembrarTareaFalsa(uid, "borrada-completada", {
    ...tareaBase,
    completada: true,
    completada_en: HOY,
    deleted_at: HOY,
  });
}

describe("GET /api/tareas/resumen: autenticación y forma", () => {
  beforeEach(() => {
    sesion.uid = "ana";
    reiniciarTareasFalsas();
  });

  it("responde 401 con token no verificable", async () => {
    sesion.uid = null;

    const respuesta = await GET(peticion());

    expect(respuesta.status).toBe(401);
    expect(await cuerpoJson(respuesta)).toEqual({ error: "No autorizado" });
  });

  it("devuelve ceros para un usuario sin tareas", async () => {
    const respuesta = await GET(peticion());

    expect(respuesta.status).toBe(200);
    expect(await cuerpoJson(respuesta)).toEqual({
      pendientes: 0,
      vencidas: 0,
      completadas_semana: 0,
    });
  });

  it("responde con cache-control no-store", async () => {
    const respuesta = await GET(peticion());

    expect(respuesta.headers.get("cache-control")).toBe("no-store");
  });
});

describe("GET /api/tareas/resumen: conteos", () => {
  beforeEach(() => {
    sesion.uid = "ana";
    reiniciarTareasFalsas();
  });

  it("cuenta pendientes, vencidas y completadas de la semana", async () => {
    sembrarMezcla("ana");

    const respuesta = await GET(peticion());
    const cuerpo = await cuerpoJson(respuesta);

    expect(respuesta.status).toBe(200);
    expect(cuerpo).toEqual({ pendientes: 3, vencidas: 1, completadas_semana: 1 });
    expect(Number.isInteger(cuerpo.pendientes)).toBe(true);
    expect(Number.isInteger(cuerpo.vencidas)).toBe(true);
    expect(Number.isInteger(cuerpo.completadas_semana)).toBe(true);
  });

  it("excluye los documentos con borrado lógico de las tres métricas", async () => {
    sembrarBorrados("ana");

    const respuesta = await GET(peticion());

    expect(await cuerpoJson(respuesta)).toEqual({
      pendientes: 0,
      vencidas: 0,
      completadas_semana: 0,
    });
  });

  it("aísla los conteos entre usuarios", async () => {
    sembrarMezcla("ana");
    sembrarMezcla("beto");

    const respuesta = await GET(peticion());

    expect(await cuerpoJson(respuesta)).toEqual({
      pendientes: 3,
      vencidas: 1,
      completadas_semana: 1,
    });
  });
});

describe("GET /api/tareas/resumen: errores", () => {
  beforeEach(() => {
    sesion.uid = "ana";
    reiniciarTareasFalsas();
  });

  it("responde 500 sin detalles si falla el conteo", async () => {
    configurarFalloConteo(true);

    const respuesta = await GET(peticion());
    const cuerpo = await cuerpoJson(respuesta);

    expect(respuesta.status).toBe(500);
    expect(cuerpo).toEqual({ error: "Error interno" });
  });
});
