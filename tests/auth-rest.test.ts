import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ErrorFirebaseAuth,
  iniciarSesionConEmail,
  registrarConEmail,
  renovarSesionFirebase,
} from "@/src/lib/firebase-auth-rest";
import { ErrorConfiguracionAuth } from "@/src/lib/errores-auth";
import { respuestaJson, respuestaTexto } from "./ayuda/fetch-falso";

const fetchFalso = vi.fn();

function primeraLlamada(): { url: string; init: RequestInit } {
  const llamada = fetchFalso.mock.calls[0];
  if (!llamada) throw new Error("fetch no fue llamado");

  return {
    url: String(llamada[0]),
    init: llamada[1] as RequestInit,
  };
}

beforeEach(() => {
  fetchFalso.mockReset();
  vi.stubGlobal("fetch", fetchFalso);
  vi.stubEnv("FIREBASE_WEB_API_KEY", "clave-de-prueba");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("cliente REST: registro y login", () => {
  it("registra y convierte expiresIn a número", async () => {
    fetchFalso.mockResolvedValue(
      respuestaJson({
        idToken: "id",
        refreshToken: "refresh",
        expiresIn: "3600",
        localId: "uid-1",
        email: "ana@example.com",
      }),
    );

    const sesion = await registrarConEmail("ana@example.com", "secreta1");

    expect(sesion).toEqual({
      token: "id",
      refreshToken: "refresh",
      expiraEnSeg: 3600,
      uid: "uid-1",
      email: "ana@example.com",
    });

    const { url, init } = primeraLlamada();
    expect(url).toContain("accounts:signUp");
    expect(url).toContain("key=clave-de-prueba");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toMatchObject({
      email: "ana@example.com",
      password: "secreta1",
      returnSecureToken: true,
    });
  });

  it("inicia sesión contra signInWithPassword", async () => {
    fetchFalso.mockResolvedValue(
      respuestaJson({
        idToken: "id",
        refreshToken: "refresh",
        expiresIn: "3600",
        localId: "uid-1",
        email: "ana@example.com",
      }),
    );

    await iniciarSesionConEmail("ana@example.com", "secreta1");

    expect(primeraLlamada().url).toContain("accounts:signInWithPassword");
  });
});

describe("cliente REST: refresh", () => {
  it("renueva con formulario y grant_type=refresh_token", async () => {
    fetchFalso.mockResolvedValue(
      respuestaJson({ id_token: "nuevo", refresh_token: "rotado", expires_in: "1800" }),
    );

    const sesion = await renovarSesionFirebase("refresh-original");

    expect(sesion).toEqual({
      token: "nuevo",
      refreshToken: "rotado",
      expiraEnSeg: 1800,
    });

    const { url, init } = primeraLlamada();
    expect(url).toContain("securetoken.googleapis.com");
    expect(new Headers(init.headers).get("content-type")).toBe("application/x-www-form-urlencoded");

    const parametros = new URLSearchParams(String(init.body));
    expect(parametros.get("grant_type")).toBe("refresh_token");
    expect(parametros.get("refresh_token")).toBe("refresh-original");
  });

  it("reutiliza el refresh recibido si Firebase no devuelve uno rotado", async () => {
    fetchFalso.mockResolvedValue(respuestaJson({ id_token: "nuevo", expires_in: "1800" }));

    const sesion = await renovarSesionFirebase("refresh-original");

    expect(sesion.refreshToken).toBe("refresh-original");
  });
});

describe("cliente REST: errores", () => {
  it("expone solo el código de error normalizado", async () => {
    fetchFalso.mockResolvedValue(
      respuestaJson({ error: { message: "EMAIL_EXISTS", email: "ana@example.com" } }, 400),
    );

    await expect(registrarConEmail("ana@example.com", "secreta1")).rejects.toMatchObject({
      codigo: "EMAIL_EXISTS",
    });
  });

  it("no propaga mensajes desconocidos ni respuestas crudas", async () => {
    fetchFalso.mockResolvedValue(respuestaJson({ error: { message: "<script>" } }, 400));

    const error = await registrarConEmail("ana@example.com", "secreta1").catch(
      (fallo: unknown) => fallo,
    );

    expect(error).toBeInstanceOf(ErrorFirebaseAuth);
    expect(error).toMatchObject({ codigo: "DESCONOCIDO" });
    expect(String(error)).not.toContain("<script>");
  });

  it("convierte fallos de red y JSON inválido en códigos internos", async () => {
    fetchFalso.mockRejectedValueOnce(new Error("sin red"));
    await expect(registrarConEmail("ana@example.com", "secreta1")).rejects.toMatchObject({
      codigo: "RED",
    });

    fetchFalso.mockResolvedValueOnce(respuestaTexto());
    await expect(registrarConEmail("ana@example.com", "secreta1")).rejects.toMatchObject({
      codigo: "RESPUESTA_INVALIDA",
    });
  });
});

describe("cliente REST: respuestas inválidas", () => {
  it("rechaza respuestas con expiración inválida", async () => {
    fetchFalso.mockResolvedValue(
      respuestaJson({
        idToken: "id",
        refreshToken: "refresh",
        expiresIn: "cero",
        localId: "uid-1",
        email: "ana@example.com",
      }),
    );

    await expect(registrarConEmail("ana@example.com", "secreta1")).rejects.toMatchObject({
      codigo: "RESPUESTA_INVALIDA",
    });
  });
});

describe("cliente REST: configuración", () => {
  it("importar sin clave no lanza; usarla falla sin llamar a fetch", async () => {
    vi.stubEnv("FIREBASE_WEB_API_KEY", "");

    await expect(import("@/src/lib/firebase-auth-rest")).resolves.toBeDefined();
    await expect(registrarConEmail("ana@example.com", "secreta1")).rejects.toBeInstanceOf(
      ErrorConfiguracionAuth,
    );
    expect(fetchFalso).not.toHaveBeenCalled();
  });
});
