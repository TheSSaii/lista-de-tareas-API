# Bitácora de IA

Formato: propósito · evidencia · validación · decisión.

## 2026-11-14 · Configuración inicial
- **Propósito:** bloquear lectura de secretos y salida del repositorio antes de generar código.
- **Evidencia:** `opencode.jsonc`, `.opencode/plugins/guard/`, `npm run check:ia` (16/16).
- **Validación:** pruebas 1, 2, 4, 8 y 9 de `ia/PRUEBAS-CONTENCION.md`.
- **Decisión:** los `deny` van al final porque OpenCode usa «gana la última regla».
  No existe excepción para `.env.example`: el archivo se versiona, pero la IA no lo lee ni lo escribe.
- **Decisión:** sin WSL ni sandbox de SO; el límite se documenta en `ia/CONFIGURACION.md`.

## 2026-11-14 · Cierre del bloque de tareas
- **Propósito:** dejar el CRUD y la sincronización de tareas listos antes de abrir autenticación.
- **Evidencia:** `app/api/tareas/**`, `src/lib/tareas-firestore.ts`, `src/servicios/tareas.ts`, `tests/tareas-*`; `npm run check` (68/68) y `npm run build`.
- **Validación:** pruebas de aislamiento por `uid`, `since`, validación Zod, upsert idempotente y borrado lógico.
- **Decisión:** `notificacion_id` no se persiste en Firestore; el recordatorio local vive en SQLite y la API no almacena metadatos de notificaciones.
- **Decisión:** `next.config.ts` queda sin `cacheComponents` ni `partialPrefetching`; la API usa Route Handlers por petición y respuestas sin caché.

## 2026-11-14 · Bloque de autenticación
- **Propósito:** habilitar registro, login, refresh y perfil con Firebase Auth mediado por la API.
- **Evidencia:** `app/api/auth/**`, `app/api/health/route.ts`, `src/lib/firebase-auth-rest.ts`, `src/servicios/auth.ts`, `tests/auth-*`, `tests/admin.test.ts` y `tests/health-ruta.test.ts`; cobertura 97,01 % de sentencias y 87,62 % de ramas.
- **Validación:** `fetch` simulado, sin red real; 201 de registro, 409 de correo repetido, 401 idéntico para credenciales inválidas, 400 de contraseña débil, 429, refresh válido/inválido, `/yo` sin/con token, `no-store`, health sin Firebase y `403` de una ruta admin simulada sin claim.
- **Decisión:** `/yo` usa `getUser(uid)` y no se modifica `verificarToken`; un fallo de configuración de Admin sigue devolviendo 401 desde `verificarToken` y queda documentado como deuda técnica.
- **Decisión:** el rate limiting real vive en el Firewall de Vercel; el código solo traduce `TOO_MANY_ATTEMPTS_TRY_LATER` a 429 y no usa contadores en memoria.
- **Decisión:** no se expone endpoint para asignar `rol = "admin"`; solo la primitiva `setCustomUserClaims` y el helper puro `esAdmin`, con prueba de autorización simulada.
- **Decisión:** no hay `console.*` en código ni pruebas; no se registran correos, contraseñas, tokens ni respuestas crudas.

## 2026-11-14 · Cierre del hueco de aprobación en Git y estado del bloque
- **Propósito:** que `git commit`/`git push` no se ejecuten sin aprobación dentro de comandos
  compuestos, y dejar constancia del estado de los 6 commits locales del bloque de auth.
- **Evidencia:** evaluación por segmentos (`&&`, `||`, `;`, `|`) y `PEDIR_PERMISO` en
  `.opencode/plugins/guard/politica.mjs`, rama `ask` en `.opencode/plugins/guard/index.ts`,
  pruebas 17–20 de `ia/pruebas/politica.test.mjs` y `npm run check:ia` (20/20).
  `git log` local: 6 commits; `git ls-remote origin refs/heads/main` devuelve `06800a8`.
- **Validación:** `git status && git commit` y `git add . && git push` devuelven `ask`;
  `git push --force` y `git reset --hard` encadenados siguen devolviendo `deny`; `git status`
  y `npm run check` siguen en `permitir`; un separador entre comillas
  (`echo "a; curl x"`) no parte el comando y `git commit -m "a; b"` sigue en `ask`.
- **Decisión:** se pide permiso (`ask`), no se deniega; los `deny` de fuerza/reset se evalúan
  antes. Los commits locales fueron autorizados por el humano; no se hizo push ni despliegue.

## 2026-11-14 · Caso corregido 4 — `.env` entre comillas
- **Propósito:** que la evaluación por segmentos no pierda la detección de `.env` cuando la
  ruta va entre comillas.
- **Detectado por:** la prueba 21 (`cat ".env.local"`), que falló con la segmentación inicial:
  al reemplazar el contenido entre comillas por `""`, el comando quedaba como `cat ""` y pasaba.
- **Evidencia:** `ENV_EN_COMANDO` se comprueba sobre el comando completo antes de segmentar en
  `.opencode/plugins/guard/politica.mjs`; `npm run check:ia` (23/23).
- **Validación:** `cat ".env.local"` y `cat '.env'` devuelven `deny`; `echo "a; curl x"` sigue
  en `permitir` y `git commit -m "a; b"` sigue en `ask`.
- **Decisión:** el filtro de `.env` es conservador y se aplica al comando completo; cualquier
  mención de `.env` en un comando se bloquea.

## 2026-11-14 · Caso corregido 5 — instalación y despliegue encadenados
- **Propósito:** que `npm install`, `npx expo install`, `vercel`, `eas`, `firebase deploy` y
  `npx expo start` pidan permiso también cuando van dentro de un comando compuesto.
- **Evidencia:** `PEDIR_PERMISO` ampliado en `.opencode/plugins/guard/politica.mjs`; pruebas
  22–23 de `ia/pruebas/politica.test.mjs` y `npm run check:ia` (23/23).
- **Validación:** `git status && npm install paquete`, `npm run check && vercel --prod` y
  `npm run check && eas build` devuelven `ask`; los `deny` de fuerza/reset/rm/curl/sudo siguen
  teniendo prioridad.
- **Decisión:** se mantiene `ask` y no `deny`; el `deny` queda reservado para acciones
  destructivas o de exfiltración.
