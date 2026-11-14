import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  borrarDocumentoTarea,
  guardarDocumentoTarea,
  listarDocumentosTarea,
  obtenerDocumentoTarea,
} from "@/src/lib/tareas-firestore";
import type { TareaGuardada } from "@/src/tipos/tarea";
import { reiniciarFirestoreFalso, sembrarDocumentoFalso } from "./ayuda/firestore-sdk-falso";

vi.mock("@/src/lib/firebase", async () => {
  const { dbFalsa } = await import("./ayuda/firestore-sdk-falso");
  return { getDb: () => dbFalsa };
});

const tarea: TareaGuardada = {
  titulo: "Tarea de prueba",
  descripcion: null,
  prioridad: 1,
  vence_en: "2026-11-01",
  completada: false,
  created_at: "2026-11-01T10:00:00.000Z",
  updated_at: "2026-11-01T10:00:00.000Z",
  deleted_at: null,
};

describe("adaptador de Firestore", () => {
  beforeEach(() => {
    reiniciarFirestoreFalso();
  });

  it("lista documentos ordenados y respeta since y el límite", async () => {
    sembrarDocumentoFalso("ana", "vieja", { ...tarea, updated_at: "2026-11-01T09:00:00.000Z" });
    sembrarDocumentoFalso("ana", "nueva", { ...tarea, updated_at: "2026-11-01T11:00:00.000Z" });

    const todas = await listarDocumentosTarea("ana", null, 500);
    const filtradas = await listarDocumentosTarea("ana", "2026-11-01T10:00:00.000Z", 1);

    expect(todas.map((documento) => documento.id)).toEqual(["vieja", "nueva"]);
    expect(filtradas.map((documento) => documento.id)).toEqual(["nueva"]);
    expect(filtradas[0]?.datos).toMatchObject({ titulo: tarea.titulo });
  });

  it("obtiene un documento existente y devuelve null si no existe", async () => {
    sembrarDocumentoFalso("ana", "t1", tarea);

    expect(await obtenerDocumentoTarea("ana", "t1")).toMatchObject({ id: "t1" });
    expect(await obtenerDocumentoTarea("ana", "fantasma")).toBeNull();
  });

  it("guarda y borra documentos en la colección del uid", async () => {
    await guardarDocumentoTarea("ana", "t1", tarea);
    await borrarDocumentoTarea("ana", "t1", { ...tarea, deleted_at: "2026-11-02T00:00:00.000Z" });

    const documento = await obtenerDocumentoTarea("ana", "t1");

    expect(documento?.datos).toMatchObject({ deleted_at: "2026-11-02T00:00:00.000Z" });
    expect(await obtenerDocumentoTarea("beto", "t1")).toBeNull();
  });
});
