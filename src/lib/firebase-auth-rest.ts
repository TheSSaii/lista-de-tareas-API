import { z } from "zod";
import { ErrorConfiguracionAuth } from "./errores-auth";

const URL_IDENTITY = "https://identitytoolkit.googleapis.com/v1/accounts";
const URL_SECURE_TOKEN = "https://securetoken.googleapis.com/v1/token";
const TIEMPO_LIMITE_MS = 10_000;

const esquemaSesion = z
  .object({
    idToken: z.string().min(1),
    refreshToken: z.string().min(1),
    expiresIn: z.coerce.number().int().positive(),
    localId: z.string().min(1),
    email: z.email(),
  })
  .strip();

const esquemaRefresh = z
  .object({
    id_token: z.string().min(1),
    refresh_token: z.string().min(1).optional(),
    expires_in: z.coerce.number().int().positive(),
  })
  .strip();

export type SesionFirebase = {
  token: string;
  refreshToken: string;
  expiraEnSeg: number;
  uid: string;
  email: string;
};

export type SesionRenovadaFirebase = {
  token: string;
  refreshToken: string;
  expiraEnSeg: number;
};

export class ErrorFirebaseAuth extends Error {
  readonly codigo: string;

  constructor(codigo: string) {
    super(codigo);
    this.name = "ErrorFirebaseAuth";
    this.codigo = codigo;
  }
}

function leerApiKeyWeb(): string {
  const clave = process.env.FIREBASE_WEB_API_KEY?.trim();
  if (!clave) throw new ErrorConfiguracionAuth();
  return clave;
}

function urlIdentity(operacion: string): string {
  return `${URL_IDENTITY}:${operacion}?key=${encodeURIComponent(leerApiKeyWeb())}`;
}

function urlSecureToken(): string {
  return `${URL_SECURE_TOKEN}?key=${encodeURIComponent(leerApiKeyWeb())}`;
}

function extraerCodigo(datos: unknown): string {
  if (typeof datos !== "object" || datos === null || !("error" in datos)) {
    return "DESCONOCIDO";
  }

  const error = datos.error;
  if (typeof error !== "object" || error === null || !("message" in error)) {
    return "DESCONOCIDO";
  }

  const mensaje = error.message;
  if (typeof mensaje !== "string" || !/^[A-Z0-9_]{1,64}$/.test(mensaje)) {
    return "DESCONOCIDO";
  }

  return mensaje;
}

async function leerJson(respuesta: Response): Promise<unknown> {
  try {
    return await respuesta.json();
  } catch {
    throw new ErrorFirebaseAuth("RESPUESTA_INVALIDA");
  }
}

async function solicitar(url: string, init: RequestInit): Promise<unknown> {
  let respuesta: Response;

  try {
    respuesta = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(TIEMPO_LIMITE_MS),
    });
  } catch {
    throw new ErrorFirebaseAuth("RED");
  }

  const datos = await leerJson(respuesta);
  if (!respuesta.ok) throw new ErrorFirebaseAuth(extraerCodigo(datos));
  return datos;
}

function interpretarSesion(datos: unknown): SesionFirebase {
  const resultado = esquemaSesion.safeParse(datos);
  if (!resultado.success) throw new ErrorFirebaseAuth("RESPUESTA_INVALIDA");

  return {
    token: resultado.data.idToken,
    refreshToken: resultado.data.refreshToken,
    expiraEnSeg: resultado.data.expiresIn,
    uid: resultado.data.localId,
    email: resultado.data.email,
  };
}

export async function registrarConEmail(email: string, password: string): Promise<SesionFirebase> {
  const datos = await solicitar(urlIdentity("signUp"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });

  return interpretarSesion(datos);
}

export async function iniciarSesionConEmail(
  email: string,
  password: string,
): Promise<SesionFirebase> {
  const datos = await solicitar(urlIdentity("signInWithPassword"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });

  return interpretarSesion(datos);
}

export async function renovarSesionFirebase(refreshToken: string): Promise<SesionRenovadaFirebase> {
  const cuerpo = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const datos = await solicitar(urlSecureToken(), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: cuerpo.toString(),
  });

  const resultado = esquemaRefresh.safeParse(datos);
  if (!resultado.success) throw new ErrorFirebaseAuth("RESPUESTA_INVALIDA");

  return {
    token: resultado.data.id_token,
    refreshToken: resultado.data.refresh_token ?? refreshToken,
    expiraEnSeg: resultado.data.expires_in,
  };
}
