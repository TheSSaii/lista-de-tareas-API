# Plan · GET /api/tareas/resumen

> **Feedback del arquitecto (2026-11-15): aprobado.** Respuestas a las cuatro preguntas:
>
> - **D1 — sí:** `completada_en` lo pone el servidor; no uses el proxy `updated_at`. Añade los casos: documento nuevo con `completada: true` → `ahora`; documento legado `true` sin campo → `updated_at` anterior; `DELETE` conserva el valor. El cliente no puede fijarlo. Documenta que una tarea completada sin conexión se sella al sincronizar, no en el instante real de completarse.
> - **D2 — sí:** lunes 00:00:00.000 UTC, límite inclusivo. Documenta que en Colombia (UTC-5) el corte local es domingo a las 19:00.
> - **D3 — sí:** exactamente `{ pendientes, vencidas, completadas_semana }`, sin `servidor_ahora` ni `inicio_semana`.
> - **F6 — consola:** tú dejas `firestore.indexes.json`, `firebase.json` e instrucciones; el humano crea los índices en Firebase Console. **No ejecutes `firebase deploy`.**
>
> **Ajustes:**
> 1. R1: la ruta no registra logs; no prometas revisar `FAILED_PRECONDITION` en logs. Crea los índices antes del deploy y deja el smoke test manual.
> 2. Añade pruebas para: documento nuevo `completada: true` → `ahora`; legado `true` sin campo → `updated_at`; `DELETE` conserva; `GET /api/tareas` devuelve `completada_en` y la app lo ignora (coordinación con el plan de auth/sync).
> 3. R6: documenta la colisión de `PUT/DELETE /api/tareas/resumen` con `[id]` como deuda; no cambies el contrato.
> 4. Verifica que los índices usen `collectionGroup: "tarea"` y `queryScope: COLLECTION`, con los campos en el orden propuesto; el humano los crea antes del deploy.
> 5. Implementa F1–F5, F6 (solo JSON e instrucciones) y F7. No hagas commit, push ni deploy. Reporta con el formato acordado.
>
> El resto se aprueba.

He leído `AGENTS.md`, `docs/03-lista-de-tareas.md` (§9.1–9.5), `src/lib/`, `src/servicios/tareas.ts`, `app/api/tareas/**`, `tests/`, `docs/notas-implementacion.md`, `docs/pruebas-api.md`, `ia/BITACORA.md`, `package.json` (firebase-admin 14.5.1) y `vitest.config.mts`. Plan del bloque, sin tocar archivos.

---

# Plan · Bloque `GET /api/tareas/resumen`

## 0. Baseline verificado (leído, no ejecutado)

| Hecho | Evidencia |
|---|---|
| `firebase-admin ^14.5.1` → `getCountFromServer` disponible en `firebase-admin/firestore` | `package.json:20`, `src/lib/firebase.ts:3` |
| Rutas privadas: `verificarToken` primero, `uid` del token | `app/api/tareas/route.ts:18`, `src/lib/auth.ts:21` |
| Primas Firestore viven en `src/lib`, nunca en la ruta | `src/lib/tareas-firestore.ts`, regla en `AGENTS.md:30` |
| `esquemaTarea` es `.strip()` → campos extra del cliente se descartan | `src/lib/esquema-tarea.ts:22` |
| `vence_en` admite **dos formatos**: datetime ISO o `YYYY-MM-DD` | `src/lib/esquema-tarea.ts:6,19` |
| No existe `completada_en`; `guardarTarea` solo pone `created_at/updated_at/deleted_at` | `src/servicios/tareas.ts:46-59` |
| Pruebas de rutas mockean `@/src/lib/auth` + `@/src/lib/tareas-firestore` por módulo | `tests/tareas-rutas.test.ts:14-31` |
| Fake de SDK no soporta `count()` ni `where` real | `tests/ayuda/firestore-sdk-falso.ts:31-51` |
| Covertura ≥80 % solo sobre `src/lib/**` y `src/servicios/**` | `vitest.config.mts` |
| No hay `firestore.indexes.json` ni `firebase.json` | `ls` de la raíz |

---

## 1. Decisiones de tech lead (con recomendación)

### D1 — `completada_en` como campo del servidor ✅ recomendado

