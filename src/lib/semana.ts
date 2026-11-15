const DIAS_DESDE_LUNES_HASTA_DOMINGO = 6;

/**
 * Inicio de la semana ISO 8601 en UTC: el lunes a las 00:00:00.000.
 * El límite es inclusivo (`completada_en >= inicio`). No depende de la zona
 * del servidor ni del usuario: en Colombia (UTC-5) el corte local es domingo
 * a las 19:00.
 */
export function inicioDeSemanaUTC(ahora: Date): string {
  const diaDeLaSemana = ahora.getUTCDay();
  const diasDesdeLunes = (diaDeLaSemana + DIAS_DESDE_LUNES_HASTA_DOMINGO) % 7;
  const diaEnMs = Date.UTC(
    ahora.getUTCFullYear(),
    ahora.getUTCMonth(),
    ahora.getUTCDate() - diasDesdeLunes,
  );

  return new Date(diaEnMs).toISOString();
}
