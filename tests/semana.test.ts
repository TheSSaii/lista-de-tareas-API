import { describe, expect, it } from "vitest";
import { inicioDeSemanaUTC } from "@/src/lib/semana";

describe("inicioDeSemanaUTC", () => {
  it("devuelve el lunes 00:00:00.000 UTC de un día entre semana", () => {
    expect(inicioDeSemanaUTC(new Date("2026-11-15T12:00:00.000Z"))).toBe(
      "2026-11-09T00:00:00.000Z",
    );
  });

  it("devuelve el mismo instante si ya es lunes a las 00:00", () => {
    expect(inicioDeSemanaUTC(new Date("2026-11-09T00:00:00.000Z"))).toBe(
      "2026-11-09T00:00:00.000Z",
    );
  });

  it("un domingo a las 23:59 sigue en la semana del lunes anterior", () => {
    expect(inicioDeSemanaUTC(new Date("2026-11-15T23:59:59.999Z"))).toBe(
      "2026-11-09T00:00:00.000Z",
    );
  });

  it("un domingo a las 00:00 sigue en la semana del lunes anterior", () => {
    expect(inicioDeSemanaUTC(new Date("2026-11-15T00:00:00.000Z"))).toBe(
      "2026-11-09T00:00:00.000Z",
    );
  });

  it("cruza el cambio de mes", () => {
    expect(inicioDeSemanaUTC(new Date("2026-12-02T08:00:00.000Z"))).toBe(
      "2026-11-30T00:00:00.000Z",
    );
  });

  it("cruza el cambio de año", () => {
    expect(inicioDeSemanaUTC(new Date("2027-01-01T08:00:00.000Z"))).toBe(
      "2026-12-28T00:00:00.000Z",
    );
  });

  it("no modifica el Date recibido", () => {
    const ahora = new Date("2026-11-15T12:00:00.000Z");

    inicioDeSemanaUTC(ahora);

    expect(ahora.toISOString()).toBe("2026-11-15T12:00:00.000Z");
  });
});
