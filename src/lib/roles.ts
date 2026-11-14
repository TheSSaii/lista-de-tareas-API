import { setCustomUserClaims } from "./usuarios-auth";

export const ROL_ADMIN = "admin";

export function esAdmin(claims: unknown): boolean {
  if (typeof claims !== "object" || claims === null || !("rol" in claims)) {
    return false;
  }

  return claims.rol === ROL_ADMIN;
}

export async function asignarRolAdmin(uid: string): Promise<void> {
  await setCustomUserClaims(uid, { rol: ROL_ADMIN });
}
