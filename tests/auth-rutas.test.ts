import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { POST as registrar } from "@/app/api/auth/registro/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as refresh } from "@/app/api/auth/refresh/route";
import { GET as yo } from "@/app/api/auth/yo/route";
import { respuestaJson } from "./ayuda/fetch-falso";

const sdk = vi.hoisted(() => ({
  fetch: vi.fn(),
  getUser: vi.fn(),
  verificarToken: vi.fn(),
}));

vi.mock("@/src/lib/auth", () => ({
  verificarToken: sdk.verificarToken,
}));

vi.mock("@/src/lib/firebase", () => ({
  getAuthAdmin: () => ({ getUser: sdk.getUser }),
}));

function peticion(cuerpo?: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/auth", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
}

function peticionCruda(cuerpo: string): Request {
  return new Request("http://localhost/api/auth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: cuerpo,
  });
}

async function cuerpoDe(respuesta: Response): Promise<Record<string, unknown>> {
  return (await respuesta.json()) as Record<string, unknown>;
}

function respuestaSesionFirebase() {
  return respuestaJson({
    idToken: "id",
    refreshToken: "refresh",
    expiresIn: "3600",
    localId: "uid-1",
    email: "ana@example.com",
  });
}

beforeEach(() => {
  sdk.fetch.mockReset();
  sdk.getUser.mockReset();
  sdk.verificarToken.mockReset();
  vi.stubGlobal("fetch", sdk.fetch);
  vi.stubEnv("FIREBASE_WEB_API_KEY", "clave-de-prueba");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("POST /api/auth/registro: éxito", () => {
  it("responde 201 con la forma del contrato y no-store", async () => {
    sdk.fetch.mockResolvedValue(respuestaSesionFirebase());

    const respuesta = await registrar(peticion({ email: "ana@example.com", password: "secreta1" }));
    const cuerpo = await cuerpoDe(respuesta);

    expect(respuesta.status).toBe(201);
    expect(cuerpo).toEqual({
      token: "id",
      refreshToken: "refresh",
      expiraEnSeg: 3600,
      usuario: { id: "uid-1", email: "ana@example.com" },
    });
    expect(typeof cuerpo.expiraEnSeg).toBe("number");
    expect(respuesta.headers.get("cache-control")).toBe("no-store");
  });

  it("responde 409 con no-store si el correo ya existe", async () => {
    sdk.fetch.mockResolvedValue(respuestaJson({ error: { message: "EMAIL_EXISTS" } }, 400));

    const respuesta = await registrar(peticion({ email: "ana@example.com", password: "secreta1" }));

    expect(respuesta.status).toBe(409);
    expect(await cuerpoDe(respuesta)).toEqual({ error: "El correo ya está registrado" });
    expect(respuesta.headers.get("cache-control")).toBe("no-store");
  });
});

describe("POST /api/auth/registro: validación de entrada", () => {
  it("responde 400 de Zod sin llamar a fetch", async () => {
    const respuesta = await registrar(peticion({ email: "no-es-correo", password: "corta" }));
    const cuerpo = await cuerpoDe(respuesta);

    expect(respuesta.status).toBe(400);
    expect(cuerpo.error).toBe("Datos inválidos");
    expect(cuerpo.detalles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ campo: "email" }),
        expect.objectContaining({ campo: "password" }),
      ]),
    );
    expect(sdk.fetch).not.toHaveBeenCalled();
    expect(respuesta.headers.get("cache-control")).toBe("no-store");
  });

  it("responde 400 si el cuerpo no es JSON", async () => {
    const respuesta = await registrar(peticionCruda("no-json"));

    expect(respuesta.status).toBe(400);
    expect(await cuerpoDe(respuesta)).toEqual({
      error: "Cuerpo inválido",
      detalles: [{ campo: "(cuerpo)", mensaje: "Debe ser JSON válido" }],
    });
    expect(sdk.fetch).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/registro: errores de Firebase", () => {
  it("responde 400 con detalle genérico para WEAK_PASSWORD", async () => {
    sdk.fetch.mockResolvedValue(respuestaJson({ error: { message: "WEAK_PASSWORD" } }, 400));

    const respuesta = await registrar(peticion({ email: "ana@example.com", password: "secreta1" }));
    const cuerpo = await cuerpoDe(respuesta);

    expect(respuesta.status).toBe(400);
    expect(cuerpo).toMatchObject({
      error: "La contraseña no cumple los requisitos",
      detalles: [
        {
          campo: "password",
          mensaje: "La contraseña no cumple los requisitos de seguridad",
        },
      ],
    });
    expect(JSON.stringify(cuerpo)).not.toContain("8 caracteres");
  });

  it("responde 429 con no-store", async () => {
    sdk.fetch.mockResolvedValue(
      respuestaJson({ error: { message: "TOO_MANY_ATTEMPTS_TRY_LATER" } }, 400),
    );

    const respuesta = await registrar(peticion({ email: "ana@example.com", password: "secreta1" }));

    expect(respuesta.status).toBe(429);
    expect(await cuerpoDe(respuesta)).toEqual({
      error: "Demasiados intentos. Inténtalo más tarde",
    });
    expect(respuesta.headers.get("cache-control")).toBe("no-store");
  });
});

