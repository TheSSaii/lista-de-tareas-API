# Notas de implementación de la API

## Bloque de tareas

### `notificacion_id` fuera de Firestore

El contrato de Firestore de la API no persiste `notificacion_id`: el recordatorio
local pertenece a la app móvil y se gestiona en su SQLite, como describe
`docs/03-lista-de-tareas.md`. Se retiró del tipo `CamposTarea`, del esquema Zod y
de las pruebas. La app puede seguir sincronizando el resto de campos sin enviar
metadatos de notificaciones al servidor.

### `next.config.ts`

La configuración quedó vacía al retirar los flags experimentales
`cacheComponents` y `partialPrefetching`. Esta API expone Route Handlers que
dependen de cabeceras de petición y de respuestas sin caché; no se usa el modelo
de componentes cacheables de Next. El build se mantiene en verde con la
configuración mínima.

### Límite conocido de sincronización

`GET /api/tareas?since=<ISO>` usa `updated_at > since`. Si dos documentos se
actualizan en el mismo milisegundo que el último `updated_at` recibido por el
cliente, la consulta puede omitir el segundo. El cliente debe repetir la
sincronización con el último `updated_at` recibido y, en caso de empate, avanzar
por bloques hasta recibir menos de 500 elementos.

## Bloque de resumen de tareas

### Contrato de `GET /api/tareas/resumen`

`Authorization: Bearer <idToken>`. Sin cuerpo ni parámetros (los extra se
ignoran). `200` con exactamente tres enteros `>= 0` y `Cache-Control: no-store`:

| Campo | Filtros | Nota |
|---|---|---|
| `pendientes` | `deleted_at == null`, `completada == false` | **incluye** las vencidas |
| `vencidas` | lo anterior y `vence_en < ahora` | subconjunto de `pendientes` |
| `completadas_semana` | `deleted_at == null`, `completada == true`, `completada_en >= inicio de semana` | `completada_en: null` no cuenta |

`401 { "error": "No autorizado" }` sin token o con token no verificable; `500
{ "error": "Error interno" }` sin detalles. La ruta no escribe logs ni expone el
motivo: si devuelve `500`, revisa primero que los índices estén «Habilitado» en
Firebase Console y que el deployment tenga las variables de Firebase.

### `completada_en`

Campo del servidor. No está en `esquemaTarea`, así que el cliente no puede
fijarlo ni limpiarlo; `esquemaTareaGuardada` lo declara con `default(null)` para
que los documentos anteriores a este bloque sigan listándose.

| Situación | Resultado |
|---|---|
| `completada: false` | `null` |
| `false → true` | `ahora` |
| `true → true` con sello | se conserva (editar no mueve la semana) |
| `true → true` en documento legado sin sello | `updated_at` anterior |
| `DELETE` | se conserva; `deleted_at` ya lo excluye del resumen |

Consecuencia de sincronización: una tarea completada sin conexión se sella cuando
la app sincroniza el `PUT`, no en el instante real en que se completó. El resumen
usa el sello del servidor.

### Inicio de semana

Lunes `00:00:00.000 UTC`, límite inclusivo (`completada_en >= inicio`), en
`src/lib/semana.ts`. No es «últimos 7 días». En Colombia (UTC-5) el corte local
cae domingo a las 19:00. Un `vence_en` con formato `YYYY-MM-DD` se considera
vencido desde las `00:00` UTC de ese día, porque ISO 8601 se compara como texto;
el formulario de la app envía fecha y hora.

### Consultas e índices

Tres `count()` en paralelo, una por métrica, sin leer documentos. No hay
instantánea común: los números pueden diferir entre sí bajo escrituras
concurrentes. `pendientes` solo usa igualdades; las otras dos necesitan índices
compuestos, declarados en `firestore.indexes.json`:

| Índice | `collectionGroup` | Campos |
|---|---|---|
| vencidas | `tarea` | `deleted_at ASC`, `completada ASC`, `vence_en ASC` |
| completadas_semana | `tarea` | `deleted_at ASC`, `completada ASC`, `completada_en ASC` |

Ambos con `queryScope: COLLECTION`. **Crear los índices antes de desplegar la
ruta**: sin ellos Firestore devuelve `FAILED_PRECONDITION` y la API responde 500.
Enlace: `https://console.firebase.google.com/project/<FIREBASE_PROJECT_ID>/firestore/indexes`
(`<FIREBASE_PROJECT_ID>` está en Vercel → Settings → Environment Variables; no se
versiona). `firebase.json` solo declara la ruta del archivo de índices; este
bloque no ejecuta `firebase deploy`.

### Deuda conocida: colisión con `[id]`

`GET /api/tareas/resumen` resuelve bien porque el segmento estático tiene
prioridad sobre el dinámico. Pero `PUT` y `DELETE /api/tareas/resumen` caen en
`app/api/tareas/[id]/route.ts` y `esquemaIdTarea` acepta `resumen` como id, así
que un cliente equivocado crearía la tarea `resumen`. Queda como deuda: reservar
el slug o exigir UUID en `esquemaIdTarea`. No se cambia el contrato en este
bloque.

### Compatibilidad con la app

`GET /api/tareas` ahora devuelve `completada_en` en cada item. La app debe
ignorar el campo o migrarlo a SQLite; no debe enviarlo en el `PUT`.

## Bloque de autenticación

### Contrato

