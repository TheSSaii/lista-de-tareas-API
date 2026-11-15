import type { Query } from "firebase-admin/firestore";
import type { DocumentoTarea, TareaGuardada } from "../tipos/tarea";
import { getDb } from "./firebase";

function referenciaColeccion(uid: string) {
  return getDb().collection("usuarios").doc(uid).collection("tarea");
}

async function contar(consulta: Query): Promise<number> {
  const instantanea = await consulta.count().get();
  return instantanea.data().count;
}

export async function listarDocumentosTarea(
  uid: string,
  since: string | null,
  limite: number,
): Promise<DocumentoTarea[]> {
  const coleccion = referenciaColeccion(uid);
  const consulta =
    since === null
      ? coleccion.orderBy("updated_at", "asc")
      : coleccion.where("updated_at", ">", since).orderBy("updated_at", "asc");

  const instantanea = await consulta.limit(limite).get();

  return instantanea.docs.map((documento) => ({
    id: documento.id,
    datos: documento.data(),
  }));
}

export async function obtenerDocumentoTarea(
  uid: string,
  id: string,
): Promise<DocumentoTarea | null> {
  const documento = await referenciaColeccion(uid).doc(id).get();
  if (!documento.exists) return null;

  return { id: documento.id, datos: documento.data() };
}

/** Una sola consulta `count()`: pendientes incluye las vencidas. */
export async function contarPendientes(uid: string): Promise<number> {
  return contar(
    referenciaColeccion(uid).where("deleted_at", "==", null).where("completada", "==", false),
  );
}

/** Una sola consulta `count()`. Un `vence_en` nulo nunca entra en el rango. */
export async function contarVencidas(uid: string, ahora: string): Promise<number> {
  return contar(
    referenciaColeccion(uid)
      .where("deleted_at", "==", null)
      .where("completada", "==", false)
      .where("vence_en", "<", ahora),
  );
}

/** Una sola consulta `count()` con límite inferior inclusivo. */
export async function contarCompletadasDesde(uid: string, desde: string): Promise<number> {
  return contar(
    referenciaColeccion(uid)
      .where("deleted_at", "==", null)
      .where("completada", "==", true)
      .where("completada_en", ">=", desde),
  );
}

export async function guardarDocumentoTarea(
  uid: string,
  id: string,
  datos: TareaGuardada,
): Promise<void> {
  await referenciaColeccion(uid).doc(id).set(datos);
}

export async function borrarDocumentoTarea(
  uid: string,
  id: string,
  datos: TareaGuardada,
): Promise<void> {
  await referenciaColeccion(uid).doc(id).set(datos);
}
