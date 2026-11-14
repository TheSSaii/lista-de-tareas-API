# Bitácora de IA

Formato: propósito · evidencia · validación · decisión.

## 2026-11-14 · Configuración inicial
- **Propósito:** bloquear lectura de secretos y salida del repositorio antes de generar código.
- **Evidencia:** `opencode.jsonc`, `.opencode/plugins/guard/`, `npm run check:ia` (16/16).
- **Validación:** pruebas 1, 2, 4, 8 y 9 de `ia/PRUEBAS-CONTENCION.md`.
- **Decisión:** los `deny` van al final porque OpenCode usa «gana la última regla».
  No existe excepción para `.env.example`: el archivo se versiona, pero la IA no lo lee ni lo escribe.
- **Decisión:** sin WSL ni sandbox de SO; el límite se documenta en `ia/CONFIGURACION.md`.
