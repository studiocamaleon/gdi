export type RangoAnalisisEgresos = { desde: string; hasta: string };

/** Fechas de calendario: UTC sólo se usa para aritmética, nunca como zona del taller. */
export function mesAnalisisEgresos(
  fecha: string,
  desplazamiento = 0,
): RangoAnalisisEgresos {
  const inicio = new Date(`${fecha.slice(0, 7)}-01T00:00:00Z`);
  inicio.setUTCMonth(inicio.getUTCMonth() + desplazamiento);
  const fin = new Date(inicio);
  fin.setUTCMonth(fin.getUTCMonth() + 1);
  fin.setUTCDate(0);
  return {
    desde: inicio.toISOString().slice(0, 10),
    hasta: fin.toISOString().slice(0, 10),
  };
}

export function errorRangoAnalisis({
  desde,
  hasta,
}: RangoAnalisisEgresos): string | null {
  const fechaValida = (valor: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
    const fecha = new Date(`${valor}T00:00:00Z`);
    return (
      Number.isFinite(fecha.getTime()) &&
      fecha.toISOString().slice(0, 10) === valor
    );
  };
  if (!fechaValida(desde) || !fechaValida(hasta))
    return "Completá las dos fechas con valores válidos.";
  if (desde > hasta) return "La fecha Desde debe ser anterior o igual a Hasta.";
  return null;
}

/** El presupuesto es mensual: sólo se compara cuando coincide con todo el rango. */
export function mesCompletoAnalisis(
  rango: RangoAnalisisEgresos,
): string | null {
  if (errorRangoAnalisis(rango)) return null;
  const mes = mesAnalisisEgresos(rango.desde);
  return rango.desde === mes.desde && rango.hasta === mes.hasta
    ? rango.desde.slice(0, 7)
    : null;
}