describe("POST /api/auth/login", () => {
  it("responde 401 con el mismo mensaje para credenciales inválidas", async () => {
    sdk.fetch.mockResolvedValueOnce(
      respuestaJson({ error: { message: "INVALID_LOGIN_CREDENTIALS" } }, 400),
    );
    const existente = await login(peticion({ email: "ana@example.com", password: "secreta1" }));

    sdk.fetch.mockResolvedValueOnce(respuestaJson({ error: { message: "EMAIL_NOT_FOUND" } }, 400));
    const inexistente = await login(peticion({ email: "otro@example.com", password: "secreta1" }));

    expect(existente.status).toBe(401);
    expect(inexistente.status).toBe(401);
    expect(await cuerpoDe(existente)).toEqual({ error: "Credenciales inválidas" });
    expect(await cuerpoDe(inexistente)).toEqual({ error: "Credenciales inválidas" });
    expect(existente.headers.get("cache-control")).toBe("no-store");
    expect(inexistente.headers.get("cache-control")).toBe("no-store");
  });

  it("responde 200 con sesión y no-store", async () => {
    sdk.fetch.mockResolvedValue(respuestaSesionFirebase());

    const respuesta = await login(peticion({ email: "ana@example.com", password: "secreta1" }));

    expect(respuesta.status).toBe(200);
    expect(await cuerpoDe(respuesta)).toMatchObject({ token: "id", expiraEnSeg: 3600 });
    expect(respuesta.headers.get("cache-control")).toBe("no-store");
  });
});

describe("POST /api/auth/refresh: éxito", () => {
  it("usa formulario, grant_type y no-store", async () => {
    sdk.fetch.mockResolvedValue(
      respuestaJson({ id_token: "nuevo", refresh_token: "rotado", expires_in: "1800" }),
    );

    const respuesta = await refresh(peticion({ refreshToken: "refresh-original" }));

    expect(respuesta.status).toBe(200);
    expect(await cuerpoDe(respuesta)).toEqual({
      token: "nuevo",
      refreshToken: "rotado",
      expiraEnSeg: 1800,
    });
    expect(respuesta.headers.get("cache-control")).toBe("no-store");

    const init = sdk.fetch.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(init.headers).get("content-type")).toBe("application/x-www-form-urlencoded");
    const parametros = new URLSearchParams(String(init.body));
    expect(parametros.get("grant_type")).toBe("refresh_token");
    expect(parametros.get("refresh_token")).toBe("refresh-original");
  });

  it("reutiliza el refresh recibido si no hay uno rotado", async () => {
    sdk.fetch.mockResolvedValue(respuestaJson({ id_token: "nuevo", expires_in: "1800" }));

    const respuesta = await refresh(peticion({ refreshToken: "refresh-original" }));

    expect(await cuerpoDe(respuesta)).toEqual({
      token: "nuevo",
      refreshToken: "refresh-original",
      expiraEnSeg: 1800,
    });
  });
});

