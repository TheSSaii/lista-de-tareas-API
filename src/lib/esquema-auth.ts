import { z } from "zod";

const email = z
  .string()
  .trim()
  .min(1, "El correo es obligatorio")
  .max(254, "El correo debe tener como máximo 254 caracteres")
  .pipe(z.email("El correo no es válido"));

const password = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .max(128, "La contraseña debe tener como máximo 128 caracteres");

export const esquemaRegistro = z
  .object({
    email,
    password,
  })
  .strip();

export const esquemaLogin = z
  .object({
    email,
    password,
  })
  .strip();

export const esquemaRefresh = z
  .object({
    refreshToken: z
      .string()
      .min(1, "El refreshToken es obligatorio")
      .max(4096, "El refreshToken es demasiado largo"),
  })
  .strip();
