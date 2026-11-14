import { describe, expect, it } from "vitest";
import { esquemaSince, esquemaTarea } from "@/src/lib/esquema-tarea";

const tareaValida = {
  titulo: "Entregar informe",
  descripcion: "Revisar bibliografía",
  prioridad: 2,
  vence_en: "2026-11-01T15:04:05.000Z",
  completada: false,
};

describe("esquemaTarea", () => {
  it("acepta vence_en con fecha y hora ISO", () => {
    const resultado = esquemaTarea.safeParse(tareaValida);

    expect(resultado.success).toBe(true);
  });

  it("acepta vence_en con solo fecha YYYY-MM-DD", () => {
    const resultado = esquemaTarea.safeParse({ ...tareaValida, vence_en: "2026-11-01" });

    expect(resultado.success).toBe(true);
  });

  it("acepta vence_en nulo", () => {
    const resultado = esquemaTarea.safeParse({ ...tareaValida, vence_en: null });

    expect(resultado.success).toBe(true);
  });

  it("rechaza título corto, prioridad fuera de rango y fecha inválida", () => {
    const resultado = esquemaTarea.safeParse({
      ...tareaValida,
      titulo: "ab",
      prioridad: 4,
      vence_en: "01/11/2026",
    });

    expect(resultado.success).toBe(false);
  });

  it("descarta campos no declarados", () => {
    const resultado = esquemaTarea.safeParse({ ...tareaValida, uid: "intruso", extra: true });

    expect(resultado.success).toBe(true);
    expect(resultado.data).not.toHaveProperty("uid");
    expect(resultado.data).not.toHaveProperty("extra");
  });

  it("aplica valores por defecto a campos opcionales", () => {
    const resultado = esquemaTarea.safeParse({ titulo: "Tarea mínima", prioridad: 1 });

    expect(resultado.success).toBe(true);
    expect(resultado.data).toMatchObject({
      descripcion: null,
      vence_en: null,
      completada: false,
    });
  });
});

describe("esquemaSince", () => {
  it("acepta una fecha ISO", () => {
    expect(esquemaSince.safeParse("2026-11-01T15:04:05.000Z").success).toBe(true);
  });

  it("rechaza texto que no es fecha", () => {
    expect(esquemaSince.safeParse("ayer").success).toBe(false);
  });
});