**Rechazo el proxy con `updated_at`.** Con `updated_at` cualquier edición (título, prioridad, `vence_en`) mueve una tarea completada de semana; el número `completadas_semana` dejaría de ser un hecho y pasaría a ser «tareas completadas tocadas esta semana». Eso es un dato incorrecto, no un trade-off.

Reglas exactas (deterministas e idempotentes):

| Situación | `completada_en` resultante |
|---|---|
| `completada: false` | `null` |
| Transición `false → true` | `ahora` |
| `true → true` y ya tenía valor | se **conserva** (no se mueve de semana al reeditar) |
| `true → true` y era `null` (doc legado anterior al bloque) | `updated_at` **anterior** (proxy estable, no se inventa un dato nuevo) |
| `DELETE` | se conserva tal cual (el filtro `deleted_at` ya lo excluye) |
| Cliente envía `completada_en` en el PUT | se descarta (`.strip()` + no está en `esquemaTarea`) |

Consecuencias técnicas:
- `TareaGuardada`/`Tarea` ganan `completada_en: string | null` (`src/tipos/tarea.ts`).
- `esquemaTareaGuardada` gana `completada_en: z.iso.datetime().nullable().default(null)`.
  **`default(null)` es obligatorio**: sin él, `mapearDocumento` (`src/servicios/tareas.ts:19`) devolvería `null` para *todos* los documentos ya desplegados y `GET /api/tareas` se rompería en producción. Con `default(null)`, los documentos legados siguen siendo válidos y simplemente no cuentan en la semana.
- `esquemaTarea` (contrato de entrada) **no** cambia: el cliente no decide este campo (regla §9.5).
- Efecto lateral aceptado y a documentar: `GET /api/tareas` empieza a devolver `completada_en` en cada item. La app debe tolerar el campo extra (o mapearlo a SQLite en una migración).

### D2 — Inicio de semana: **lunes 00:00:00.000 UTC** (ISO‑8601) ✅ recomendado

- Todo se almacena en ISO 8601 UTC (§9.2); el servidor no tiene zona del usuario. Usar zona local exigiría que el cliente envíe su offset por query string, lo que añade superficie de validación y permite manipular el conteo.
- Función pura `inicioDeSemanaUTC(ahora: Date): string` que devuelve el lunes a las `00:00:00.000Z` (si `ahora` es lunes 00:00 exacto, devuelve ese mismo instante → el límite es **inclusivo**: `completada_en >= inicio`).
- Se documenta: la semana es «semana en curso hasta ahora», no «últimos 7 días». La app puede rotular «esta semana» sin ambigüedad.
- Si en el futuro se quiere zona del estudiante, será un parámetro `?tz=` validado con Zod y una decisión aparte, no un cambio silencioso.

### D3 — Contrato mínimo: exactamente tres enteros

`{ pendientes, vencidas, completadas_semana }`, sin `servidor_ahora` ni `inicio_semana`. Razón: el documento §9.4 fija esas tres métricas y la app puede derivar la semana con la misma regla ISO. Añadir campos hoy es creep de contrato que hay que sostener para siempre. (Alternativa descartada: `servidor_ahora` para detectar desfase de reloj; el listado ya lo expone y no aporta aquí.)

### D4 — Definición de cada métrica (explícita, sin doble conteo oculto)

| Métrica | Filtros Firestore | Notas |
|---|---|---|
| `pendientes` | `deleted_at == null`, `completada == false` | **incluye** las vencidas |
| `vencidas` | `deleted_at == null`, `completada == false`, `vence_en != null` implícito, `vence_en < ahora` | subconjunto de `pendientes` |
| `completadas_semana` | `deleted_at == null`, `completada == true`, `completada_en >= inicioSemana` | `completada_en == null` no cuenta |

`pendientes` y `vencidas` **no son disjuntas**; se documenta en el contrato para que la app no reste por su cuenta («8 pendientes, 3 vencidas»).

### D5 — Ambigüedad de `vence_en` con formato fecha (riesgo aceptado con mitigación)

`vence_en` admite `2026-11-20` y `2026-11-20T15:00:00.000Z`. La comparación en Firestore es lexicográfica sobre strings: `"2026-11-20" < "2026-11-20T15:00:00.000Z"`. Consecuencia: **una tarea con fecha sin hora se considera vencida desde las 00:00 UTC de ese día**.

