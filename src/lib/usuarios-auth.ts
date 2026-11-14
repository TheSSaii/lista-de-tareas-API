import type { Usuario } from "../tipos/auth";
import { getAuthAdmin } from "./firebase";

function esUsuarioNoEncontrado(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "auth/user-not-found"
  );
}

export async function obtenerUsuarioAuth(uid: string): Promise<Usuario | null> {
  try {
    const usuario = await getAuthAdmin().getUser(uid);
    if (!usuario.email) return null;
    return { id: usuario.uid, email: usuario.email };
  } catch (error) {
    if (esUsuarioNoEncontrado(error)) return null;
    throw error;
  }
}

export async function setCustomUserClaims(
  uid: string,
  claims: Record<string, unknown>,
): Promise<void> {
  await getAuthAdmin().setCustomUserClaims(uid, claims);
}
