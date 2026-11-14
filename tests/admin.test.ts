import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { respuestaError } from "@/src/lib/respuestas";
import { esAdmin, asignarRolAdmin } from "@/src/lib/roles";
import { setCustomUserClaims } from "@/src/lib/usuarios-auth";

const sdk = vi.hoisted(() => ({ setCustomUserClaims: vi.fn() }));

vi.mock("@/src/lib/firebase", () => ({
  getAuthAdmin: () => ({ setCustomUserClaims: sdk.setCustomUserClaims }),
}));

function rutaAdminSimulada(claims: unknown): NextResponse {
  if (!esAdmin(claims)) return respuestaError(403, "Prohibido");
  return NextResponse.json({ ok: true });
}

describe("rol admin", () => {
  beforeEach(() => {
    sdk.setCustomUserClaims.mockReset();
    sdk.setCustomUserClaims.mockResolvedValue(undefined);
  });

  it("reconoce solo el claim exacto rol=admin", () => {
    expect(esAdmin({ rol: "admin" })).toBe(true);
    expect(esAdmin({ rol: "usuario" })).toBe(false);
    expect(esAdmin({})).toBe(false);
    expect(esAdmin(null)).toBe(false);
  });

  it("asigna el claim mediante setCustomUserClaims", async () => {
    await asignarRolAdmin("uid-1");

    expect(sdk.setCustomUserClaims).toHaveBeenCalledWith("uid-1", { rol: "admin" });
  });

  it("expone la primitiva sin endpoint HTTP", async () => {
    await setCustomUserClaims("uid-1", { rol: "editor" });

    expect(sdk.setCustomUserClaims).toHaveBeenCalledWith("uid-1", { rol: "editor" });
  });

  it("una ruta de administración simulada responde 403 sin el claim", async () => {
    const respuesta = rutaAdminSimulada({ rol: "usuario" });

    expect(respuesta.status).toBe(403);
    expect(await respuesta.json()).toEqual({ error: "Prohibido" });
  });

  it("una ruta de administración simulada permite el claim admin", () => {
    const respuesta = rutaAdminSimulada({ rol: "admin" });

    expect(respuesta.status).toBe(200);
  });
});
