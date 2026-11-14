import type { DocumentoTarea, TareaGuardada } from "@/src/tipos/tarea";

type Coleccion = Map<string, TareaGuardada>;

const colecciones = new Map<string, Coleccion>();
let fallarListado = false;

function clonar(datos: TareaGuardada): TareaGuardada {
  return { ...datos };
}

function obtenerColeccion(uid: string): Coleccion {
  const existente = colecciones.get(uid);
  if (existente) return existente;

  const nueva: Coleccion = new Map();
  colecciones.set(uid, nueva);
  return nueva;
}

export async function listarDocumentosTarea(
  uid: string,
  since: string | null,
  limite: number,
): Promise<DocumentoTarea[]> {
  if (fallarListado) throw new Error("fallo simulado de listado");

  return [...obtenerColeccion(uid).entries()]
    .filter(([, datos]) => since === null || datos.updated_at > since)
    .sort((a, b) => a[1].updated_at.localeCompare(b[1].updated_at))
    .slice(0, limite)
    .map(([id, datos]) => ({ id, datos: clonar(datos) }));
}

export async function obtenerDocumentoTarea(
  uid: string,
  id: string,
): Promise<DocumentoTarea | null> {
  const datos = obtenerColeccion(uid).get(id);
  return datos ? { id, datos: clonar(datos) } : null;
}

export async function guardarDocumentoTarea(
  uid: string,
  id: string,
  datos: TareaGuardada,
): Promise<void> {
  obtenerColeccion(uid).set(id, clonar(datos));
}

export async function borrarDocumentoTarea(
  uid: string,
  id: string,
  datos: TareaGuardada,
): Promise<void> {
  obtenerColeccion(uid).set(id, clonar(datos));
}

export function reiniciarTareasFalsas(): void {
  colecciones.clear();
  fallarListado = false;
}

export function sembrarTareaFalsa(uid: string, id: string, datos: TareaGuardada): void {
  obtenerColeccion(uid).set(id, clonar(datos));
}

export function leerTareaFalsa(uid: string, id: string): TareaGuardada | null {
  const datos = obtenerColeccion(uid).get(id);
  return datos ? clonar(datos) : null;
}

export function configurarFalloListado(valor: boolean): void {
  fallarListado = valor;
}
