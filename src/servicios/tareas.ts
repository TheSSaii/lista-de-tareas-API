import { esquemaTareaGuardada } from "../lib/esquema-tarea";
import { inicioDeSemanaUTC } from "../lib/semana";
import {
  borrarDocumentoTarea,
  contarCompletadasDesde,
  contarPendientes,
  contarVencidas,
  guardarDocumentoTarea,
  listarDocumentosTarea,
  obtenerDocumentoTarea,
} from "../lib/tareas-firestore";
import type {
  CamposTarea,
  DocumentoTarea,
  ResultadoListaTareas,
  ResumenTareas,
  Tarea,
  TareaGuardada,
} from "../tipos/tarea";

const LIMITE_POR_LLAMADA = 500;

function mapearDocumento(documento: DocumentoTarea): Tarea | null {
  const resultado = esquemaTareaGuardada.safeParse(documento.datos);
  if (!resultado.success) return null;

  return { id: documento.id, ...resultado.data };
}

function documentoValido(documento: DocumentoTarea | null): TareaGuardada | null {
  if (!documento) return null;

  const resultado = esquemaTareaGuardada.safeParse(documento.datos);
  return resultado.success ? resultado.data : null;
}

/**
 * Sello del servidor: no se acepta del cliente ni se mueve al reeditar.
 * Un documento legado completado sin sello toma su `updated_at` anterior.
 */
function selloCompletada(
  campos: CamposTarea,
  actual: TareaGuardada | null,
  ahora: string,
): string | null {
  if (!campos.completada) return null;
  // Solo se conserva el sello si el estado anterior ya estaba completado.
  if (actual?.completada) return actual.completada_en ?? actual.updated_at;
  return ahora;
}

/**
 * Límite conocido: `updated_at > since` puede omitir documentos escritos en el
 * mismo milisegundo que el último `updated_at` recibido por el cliente.
 */
export async function listarTareas(
  uid: string,
  since: string | null,
): Promise<ResultadoListaTareas> {
  const documentos = await listarDocumentosTarea(uid, since, LIMITE_POR_LLAMADA);
  const items = documentos.map(mapearDocumento).filter((tarea): tarea is Tarea => tarea !== null);

  return { items, servidor_ahora: new Date().toISOString() };
}

export async function guardarTarea(uid: string, id: string, campos: CamposTarea): Promise<Tarea> {
  const actual = documentoValido(await obtenerDocumentoTarea(uid, id));
  const ahora = new Date().toISOString();

  const guardada: TareaGuardada = {
    ...campos,
    created_at: actual?.created_at ?? ahora,
    updated_at: ahora,
    deleted_at: null,
    completada_en: selloCompletada(campos, actual, ahora),
  };

  await guardarDocumentoTarea(uid, id, guardada);
  return { id, ...guardada };
}

export async function eliminarTarea(uid: string, id: string): Promise<boolean> {
  const actual = documentoValido(await obtenerDocumentoTarea(uid, id));
  if (!actual) return false;

  const ahora = new Date().toISOString();
  await borrarDocumentoTarea(uid, id, {
    ...actual,
    updated_at: ahora,
    deleted_at: actual.deleted_at ?? ahora,
  });

  return true;
}

/**
 * Tres consultas `count()` en paralelo, una por métrica. No hay instantánea
 * común: los números pueden diferir entre sí bajo escrituras concurrentes.
 */
export async function obtenerResumenTareas(
  uid: string,
  ahora: Date = new Date(),
): Promise<ResumenTareas> {
  const instante = ahora.toISOString();
  const inicioSemana = inicioDeSemanaUTC(ahora);

  const [pendientes, vencidas, completadas_semana] = await Promise.all([
    contarPendientes(uid),
    contarVencidas(uid, instante),
    contarCompletadasDesde(uid, inicioSemana),
  ]);

  return { pendientes, vencidas, completadas_semana };
}
