import type { z } from "zod";
import type { DetalleError } from "./respuestas";

export function detallesZod(error: z.ZodError): DetalleError[] {
  return error.issues.map((issue) => ({
    campo: issue.path.length > 0 ? issue.path.join(".") : "(cuerpo)",
    mensaje: issue.message,
  }));
}
