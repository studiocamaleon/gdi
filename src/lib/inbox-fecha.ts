/** Fecha breve de la lista, según el día calendario de la empresa (incluye DST). */
export function fechaConversacionInbox(
  iso: string,
  ahora: number,
  zonaHoraria: string,
) {
  const fecha = new Date(iso);
  if (!Number.isFinite(fecha.getTime())) return "";
  const dia = (d: Date) => {
    const partes = new Intl.DateTimeFormat("en-US", {
      timeZone: zonaHoraria,
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).formatToParts(d);
    const n = (tipo: string) =>
      Number(partes.find((p) => p.type === tipo)?.value);
    return Date.UTC(n("year"), n("month") - 1, n("day")) / 86400000;
  };
  const diferencia = dia(new Date(ahora)) - dia(fecha);
  if (diferencia === 1) return "Ayer";
  const opciones: Intl.DateTimeFormatOptions =
    diferencia === 0
      ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }
      : diferencia > 1 && diferencia < 7
        ? { weekday: "long" }
        : { day: "numeric", month: "numeric", year: "2-digit" };
  const texto = new Intl.DateTimeFormat("es-AR", {
    ...opciones,
    timeZone: zonaHoraria,
  }).format(fecha);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