- Se acepta y se documenta (el formulario de la app envía fecha + hora, §3 y §7).
- Deuda registrada: endurecer `esquemaTarea` a `z.iso.datetime()` para `vence_en` en un bloque posterior, con aviso de cambio de contrato a la app. No se hace aquí para no romper PUT ya desplegados.

### D6 — Índices compuestos: **sí hacen falta** (2)

Consultas con **dos igualdades + un rango** sobre otro campo ⇒ índice compuesto obligatorio:

| # | Colección | `queryScope` | Campos (en orden) | Query |
|---|---|---|---|---|
| I1 | `tarea` (subcolección) | `COLLECTION` | `deleted_at ASC, completada ASC, vence_en ASC` | vencidas |
| I2 | `tarea` (subcolección) | `COLLECTION` | `deleted_at ASC, completada ASC, completada_en ASC` | completadas_semana |

`pendientes` (solo igualdades) **no** necesita índice compuesto: Firestore combina índices de un solo campo para igualdades.

Se crea `firestore.indexes.json` + `firebase.json` versionados. Mientras no se despliegue (requiere permiso), el enlace de consola es:

```text
https://console.firebase.google.com/project/<FIREBASE_PROJECT_ID>/firestore/indexes
→ Crear índice → Colección: tarea (grupo de colecciones) → Campos arriba.
```

`<FIREBASE_PROJECT_ID>` está solo en Vercel; **no** lo leo ni lo escribo en el repo. El operador lo copia de Vercel → Settings → Environment Variables.

> Sin índice, Firestore lanza `FAILED_PRECONDITION`; nuestra ruta lo convierte en `500 Error interno` (correcto por seguridad, opaco para depurar). Por eso **el índice debe existir antes del deploy de la ruta** (ver F6/F8).

---

## 2. Contrato exacto

```http
GET /api/tareas/resumen
Authorization: Bearer <idToken de Firebase>
```

Sin cuerpo. Sin parámetros de query (los parámetros extra se **ignoran**, no dan 400: no aportan validación real y evitan romper clientes).

**200 OK**

```json
{ "pendientes": 8, "vencidas": 3, "completadas_semana": 5 }
```

- Los tres son enteros `>= 0`; siempre presentes, nunca `null`.
- Orden de claves irrelevante. Sin campos adicionales.
- Cabecera `Cache-Control: no-store` (se usa `respuestaJson` de `src/lib/respuestas.ts:17`, no `NextResponse.json`).

**401** `{ "error": "No autorizado" }` — sin cabecera, formato inválido o token no verificable.

**500** `{ "error": "Error interno" }` — fallo de Firestore, índice ausente o configuración. Nunca detalles, nunca el `uid`.

**Definiciones publicadas en `docs/notas-implementacion.md`**: las de la tabla D4 + D1 + D2, incluida la nota de `vence_en` sin hora.

---

## 3. Diseño de capas (archivos a tocar)

| Archivo | Cambio |
|---|---|
| `src/tipos/tarea.ts` | `completada_en: string \| null` en `TareaGuardada`; tipo `ResumenTareas` |
| `src/lib/esquema-tarea.ts` | `completada_en` en `esquemaTareaGuardada` con `.default(null)`; `esquemaTarea` intacto |
| `src/servicios/tareas.ts` | `guardarTarea` calcula `completada_en` (tabla D1); `obtenerResumenTareas(uid, ahora = new Date())` |
| `src/lib/semana.ts` *(nuevo)* | `inicioDeSemanaUTC(ahora: Date): string`, pura, sin Firestore |
| `src/lib/tareas-firestore.ts` | 3 primitivas: `contarPendientes(uid)`, `contarVencidas(uid, ahora)`, `contarCompletadasDesde(uid, desde)` + helper privado `contar(consulta)` con `getCountFromServer` |
| `app/api/tareas/resumen/route.ts` *(nuevo)* | `runtime = "nodejs"`, `verificarToken`, `try/catch → respuestaInterna`, `respuestaJson` |
| `firestore.indexes.json`, `firebase.json` *(nuevos)* | I1 + I2 |
| `tests/ayuda/firestore-sdk-falso.ts` | soporte de `where` con `==`/`>=`/`<` (null, boolean, string) + `contarFalso()` |
| `tests/ayuda/tareas-falsas.ts` | 3 primitivas de conteo falsas + `configurarFalloConteo` |
| `tests/*` | fixtures con `completada_en` + pruebas nuevas (§5) |
| `docs/notas-implementacion.md`, `docs/pruebas-api.md`, `docs/postman-coleccion.json`, `ia/BITACORA.md` | contrato, verificación manual, bitácora |