| Método y ruta | Éxito | Cuerpo |
|---|---|---|
| `POST /api/auth/registro` | `201` | `{ token, refreshToken, expiraEnSeg, usuario: { id, email } }` |
| `POST /api/auth/login` | `200` | Igual que registro |
| `POST /api/auth/refresh` | `200` | `{ token, refreshToken, expiraEnSeg }` |
| `GET /api/auth/yo` | `200` | `{ usuario: { id, email } }` |
| `GET /api/health` | `200` | `{ ok: true }` |

`expiraEnSeg` es un número entero. El `id` del usuario sale de Firebase
(`localId` o `uid` verificado), nunca del cuerpo. Las respuestas de auth y health
llevan `Cache-Control: no-store`.

### Capas

- Las rutas solo leen el cuerpo, validan con Zod, llaman al servicio y eligen el
  estado HTTP.
- `src/servicios/auth.ts` orquesta el registro, login, refresh y perfil.
- `src/lib/firebase-auth-rest.ts` habla con Identity Toolkit y Secure Token. Lee
  `FIREBASE_WEB_API_KEY` dentro de la función, nunca al importar el módulo.
- `src/lib/usuarios-auth.ts` contiene `getUser(uid)` y la primitiva
  `setCustomUserClaims`.
- `src/lib/roles.ts` contiene `esAdmin(claims)` y `asignarRolAdmin(uid)`.

### Email en `GET /api/auth/yo`

Se mantiene `verificarToken` sin cambios. La ruta obtiene el `uid` del token y
luego llama a `getUser(uid)` para devolver el email actual. Se prefirió esta
opción a leer el claim del token porque el claim puede quedar obsoleto hasta una
hora y porque ampliar `verificarToken` habría acoplado todas las rutas privadas a
un dato que solo usa `/yo`. Si el usuario ya no existe se responde `401`; si falla
Admin, `500`.

Decisión aceptada: `verificarToken` captura cualquier fallo, incluido un error de
configuración de Firebase Admin, y lo convierte en `401 No autorizado`. No se
cambia en este bloque para no alterar las rutas de tareas; queda documentado como
deuda técnica.

### Errores de Firebase Auth

| Firebase | HTTP | Mensaje |
|---|---:|---|
| `EMAIL_EXISTS` | `409` | El correo ya está registrado |
| `INVALID_LOGIN_CREDENTIALS`, `EMAIL_NOT_FOUND`, `INVALID_PASSWORD`, `INVALID_EMAIL`, `USER_DISABLED` | `401` | Credenciales inválidas |
| `WEAK_PASSWORD` | `400` | La contraseña no cumple los requisitos |
| `TOO_MANY_ATTEMPTS_TRY_LATER` | `429` | Demasiados intentos. Inténtalo más tarde |
| `INVALID_REFRESH_TOKEN`, `TOKEN_EXPIRED`, `INVALID_GRANT` | `401` | Sesión expirada |
| Código desconocido, red, timeout, JSON inválido o configuración | `500` | Error interno |

El cliente REST solo conserva el código normalizado del error. No se registran ni
se devuelven correos, contraseñas, tokens, URLs con la clave ni respuestas crudas
de Firebase. Tampoco hay llamadas a `console.*`.

### Rate limiting

El control real se configura en el Firewall de Vercel por ruta e IP, por ejemplo
10 peticiones por minuto para registro/login y 30 para refresh. En código solo se
traduce `TOO_MANY_ATTEMPTS_TRY_LATER` de Firebase a `429`; no se usa un contador
en memoria porque cada instancia de Vercel es efímera y daría una falsa sensación
de protección.

El Firewall puede devolver un `429` que no tenga el cuerpo JSON del contrato. El
cliente debe tratar cualquier `429` como “demasiados intentos”. Si se exige el
JSON exacto también en ese caso, hay que configurar una respuesta personalizada
del Firewall.

### Rol `admin`

Hoy no existen rutas de administración. Se añadió la primitiva
`setCustomUserClaims` y el helper puro `esAdmin(claims)`, con una prueba de una
ruta de administración simulada que responde `403` sin `rol = "admin"`. No se
expone ningún endpoint HTTP para asignar roles: hacerlo ampliaría la superficie
de ataque y exigiría un mecanismo de arranque y auditoría que este bloque no
necesita. La asignación se hará con un script o proceso manual cuando existan
rutas administrativas reales.

### Inicialización perezosa

No se lee ninguna variable de entorno ni se inicializa Firebase al importar un
módulo. `GET /api/health` no importa Firebase. Por eso `npm run build` sigue
pasando sin `FIREBASE_WEB_API_KEY`; si la clave falta en tiempo de petición, la
respuesta es `500 Error interno`, nunca un mensaje de configuración.

### `firebase-admin` en Vercel

`next.config.ts` declara `serverExternalPackages: ["firebase-admin"]`. Sin esa
externalización, Turbopack empaqueta los `require` dinámicos y las dependencias
gRPC de Admin, y en Vercel las rutas que importan Firebase devolvían `500` con
cuerpo vacío mientras `/api/health` seguía en `200`. Con la externalización, el
runtime de Node resuelve el paquete desde `node_modules`. El proyecto debe usar
Node 22 o superior, que es el `engines` de `firebase-admin` 14.

Además, `jwks-rsa@4.1.0` hace `require('jose')`, pero el lock resolvía
`jose@6.2.17`, que es ESM-only, y Vercel lanzaba `ERR_REQUIRE_ESM` al cargar
`firebase-admin/auth`. `package.json` fija `jose@4.15.9` con `overrides`: esa
versión es CommonJS y expone `importJWK`, `exportSPKI`, `decodeJwt` y
`decodeProtectedHeader`, que son las funciones que usa `jwks-rsa`.
