import { z } from "zod";
import { detallesZod } from "./detalles-zod";

export { detallesZod };

const FECHA = z.union([z.iso.datetime(), z.iso.date()]);

export const esquemaTarea = z
  .object({
    titulo: z
      .string()
      .trim()
      .min(3, "El título debe tener al menos 3 caracteres")
      .max(100, "El título debe tener como máximo 100 caracteres"),
    descripcion: z.string().nullable().default(null),
    prioridad: z.union([z.literal(1), z.literal(2), z.literal(3)], {
      error: "La prioridad debe ser 1, 2 o 3",
    }),
    vence_en: FECHA.nullable().default(null),
    completada: z.boolean().default(false),
  })
  .strip();

export const esquemaTareaGuardada = esquemaTarea.extend({
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
  deleted_at: z.iso.datetime().nullable(),
});

export const esquemaIdTarea = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,128}$/, "El id debe ser un UUID o un identificador seguro");

export const esquemaSince = z.iso.datetime();
