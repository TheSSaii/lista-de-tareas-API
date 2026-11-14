import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchFalso = vi.fn();

vi.mock("@/src/lib/firebase", () => {
  throw new Error("Health no debe importar Firebase");
});

import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  beforeEach(() => {
    fetchFalso.mockReset();
    vi.stubGlobal("fetch", fetchFalso);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("responde 200 sin Firebase y con no-store", async () => {
    const respuesta = GET();

    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ ok: true });
    expect(respuesta.headers.get("cache-control")).toBe("no-store");
    expect(fetchFalso).not.toHaveBeenCalled();
  });
});
