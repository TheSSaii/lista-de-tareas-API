import { beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerResumenTareas } from "@/src/servicios/tareas";
import type { TareaGuardada } from "@/src/tipos/tarea";
import {
  reiniciarTareasFalsas,
  sembrarTareaFalsa,
  sembrarTareaLegada,
} from "./ayuda/tareas-falsas";

vi.mock("@/src/lib/tareas-firestore", () => import("./ayuda/tareas-falsas"));

const AHORA = new Date("2026-11-15T12:00:00.000Z");
const INICIO_SEMANA = "2026-11-09T00:00:00.000Z";
const UN_MS_ANTES_DEL_INICIO = "2026-11-08T23:59:59.999Z";

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

describe("obtenerResumenTareas: semana", () => {
  beforeEach(() => {
    reiniciarTareasFalsas();
  });

  it("cuenta como completada de la semana la que cae justo en el inicio", async () => {
    sembrarTareaFalsa("ana", "borde", {
      ...tareaBase,
      completada: true,
      completada_en: INICIO_SEMANA,
    });

    expect((await obtenerResumenTareas("ana", AHORA)).completadas_semana).toBe(1);
  });

  it("no cuenta la completada un milisegundo antes del inicio de semana", async () => {
    sembrarTareaFalsa("ana", "anterior", {
      ...tareaBase,
      completada: true,
      completada_en: UN_MS_ANTES_DEL_INICIO,
    });

    expect((await obtenerResumenTareas("ana", AHORA)).completadas_semana).toBe(0);
  });

  it("no cuenta la completada sin sello (documento legado)", async () => {
    sembrarTareaLegada("ana", "legado", {
      ...tareaBase,
      completada: true,
      updated_at: "2026-11-10T10:00:00.000Z",
    });

    const resumen = await obtenerResumenTareas("ana", AHORA);

    expect(resumen.completadas_semana).toBe(0);
    expect(resumen.pendientes).toBe(0);
  });
});

describe("obtenerResumenTareas: pendientes y vencidas", () => {
  beforeEach(() => {
    reiniciarTareasFalsas();
  });

  it("devuelve ceros si el usuario no tiene tareas", async () => {
    expect(await obtenerResumenTareas("ana", AHORA)).toEqual({
      pendientes: 0,
      vencidas: 0,
      completadas_semana: 0,
    });
  });

  it("trata el límite de vencidas como exclusivo y excluye las que no tienen fecha", async () => {
    sembrarTareaFalsa("ana", "justo-ahora", {
      ...tareaBase,
      vence_en: AHORA.toISOString(),
    });
    sembrarTareaFalsa("ana", "un-ms-antes", {
      ...tareaBase,
      vence_en: "2026-11-15T11:59:59.999Z",
    });
    sembrarTareaFalsa("ana", "sin-fecha", { ...tareaBase, vence_en: null });

    const resumen = await obtenerResumenTareas("ana", AHORA);

    expect(resumen.pendientes).toBe(3);
    expect(resumen.vencidas).toBe(1);
  });

  it("aísla los conteos por uid", async () => {
    sembrarTareaFalsa("ana", "propia", { ...tareaBase, vence_en: "2026-11-01T00:00:00.000Z" });
    sembrarTareaFalsa("beto", "ajena", { ...tareaBase, vence_en: "2026-11-01T00:00:00.000Z" });

    expect(await obtenerResumenTareas("ana", AHORA)).toEqual({
      pendientes: 1,
      vencidas: 1,
      completadas_semana: 0,
    });
  });
});
