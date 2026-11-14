type Datos = Record<string, unknown>;

const colecciones = new Map<string, Map<string, Datos>>();

function obtenerColeccion(uid: string): Map<string, Datos> {
  const existente = colecciones.get(uid);
  if (existente) return existente;

  const nueva = new Map<string, Datos>();
  colecciones.set(uid, nueva);
  return nueva;
}

function crearDocumento(uid: string, id: string) {
  return {
    id,
    get: async () => {
      const datos = obtenerColeccion(uid).get(id);
      return { id, exists: datos !== undefined, data: () => datos };
    },
    set: async (datos: Datos) => {
      obtenerColeccion(uid).set(id, { ...datos });
    },
  };
}

function crearColeccion(uid: string) {
  let since: string | null = null;
  let limite = Number.POSITIVE_INFINITY;

  const consulta = {
    where: (_campo: string, _operador: string, valor: string) => {
      since = valor;
      return consulta;
    },
    orderBy: () => consulta,
    limit: (valor: number) => {
      limite = valor;
      return consulta;
    },
    get: async () => {
      const documentos = [...obtenerColeccion(uid).entries()]
        .filter(([, datos]) => since === null || String(datos.updated_at) > since)
        .sort((a, b) => String(a[1].updated_at).localeCompare(String(b[1].updated_at)))
        .slice(0, limite)
        .map(([id, datos]) => ({ id, exists: true, data: () => datos }));

      return { docs: documentos };
    },
    doc: (id: string) => crearDocumento(uid, id),
  };

  return consulta;
}

export const dbFalsa = {
  collection: (_nombre: string) => ({
    doc: (uid: string) => ({
      collection: (_subcoleccion: string) => crearColeccion(uid),
    }),
  }),
};

export function reiniciarFirestoreFalso(): void {
  colecciones.clear();
}

export function sembrarDocumentoFalso(uid: string, id: string, datos: Datos): void {
  obtenerColeccion(uid).set(id, { ...datos });
}