describe("POST /api/auth/refresh: errores", () => {
  it("responde 401 con no-store si el refresh es inválido", async () => {
    sdk.fetch.mockResolvedValue(
      respuestaJson({ error: { message: "INVALID_REFRESH_TOKEN" } }, 400),
    );

    const respuesta = await refresh(peticion({ refreshToken: "vencido" }));

    expect(respuesta.status).toBe(401);
    expect(await cuerpoDe(respuesta)).toEqual({ error: "Sesión expirada" });
    expect(respuesta.headers.get("cache-control")).toBe("no-store");
  });

  it("responde 400 de Zod sin llamar a fetch", async () => {
    const respuesta = await refresh(peticion({}));

    expect(respuesta.status).toBe(400);
    expect(await cuerpoDe(respuesta)).toMatchObject({
      error: "Datos inválidos",
      detalles: [expect.objectContaining({ campo: "refreshToken" })],
    });
    expect(sdk.fetch).not.toHaveBeenCalled();
  });
});

describe("GET /api/auth/yo: autorización", () => {
  function peticionYo(): Request {
    return new Request("http://localhost/api/auth/yo", {
      headers: { authorization: "Bearer token" },
    });
  }

  it("responde 401 sin token y con no-store", async () => {
    sdk.verificarToken.mockResolvedValue({
      autorizado: false,
      respuesta: NextResponse.json({ error: "No autorizado" }, { status: 401 }),
    });

    const respuesta = await yo(peticionYo());

    expect(respuesta.status).toBe(401);
    expect(await cuerpoDe(respuesta)).toEqual({ error: "No autorizado" });
    expect(respuesta.headers.get("cache-control")).toBe("no-store");
  });

  it("responde 401 si el usuario ya no existe", async () => {
    sdk.verificarToken.mockResolvedValue({ autorizado: true, uid: "fantasma" });
    sdk.getUser.mockRejectedValue({ code: "auth/user-not-found" });

    const respuesta = await yo(peticionYo());

    expect(respuesta.status).toBe(401);
    expect(await cuerpoDe(respuesta)).toEqual({ error: "No autorizado" });
    expect(respuesta.headers.get("cache-control")).toBe("no-store");
  });
});

describe("GET /api/auth/yo: perfil", () => {
  function peticionYo(): Request {
    return new Request("http://localhost/api/auth/yo", {
      headers: { authorization: "Bearer token" },
    });
  }

  it("responde 200 con el usuario del uid verificado", async () => {
    sdk.verificarToken.mockResolvedValue({ autorizado: true, uid: "uid-1" });
    sdk.getUser.mockResolvedValue({ uid: "uid-1", email: "ana@example.com" });

    const respuesta = await yo(peticionYo());

    expect(respuesta.status).toBe(200);
    expect(await cuerpoDe(respuesta)).toEqual({
      usuario: { id: "uid-1", email: "ana@example.com" },
    });
    expect(respuesta.headers.get("cache-control")).toBe("no-store");
  });

  it("responde 500 sin detalles si falla Admin", async () => {
    sdk.verificarToken.mockResolvedValue({ autorizado: true, uid: "uid-1" });
    sdk.getUser.mockRejectedValue(new Error("fallo de Admin"));

    const respuesta = await yo(peticionYo());

    expect(respuesta.status).toBe(500);
    expect(await cuerpoDe(respuesta)).toEqual({ error: "Error interno" });
    expect(respuesta.headers.get("cache-control")).toBe("no-store");
  });
});