**Por qué tres primitivas y no una genérica**: una primitiva que reciba filtros arbitrarios traslada la semántica de negocio a la ruta y hace que el fake replique un mini Firestore (divergencia garantizada). Tres funciones explícitas de 6 líneas cada una mantienen la regla «cada primitiva en `src/lib`», dejan «una consulta por métrica» visible en el código y hacen que el fake sea trivial y honesto. La ruta y el servicio solo ven números.

**Paralelismo**: `Promise.all` de los tres conteos (3 round-trips en paralelo, ~1 RTT). No hay snapshot atómico entre métricas (ver R4).

---

## 4. Fases (cada una con su prueba que debe fallar primero)

### F0 · Acuerdo y criterios de aceptación (este documento)
CA: decisiones D1–D6 aprobadas por el humano; nada escrito en el repo todavía.

### F1 · Dominio: `completada_en` (S)
Rojo: en `tests/tareas-rutas.test.ts`, «PUT false→true pone `completada_en`; repetir PUT no lo cambia; true→false lo deja en `null`; el cliente no puede fijarlo».
Verde: tipos + esquema + `guardarTarea`.
CA: 4 pruebas nuevas verdes; `GET /api/tareas` sigue devolviendo los documentos legados (fixture sin `completada_en`).

### F2 · Función pura de semana (S)
Rojo: `tests/semana.test.ts` — lunes 00:00 exacto → él mismo; domingo 23:59 → lunes anterior; cruce de mes y de año; salida siempre `YYYY-MM-DDTHH:mm:ss.000Z`.
Verde: `src/lib/semana.ts`.
CA: 5–6 casos verdes, sin `Date` mutado, sin dependencias nuevas.

### F3 · Primitivas de conteo + fake del SDK (M)
Rojo: `tests/tareas-firestore.test.ts` — 3 primitivas respetan `uid`, `deleted_at == null`, `completada`, rango `vence_en`/`completada_en`; 0 cuando la colección está vacía.
Verde: primitivas con `getCountFromServer`; el test mockea `firebase-admin/firestore` con `{ getCountFromServer: async (q) => ({ data: () => ({ count: q.contarFalso() }) }) }` y extiende `dbFalsa`.
CA: el fake no implementa Firestore entero, solo lo que usan estas primitivas (documentado).

### F4 · Servicio `obtenerResumenTareas` (S)
Rojo: `tests/resumen-servicio.test.ts` con `ahora` inyectado — `completada_en == inicioSemana` cuenta; `inicioSemana − 1 ms` no; `completada_en: null` no cuenta; `vence_en: null` no cuenta como vencida.
Verde: servicio que calcula `inicioSemana` una vez y llama a las 3 primitivas en paralelo.
CA: sin lógica de fechas duplicada entre servicio y ruta.

### F5 · Ruta `GET /api/tareas/resumen` (S)
Rojo: `tests/resumen-rutas.test.ts` (§5).
Verde: `app/api/tareas/resumen/route.ts`.
CA: 401 correcto; cuerpo exacto de 3 claves; `no-store`; 500 opaco. `GET /api/tareas/resumen` resuelve a la ruta estática (Next prioriza el segmento estático sobre `[id]`).

### F6 · Índices (S, requiere permiso para desplegar)
Rojo: prueba unitaria que lee `firestore.indexes.json` y exige I1 e I2 con los campos en orden (evita que el archivo se rompa sin que nadie lo note).
Verde: `firestore.indexes.json` + `firebase.json`.
CA: índice I1/I2 **creados en el proyecto** (consola o `firebase deploy --only firestore:indexes` **previo permiso explícito**, hoy prohibido sin él). Verificar estado «Habilitado» antes de F8.

### F7 · Documentación (S)
`docs/notas-implementacion.md` (definiciones, semana UTC, `vence_en` sin hora, legado sin `completada_en`, índices + enlace), `docs/pruebas-api.md` (§ resumen con `curl`, en terminal del humano: el guard bloquea `curl`), `docs/postman-coleccion.json`, `ia/BITACORA.md` (propósito · evidencia · validación · decisión).
CA: cero secretos, cero `console.*`, `PROJECT_ID` como placeholder.

