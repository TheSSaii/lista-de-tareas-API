import type { DocumentoTarea, TareaGuardada } from "@/src/tipos/tarea";

type Datos = Record<string, unknown>;
type Coleccion = Map<string, Datos>;

const colecciones = new Map<string, Coleccion>();
let fallarListado = false;
let fallarConteo = false;

function clonar(datos: Datos): Datos {
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
    .filter(([, datos]) => since === null || String(datos.updated_at) > since)
    .sort((a, b) => String(a[1].updated_at).localeCompare(String(b[1].updated_at)))
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

/**
 * Espejo de las consultas `count()` reales: `deleted_at == null` y `completada`
 * son igualdades, y los rangos son comparaciones lexicográficas de ISO 8601.
 * Un valor `null` nunca entra en un rango, igual que en Firestore.
 */
function contar(uid: string, predicado: (datos: Datos) => boolean): number {
  return [...obtenerColeccion(uid).values()].filter(predicado).length;
}

function esPendiente(datos: Datos): boolean {
  return datos.deleted_at === null && datos.completada === false;
}

function esCompletadaDesde(desde: string) {
  return (datos: Datos): boolean =>
    datos.deleted_at === null &&
    datos.completada === true &&
    typeof datos.completada_en === "string" &&
    datos.completada_en >= desde;
}

function esVencida(ahora: string) {
  return (datos: Datos): boolean =>
    esPendiente(datos) && typeof datos.vence_en === "string" && datos.vence_en < ahora;
}

async function contarCon(uid: string, predicado: (datos: Datos) => boolean): Promise<number> {
  if (fallarConteo) throw new Error("fallo simulado de conteo");

  return contar(uid, predicado);
}

export async function contarPendientes(uid: string): Promise<number> {
  return contarCon(uid, esPendiente);
}

export async function contarVencidas(uid: string, ahora: string): Promise<number> {
  return contarCon(uid, esVencida(ahora));
}

export async function contarCompletadasDesde(uid: string, desde: string): Promise<number> {
  return contarCon(uid, esCompletadaDesde(desde));
}

export function reiniciarTareasFalsas(): void {
  colecciones.clear();
  fallarListado = false;
  fallarConteo = false;
}

export function sembrarTareaFalsa(uid: string, id: string, datos: TareaGuardada): void {
  obtenerColeccion(uid).set(id, clonar(datos));
}

/** Siembra un documento anterior a este bloque, sin el campo `completada_en`. */
export function sembrarTareaLegada(
  uid: string,
  id: string,
  datos: Omit<TareaGuardada, "completada_en">,
): void {
  obtenerColeccion(uid).set(id, { ...datos });
}

export function leerTareaFalsa(uid: string, id: string): Datos | null {
  const datos = obtenerColeccion(uid).get(id);
  return datos ? clonar(datos) : null;
}

export function configurarFalloListado(valor: boolean): void {
  fallarListado = valor;
}

export function configurarFalloConteo(valor: boolean): void {
  fallarConteo = valor;
}
