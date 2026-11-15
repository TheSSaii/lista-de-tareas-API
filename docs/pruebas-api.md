# Pruebas manuales de la API desplegada

> Ejecutar en una terminal propia, no desde el agente: el guard del proyecto
> bloquea `curl` a propósito. No pegues tokens ni claves en el chat.

## Preparación

Copia el dominio desde Vercel → Project → Domains y expórtalo:

```bash
export API_URL="https://<tu-proyecto>.vercel.app"
export EMAIL="prueba+$(date +%s)@example.com"
export PASSWORD="ClaveSegura123"
```

`python3 -m json.tool` viene con macOS y sirve para formatear. Si tienes `jq`,
puedes reemplazarlo por `jq`.

## 1. Health (no toca Firebase)

```bash
curl -sS -i "$API_URL/api/health"
```

Esperado: `200` y `{"ok":true}`. Si falla, el deployment no está sirviendo las
rutas; revisa Vercel → Deployments → Functions.

## 2. Registro

```bash
REGISTRO=$(curl -sS -X POST "$API_URL/api/auth/registro" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

echo "$REGISTRO" | python3 -m json.tool
```

Esperado: `201` con `token`, `refreshToken`, `expiraEnSeg` y
`usuario: { id, email }`.

```bash
export TOKEN=$(echo "$REGISTRO" | python3 -c 'import sys,json; print(json.load(sys.stdin)["token"])')
export REFRESH=$(echo "$REGISTRO" | python3 -c 'import sys,json; print(json.load(sys.stdin)["refreshToken"])')
export UID=$(echo "$REGISTRO" | python3 -c 'import sys,json; print(json.load(sys.stdin)["usuario"]["id"])')
```

Si devuelve `500`: revisa `FIREBASE_WEB_API_KEY` y que Email/Password esté
habilitado. Si devuelve `409`, ese correo ya existe.

## 3. Perfil

```bash
curl -sS "$API_URL/api/auth/yo" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

Esperado: `200` con `usuario: { id, email }`. Si devuelve `500`, revisa
`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` y `FIREBASE_PRIVATE_KEY`.

## 4. Crear una tarea (PUT idempotente)

```bash
export TAREA_ID=$(python3 -c 'import uuid; print(uuid.uuid4())')

curl -sS -X PUT "$API_URL/api/tareas/$TAREA_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "titulo": "Prueba desde consola",
    "descripcion": "Tarea de prueba",
    "prioridad": 2,
    "vence_en": "2026-12-01T15:00:00.000Z",
    "completada": false
  }' | python3 -m json.tool
```

Esperado: `200` con `id`, los campos enviados y `created_at`, `updated_at`,
`deleted_at: null`. Repite el mismo PUT y verifica que `created_at` no cambia.

## 5. Listar

```bash
curl -sS "$API_URL/api/tareas" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

Esperado: `200` con `items` y `servidor_ahora`. El filtro incluye borrados
lógicos.

```bash
curl -sS "$API_URL/api/tareas?since=2026-11-01T00:00:00.000Z" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

## 6. Editar/completar

```bash
curl -sS -X PUT "$API_URL/api/tareas/$TAREA_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "titulo": "Prueba editada",
    "descripcion": null,
    "prioridad": 1,
    "vence_en": "2026-12-02T15:00:00.000Z",
    "completada": true
  }' | python3 -m json.tool
```

## 7. Borrado lógico

```bash
curl -sS -X DELETE "$API_URL/api/tareas/$TAREA_ID" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

Esperado: `200` y `{"ok":true}`. Un segundo DELETE del mismo id también debe
responder `200` (idempotente). Un id inexistente debe dar `404`.

```bash
curl -sS -i -X DELETE "$API_URL/api/tareas/00000000-0000-0000-0000-000000000000" \
  -H "Authorization: Bearer $TOKEN"
```

## 8. Login y refresh

```bash
curl -sS -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | python3 -m json.tool

curl -sS -X POST "$API_URL/api/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH\"}" | python3 -m json.tool
```

El refresh debe devolver `token`, `refreshToken` y `expiraEnSeg`, sin `usuario`.

## 9. Errores esperados

```bash
# 401 sin token
curl -sS -i "$API_URL/api/tareas"

# 401 con token inválido
curl -sS -i "$API_URL/api/tareas" -H "Authorization: Bearer token-invalido"

# 400 por título corto y prioridad inválida
curl -sS -i -X PUT "$API_URL/api/tareas/$TAREA_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"titulo":"ab","prioridad":9}'

# 409 por correo repetido
curl -sS -i -X POST "$API_URL/api/auth/registro" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}"

# 401 por contraseña incorrecta (mismo cuerpo que correo inexistente)
curl -sS -i -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"ClaveIncorrecta123\"}"
```

Los `500` siempre deben ser exactamente `{"error":"Error interno"}`, sin
detalles ni datos personales.

## 10. Verificar en Firestore

En Firebase Console → Firestore Database debe aparecer:

```text
usuarios/{uid}/tarea/{TAREA_ID}
```

Con `titulo`, `descripcion`, `prioridad`, `vence_en`, `completada`,
`created_at`, `updated_at` y `deleted_at`. No debe aparecer `notificacion_id`.
