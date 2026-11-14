import type { DetalleError } from "../lib/respuestas";
import type { Credenciales, Sesion, SesionRenovada, Usuario } from "../tipos/auth";
import {
  iniciarSesionConEmail,
  registrarConEmail,
  renovarSesionFirebase,
  ErrorFirebaseAuth,
} from "../lib/firebase-auth-rest";
import { ErrorAutenticacion, ErrorConfiguracionAuth } from "../lib/errores-auth";
import { obtenerUsuarioAuth } from "../lib/usuarios-auth";

type Operacion = "registro" | "login" | "refresh";

type ErrorMapeado = {
  estado: number;
  mensaje: string;
  detalles?: DetalleError[];
};

const CREDENCIALES_INVALIDAS: ErrorMapeado = {
  estado: 401,
  mensaje: "Credenciales inválidas",
};

const ERRORES: Record<Operacion, Partial<Record<string, ErrorMapeado>>> = {
  registro: {
    EMAIL_EXISTS: { estado: 409, mensaje: "El correo ya está registrado" },
    WEAK_PASSWORD: {
      estado: 400,
      mensaje: "La contraseña no cumple los requisitos",
      detalles: [
        {
          campo: "password",
          mensaje: "La contraseña no cumple los requisitos de seguridad",
        },
      ],
    },
    TOO_MANY_ATTEMPTS_TRY_LATER: {
      estado: 429,
      mensaje: "Demasiados intentos. Inténtalo más tarde",
    },
  },
  login: {
    INVALID_LOGIN_CREDENTIALS: CREDENCIALES_INVALIDAS,
    EMAIL_NOT_FOUND: CREDENCIALES_INVALIDAS,
    INVALID_PASSWORD: CREDENCIALES_INVALIDAS,
    INVALID_EMAIL: CREDENCIALES_INVALIDAS,
    USER_DISABLED: CREDENCIALES_INVALIDAS,
    TOO_MANY_ATTEMPTS_TRY_LATER: {
      estado: 429,
      mensaje: "Demasiados intentos. Inténtalo más tarde",
    },
  },
  refresh: {
    INVALID_REFRESH_TOKEN: { estado: 401, mensaje: "Sesión expirada" },
    TOKEN_EXPIRED: { estado: 401, mensaje: "Sesión expirada" },
    INVALID_GRANT: { estado: 401, mensaje: "Sesión expirada" },
  },
};

function fallo(operacion: Operacion, error: unknown): never {
  if (error instanceof ErrorConfiguracionAuth) {
    throw new ErrorAutenticacion(500, "Error interno");
  }

  if (error instanceof ErrorFirebaseAuth) {
    const mapeado = ERRORES[operacion][error.codigo];
    if (mapeado) {
      throw new ErrorAutenticacion(mapeado.estado, mapeado.mensaje, mapeado.detalles);
    }
  }

  throw new ErrorAutenticacion(500, "Error interno");
}

function aSesion(sesion: {
  token: string;
  refreshToken: string;
  expiraEnSeg: number;
  uid: string;
  email: string;
}): Sesion {
  return {
    token: sesion.token,
    refreshToken: sesion.refreshToken,
    expiraEnSeg: sesion.expiraEnSeg,
    usuario: { id: sesion.uid, email: sesion.email },
  };
}

export async function registrarUsuario(datos: Credenciales): Promise<Sesion> {
  try {
    return aSesion(await registrarConEmail(datos.email, datos.password));
  } catch (error) {
    return fallo("registro", error);
  }
}

export async function iniciarSesion(datos: Credenciales): Promise<Sesion> {
  try {
    return aSesion(await iniciarSesionConEmail(datos.email, datos.password));
  } catch (error) {
    return fallo("login", error);
  }
}

export async function renovarSesion(refreshToken: string): Promise<SesionRenovada> {
  try {
    return await renovarSesionFirebase(refreshToken);
  } catch (error) {
    return fallo("refresh", error);
  }
}

export async function obtenerPerfil(uid: string): Promise<{ usuario: Usuario }> {
  try {
    const usuario = await obtenerUsuarioAuth(uid);
    if (!usuario) throw new ErrorAutenticacion(401, "No autorizado");
    return { usuario };
  } catch (error) {
    if (error instanceof ErrorAutenticacion) throw error;
    throw new ErrorAutenticacion(500, "Error interno");
  }
}
