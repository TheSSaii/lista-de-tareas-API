import { esquemaTareaGuardada } from "../lib/esquema-tarea";
import {
  borrarDocumentoTarea,
  guardarDocumentoTarea,
  listarDocumentosTarea,
  obtenerDocumentoTarea,
} from "../lib/tareas-firestore";
import type {
  CamposTarea,
  DocumentoTarea,
  ResultadoListaTareas,
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
