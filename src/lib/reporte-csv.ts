export type FilaCsv = Array<string | number | null | undefined>;

function escaparCelda(valor: FilaCsv[number]): string {
  const texto = valor == null ? "" : String(valor);
  return /[;"\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** CSV con separador compatible con Excel en configuraciones regionales ES. */
export function serializarCsv(filas: FilaCsv[]): string {
  return filas.map((fila) => fila.map(escaparCelda).join(";")).join("\r\n");
}

export function nombreArchivoReporte(reporte: string, fecha = new Date()): string {
  const base = reporte
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const dia = fecha.toISOString().slice(0, 10);
  return `reporte-${base || "datos"}-${dia}.csv`;
}
