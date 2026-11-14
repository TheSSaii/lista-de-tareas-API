import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencias = vi.hoisted(() => ({
  registrarConEmail: vi.fn(),
  iniciarSesionConEmail: vi.fn(),
  renovarSesionFirebase: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@/src/lib/firebase-auth-rest", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/src/lib/firebase-auth-rest")>();
  return {
    ...actual,
    registrarConEmail: dependencias.registrarConEmail,
    iniciarSesionConEmail: dependencias.iniciarSesionConEmail,
    renovarSesionFirebase: dependencias.renovarSesionFirebase,
  };
});

vi.mock("@/src/lib/firebase", () => ({
  getAuthAdmin: () => ({ getUser: dependencias.getUser }),
}));

import { ErrorFirebaseAuth } from "@/src/lib/firebase-auth-rest";
import { ErrorAutenticacion, ErrorConfiguracionAuth } from "@/src/lib/errores-auth";
import {
  iniciarSesion,
  obtenerPerfil,
  registrarUsuario,
  renovarSesion,
} from "@/src/servicios/auth";

const sesionFirebase = {
  token: "id",
  refreshToken: "refresh",
  expiraEnSeg: 3600,
  uid: "uid-1",
  email: "ana@example.com",
};

async function capturar(promesa: Promise<unknown>): Promise<unknown> {
  return promesa.catch((error: unknown) => error);
}

beforeEach(() => {
  dependencias.registrarConEmail.mockReset();
  dependencias.iniciarSesionConEmail.mockReset();
  dependencias.renovarSesionFirebase.mockReset();
  dependencias.getUser.mockReset();
});

describe("servicio: registro", () => {
  it("convierte el registro al contrato de sesión", async () => {
    dependencias.registrarConEmail.mockResolvedValue(sesionFirebase);

    await expect(
      registrarUsuario({ email: "ana@example.com", password: "secreta1" }),
    ).resolves.toEqual({
      token: "id",
      refreshToken: "refresh",
      expiraEnSeg: 3600,
      usuario: { id: "uid-1", email: "ana@example.com" },
    });
  });

  it("mapea correo repetido a 409", async () => {
    dependencias.registrarConEmail.mockRejectedValue(new ErrorFirebaseAuth("EMAIL_EXISTS"));

    const error = await capturar(
      registrarUsuario({ email: "ana@example.com", password: "secreta1" }),
    );

    expect(error).toBeInstanceOf(ErrorAutenticacion);
    expect(error).toMatchObject({ estado: 409, mensaje: "El correo ya está registrado" });
  });

  it("mapea contraseña débil a 400 con detalle genérico", async () => {
    dependencias.registrarConEmail.mockRejectedValue(new ErrorFirebaseAuth("WEAK_PASSWORD"));

    const error = await capturar(
      registrarUsuario({ email: "ana@example.com", password: "secreta1" }),
    );

    expect(error).toBeInstanceOf(ErrorAutenticacion);
    expect(error).toMatchObject({
      estado: 400,
      detalles: [
        {
          campo: "password",
          mensaje: "La contraseña no cumple los requisitos de seguridad",
        },
      ],
    });
    expect(JSON.stringify(error)).not.toContain("8 caracteres");
  });
});

describe("servicio: login", () => {
  it("usa el mismo error para credenciales inválidas exista o no el correo", async () => {
    dependencias.iniciarSesionConEmail.mockRejectedValueOnce(
      new ErrorFirebaseAuth("INVALID_LOGIN_CREDENTIALS"),
    );
    const existente = await capturar(
      iniciarSesion({ email: "ana@example.com", password: "secreta1" }),
    );

    dependencias.iniciarSesionConEmail.mockRejectedValueOnce(
      new ErrorFirebaseAuth("EMAIL_NOT_FOUND"),
    );
    const inexistente = await capturar(
      iniciarSesion({ email: "otro@example.com", password: "secreta1" }),
    );

    expect(existente).toBeInstanceOf(ErrorAutenticacion);
    expect(inexistente).toBeInstanceOf(ErrorAutenticacion);
    expect(existente).toMatchObject({ estado: 401, mensaje: "Credenciales inválidas" });
    expect(inexistente).toMatchObject({ estado: 401, mensaje: "Credenciales inválidas" });
  });

  it("mapea demasiados intentos a 429", async () => {
    dependencias.iniciarSesionConEmail.mockRejectedValue(
      new ErrorFirebaseAuth("TOO_MANY_ATTEMPTS_TRY_LATER"),
    );

    const error = await capturar(iniciarSesion({ email: "ana@example.com", password: "secreta1" }));

    expect(error).toMatchObject({
      estado: 429,
      mensaje: "Demasiados intentos. Inténtalo más tarde",
    });
  });
});

describe("servicio: refresh", () => {
  it("renueva la sesión y mapea un refresh inválido a 401", async () => {
    dependencias.renovarSesionFirebase.mockResolvedValueOnce({
      token: "nuevo",
      refreshToken: "rotado",
      expiraEnSeg: 1800,
    });

    await expect(renovarSesion("refresh")).resolves.toEqual({
      token: "nuevo",
      refreshToken: "rotado",
      expiraEnSeg: 1800,
    });

    dependencias.renovarSesionFirebase.mockRejectedValueOnce(
      new ErrorFirebaseAuth("INVALID_REFRESH_TOKEN"),
    );
    const error = await capturar(renovarSesion("refresh"));

    expect(error).toMatchObject({ estado: 401, mensaje: "Sesión expirada" });
  });

  it("convierte fallos desconocidos y de configuración en 500", async () => {
    dependencias.registrarConEmail.mockRejectedValueOnce(new ErrorFirebaseAuth("OTRO"));
    const desconocido = await capturar(
      registrarUsuario({ email: "ana@example.com", password: "secreta1" }),
    );

    dependencias.registrarConEmail.mockRejectedValueOnce(new ErrorConfiguracionAuth());
    const configuracion = await capturar(
      registrarUsuario({ email: "ana@example.com", password: "secreta1" }),
    );

    expect(desconocido).toMatchObject({ estado: 500, mensaje: "Error interno" });
    expect(configuracion).toMatchObject({ estado: 500, mensaje: "Error interno" });
  });
});

describe("servicio: perfil", () => {
  it("obtiene el perfil y distingue usuario inexistente de fallo de Admin", async () => {
    dependencias.getUser.mockResolvedValueOnce({
      uid: "uid-1",
      email: "ana@example.com",
    });
    await expect(obtenerPerfil("uid-1")).resolves.toEqual({
      usuario: { id: "uid-1", email: "ana@example.com" },
    });

    dependencias.getUser.mockRejectedValueOnce({ code: "auth/user-not-found" });
    await expect(obtenerPerfil("fantasma")).rejects.toMatchObject({
      estado: 401,
      mensaje: "No autorizado",
    });

    dependencias.getUser.mockRejectedValueOnce(new Error("fallo de Admin"));
    await expect(obtenerPerfil("uid-1")).rejects.toMatchObject({
      estado: 500,
      mensaje: "Error interno",
    });
  });
});
