import type { DetalleError } from "./respuestas";

export class ErrorAutenticacion extends Error {
  readonly estado: number;
  readonly mensaje: string;
  readonly detalles?: DetalleError[];

  constructor(estado: number, mensaje: string, detalles?: DetalleError[]) {
    super(mensaje);
    this.name = "ErrorAutenticacion";
    this.estado = estado;
    this.mensaje = mensaje;
    if (detalles) this.detalles = detalles;
  }
}

export class ErrorConfiguracionAuth extends Error {
  constructor() {
    super("Configuración de autenticación incompleta");
    this.name = "ErrorConfiguracionAuth";
  }
}