### F8 · Verificación y entrega (permiso para deploy)
1. `npm run check` (typecheck + lint + formato + tests) — verde.
2. `npm run test:coverage` — `src/lib` y `src/servicios` ≥80 %.
3. `npm run build` — verde.
4. Diff completo revisado antes de proponer commits pequeños:
   - `feat(tareas): guarda completada_en del servidor al completar`
   - `feat(tareas): expone resumen con count() por metrica`
   - `chore(firestore): agrega indices compuestos del resumen`
   - `docs(tareas): documenta el contrato del resumen`
5. Deploy **solo con permiso**; tras deploy, verificación manual de `docs/pruebas-api.md` (401 y 200 reales).

---

## 5. Matriz de pruebas

| Archivo | Caso | Esperado |
|---|---|---|
| `tests/resumen-rutas.test.ts` | sin `Authorization` | `401 {error:"No autorizado"}` |
| | token no verificable (`sesion.uid = null`) | `401`, mismo cuerpo |
| | usuario sin tareas | `200 {pendientes:0, vencidas:0, completadas_semana:0}` |
| | mezcla (2 pendientes, 1 vencida, 1 completada de la semana, 1 completada de la semana pasada) | `{pendientes:2, vencidas:1, completadas_semana:1}` |
| | **aislamiento**: beto tiene 5 pendientes y 5 vencidas | los conteos de ana no cambian |
| | **borrados**: pendiente y completada con `deleted_at` no nulo | no suman en ninguna de las 3 métricas |
| | completada con `completada_en: null` (legado) | no suma en `completadas_semana` |
| | tarea pendiente con `vence_en: null` | no suma en `vencidas` |
| | forma exacta | `toEqual` de las 3 claves, `Number.isInteger` en cada una |
| | `cache-control` | `no-store` |
| | fallo de Firestore (`configurarFalloConteo`) | `500 {error:"Error interno"}`, sin detalles ni `uid` |
| `tests/semana.test.ts` | límites lunes/domingo, mes, año, lunes 00:00 exacto | lunes 00:00:00.000Z correcto |
| `tests/resumen-servicio.test.ts` | `completada_en == inicioSemana` / `−1 ms` / `null`; `vence_en` frontera | inclusivo arriba, exclusivo abajo |
| `tests/tareas-rutas.test.ts` | false→true, true→true (no se mueve), true→false (null), `completada_en` enviado por el cliente, doc legado `true` sin campo | tabla D1 |
| `tests/tareas-firestore.test.ts` | las 3 primitivas: filtros por `uid`, null, boolean, rango; colección vacía | conteos exactos |
| índice | `firestore.indexes.json` contiene I1 e I2 | verde |

Cobertura objetivo: `src/lib/semana.ts` y las primitivas de conteo al 100 %; `src/servicios/tareas.ts` ≥80 %.

---

## 6. Riesgos y mitigaciones

| # | Riesgo | Impacto | Mitigación |
|---|---|---|---|
| R1 | Índice compuesto ausente en producción | `500` opaco en el endpoint nuevo | Crear I1/I2 **antes** del deploy (F6→F8); smoke test post-deploy; revisar logs por `FAILED_PRECONDITION` (sin exponerlo al cliente) |
| R2 | Tareas completadas antes del bloque no tienen `completada_en` | `completadas_semana` subestima históricamente | Documentado; `.default(null)` evita romper el listado; backfill opcional con script Admin (fuera de alcance, requiere permiso y escritura en datos reales) |
| R3 | `GET /api/tareas` ahora incluye `completada_en` | App móvil de otro repo debe tolerar el campo | Aviso en el contrato; la app ya ignora campos no declarados en su SQLite; coordinar migración |
| R4 | Los 3 conteos no son atómicos (no hay snapshot común) | Suma transitoria incoherente bajo escritura concurrente | Aceptado: es un resumen; se documenta. No se usa transacción (añade reintentos y coste sin valor aquí) |
| R5 | `vence_en` en formato fecha se considera vencido a las 00:00 UTC | Tarea «de hoy» aparece vencida todo el día | Documentado (D5); deuda: exigir datetime en un bloque aparte |
| R6 | PUT/DELETE a `/api/tareas/resumen` caen en `[id]` y crean la tarea con id `resumen` | Datos basura si un cliente se equivoca | Fuera de alcance: se registra como deuda (reservar el slug o restringir `esquemaIdTarea` a UUID) |
| R7 | El fake de Firestore no replica semántica real (null, timestamps, índices) | Pruebas verdes con producción rota | Pruebas de ruta mockean el módulo (no el SDK) y la verificación real queda en F8 con `curl` manual; el índice tiene su propia prueba de archivo |
| R8 | 3 consultas por petición autenticada | Coste/latencia y posible abuso | `count()` cuesta ~1 lectura por 1000 entradas de índice; rate limit por ruta en el Firewall de Vercel (ya documentado en `notas-implementacion.md:85`) y `no-store` |
| R9 | Caché intermedia/CDN con conteos viejos | Números obsoletos | `respuestaJson` → `Cache-Control: no-store` + prueba |
| R10 | Cambios en fixtures rompen las 68 pruebas | Ruido en el PR | F1 actualiza `tests/ayuda/tareas-falsas.ts`, `tests/tareas-rutas.test.ts`, `tests/tareas-firestore.test.ts`, `tests/esquema-tarea.test.ts` en el mismo commit |

