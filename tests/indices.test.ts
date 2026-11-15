import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type CampoIndice = { fieldPath: string; order: string };

type Indice = {
  collectionGroup: string;
  queryScope: string;
  fields: CampoIndice[];
};

function leerJson(ruta: URL): unknown {
  return JSON.parse(readFileSync(ruta, "utf8"));
}

const indices = leerJson(new URL("../firestore.indexes.json", import.meta.url)) as {
  indexes: Indice[];
};

const configuracion = leerJson(new URL("../firebase.json", import.meta.url)) as {
  firestore?: { indexes?: string };
};

function camposDe(collectionGroup: string, primerCampoDeRango: string): string[] {
  const indice = indices.indexes.find(
    (candidato) =>
      candidato.collectionGroup === collectionGroup &&
      candidato.fields.some((campo) => campo.fieldPath === primerCampoDeRango),
  );

  return indice?.fields.map((campo) => campo.fieldPath) ?? [];
}

describe("índices compuestos de Firestore", () => {
  it("declara exactamente los dos índices del resumen", () => {
    expect(indices.indexes).toHaveLength(2);
  });

  it("usa collectionGroup tarea y queryScope COLLECTION", () => {
    for (const indice of indices.indexes) {
      expect(indice.collectionGroup).toBe("tarea");
      expect(indice.queryScope).toBe("COLLECTION");
    }
  });

  it("indexa vencidas con deleted_at, completada y vence_en en ese orden", () => {
    expect(camposDe("tarea", "vence_en")).toEqual(["deleted_at", "completada", "vence_en"]);
  });

  it("indexa completadas de la semana con deleted_at, completada y completada_en en ese orden", () => {
    expect(camposDe("tarea", "completada_en")).toEqual([
      "deleted_at",
      "completada",
      "completada_en",
    ]);
  });

  it("todos los campos son ascendentes", () => {
    for (const indice of indices.indexes) {
      for (const campo of indice.fields) {
        expect(campo.order).toBe("ASCENDING");
      }
    }
  });

  it("firebase.json apunta a firestore.indexes.json", () => {
    expect(configuracion.firestore?.indexes).toBe("firestore.indexes.json");
  });
});
