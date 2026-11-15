# Lista de tareas — API

API Next.js (App Router, Route Handlers, runtime Node) para la app móvil de
tareas. Firebase Auth y Firestore se usan **solo** desde el servidor con el
Admin SDK. Los secretos viven únicamente en las variables de entorno de Vercel.

## Estado

- URL de producción: `https://lista-de-tareas-api.vercel.app`
- Health público: `GET /api/health` → `200 { "ok": true }`
- Pruebas: `npm run check` (Vitest, typecheck, lint y formato)
- Contrato completo: `docs/03-lista-de-tareas.md`
- Pruebas manuales: `docs/pruebas-api.md` y `docs/postman-coleccion.json`

## Endpoints

| Método   | Ruta                  | Descripción                                     |
| -------- | --------------------- | ----------------------------------------------- |
| `GET`    | `/api/health`         | Público, no toca Firebase                       |
| `POST`   | `/api/auth/registro`  | Registro con email y contraseña                 |
| `POST`   | `/api/auth/login`     | Login                                           |
| `POST`   | `/api/auth/refresh`   | Renovar ID token                                |
| `GET`    | `/api/auth/yo`        | Perfil del token verificado                     |
| `GET`    | `/api/tareas`         | Listado con `?since=<ISO>` y máximo 500         |
| `PUT`    | `/api/tareas/:id`     | Crear o reemplazar una tarea                    |
| `DELETE` | `/api/tareas/:id`     | Borrado lógico                                  |
| `GET`    | `/api/tareas/resumen` | Pendientes, vencidas y completadas de la semana |

Todas las rutas privadas exigen `Authorization: Bearer <ID token de Firebase>`.
Los errores usan `{ "error": "...", "detalles"?: [{ "campo", "mensaje" }] }`;
los `500` son siempre `{ "error": "Error interno" }`.

## Variables de entorno

Solo en Vercel:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (con `\n` literales; el código los convierte)
- `FIREBASE_WEB_API_KEY`

No hay `.env` real en el repositorio. `FIREBASE_PRIVATE_KEY` y
`FIREBASE_WEB_API_KEY` nunca se versionan ni se incluyen en la app móvil.

## Comandos

```bash
npm run dev             # desarrollo local
npm run check           # typecheck + lint + formato + Vitest
npm run test:coverage   # cobertura de src/lib y src/servicios
npm run build           # build de Next
npm run check:ia        # pruebas de la configuración de IA
```

## Firestore

- Reglas: `firestore.rules` (deniegan todo a clientes; la API usa Admin SDK).
- Índices: `firestore.indexes.json`; deben estar **Habilitados** antes de usar
  `GET /api/tareas/resumen`.
- El detalle de contrato, semana UTC y `completada_en` está en
  `docs/notas-implementacion.md`.

## Pruebas manuales

La colección de Postman está en `docs/postman-coleccion.json`:

1. Importarla.
2. Ajustar `baseUrl` a la URL de producción.
3. Ejecutar **Flujo principal** y después **Errores**.
4. La request **13 · Resumen de tareas** requiere los índices habilitados.

El login del flujo guarda automáticamente el token; no hay que copiarlo a mano.

## Seguridad

- Firestore niega lectura y escritura a clientes.
- El `uid` sale siempre del token verificado.
- No se registran contraseñas, tokens ni datos personales.
- Rate limiting: configurar el Firewall de Vercel para login/registro y refresh.
- La app móvil solo conoce `EXPO_PUBLIC_API_URL`; no incluye `firebaseConfig`.