---

## 7. Checklist de aceptación

**Contrato**
- [ ] `GET /api/tareas/resumen` con Bearer; `uid` del token verificado, nunca de cuerpo/URL.
- [ ] 200 exacto `{ pendientes, vencidas, completadas_semana }`, enteros ≥ 0, `Cache-Control: no-store`.
- [ ] 401 `{error:"No autorizado"}` sin token o token inválido.
- [ ] 500 `{error:"Error interno"}`, sin detalles ni datos personales.
- [ ] Definiciones de las 3 métricas publicadas (vencidas ⊂ pendientes).

**Datos**
- [ ] `completada_en` lo pone **solo** el servidor; el cliente no puede fijarlo ni limpiarlo.
- [ ] false→true asigna; true→true conserva; true→false limpia a `null`; DELETE lo conserva.
- [ ] Documentos legados (sin `completada_en`) siguen listándose (`default(null)`).
- [ ] `deleted_at != null` excluido de las 3 métricas.
- [ ] Semana: lunes `00:00:00.000Z`, límite inclusivo, función pura probada.

**Firestore**
- [ ] Exactamente 3 consultas `count()`, una por métrica, en paralelo.
- [ ] Ninguna lectura de documentos; ningún `get()` de colección.
- [ ] `firestore.indexes.json` con I1 e I2 (`queryScope: COLLECTION`, orden correcto) + `firebase.json`.
- [ ] Índices creados en el proyecto (consola o deploy con permiso) antes del deploy de la ruta.

**Calidad**
- [ ] `npm run check` verde (typecheck + lint 0 warnings + prettier + Vitest).
- [ ] `npm run test:coverage` ≥80 % en `src/lib` y `src/servicios`.
- [ ] `npm run build` verde.
- [ ] Funciones ≤50 líneas, complejidad ≤10, anidación ≤3, sin `any`, sin `@ts-ignore`.
- [ ] Sin `console.*`, sin secretos, sin tocar `.env*` ni salir del repo.
- [ ] `docs/notas-implementacion.md`, `docs/pruebas-api.md`, `docs/postman-coleccion.json` y `ia/BITACORA.md` actualizados.
- [ ] Diff completo revisado y commits pequeños propuestos; **no** ejecutados sin permiso.
- [ ] Deploy y verificación manual **solo** con permiso explícito.

---

## 8. Lo que necesito de ti para arrancar

1. **D1**: ¿aprobamos `completada_en` del servidor (recomendado) o prefieres el proxy `updated_at` documentado?
2. **D2**: ¿lunes 00:00 UTC como inicio de semana?
3. **D3**: ¿contrato estrictamente de 3 campos, sin `servidor_ahora`/`inicio_semana`?
4. **F6**: ¿creas tú los índices en la consola (yo dejo el JSON y las instrucciones) o autorizas `firebase deploy --only firestore:indexes` cuando lleguemos ahí?

Con esas cuatro respuestas, el siguiente paso es F1 con su prueba en rojo. No he editado archivos, ni instalado nada, ni hecho commit ni push.