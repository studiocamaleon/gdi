import { sumarDiasHabiles, type SimulacionItem } from "./flujo-produccion";
import { claveFechaEnZona, partesEnZona, ZONA_DEFAULT } from "./zona";

type Opciones = {
  margenDias?: number;
  noLaborables?: Set<string>;
  zona?: string;
  ahora?: Date;
};

/** Siempre muestra la fecha absoluta: «hoy» nunca reemplaza al día concreto. */
export function fechaHoraEta(
  fecha: Date,
  { zona = ZONA_DEFAULT, ahora = new Date() }: Opciones = {},
): string {
  const p = partesEnZona(fecha, zona);
  const hoy = claveFechaEnZona(fecha, zona) === claveFechaEnZona(ahora, zona);
  return `${hoy ? "hoy · " : ""}${String(p.d).padStart(2, "0")}/${String(p.m).padStart(2, "0")}/${p.y} ${String(p.hh).padStart(2, "0")}:${String(p.mm).padStart(2, "0")}`;
}

export function describirEta(
  eta: SimulacionItem | null | undefined,
  fechaElegida: string | null,
  opts: Opciones = {},
) {
  if (!eta) return null;
  const { zona = ZONA_DEFAULT, margenDias = 0 } = opts;
  const fin = eta.finEstimado;
  const sinFecha = eta.sinEstimar || !fin || !Number.isFinite(fin.getTime());
  const sugerida =
    !sinFecha && margenDias > 0
      ? sumarDiasHabiles(fin, margenDias, opts.noLaborables, zona)
      : null;
  const elegida = fechaElegida?.slice(0, 10);
  const nivel: "ok" | "sin-margen" | "tarde" =
    !sinFecha && elegida && elegida < claveFechaEnZona(fin, zona)
      ? "tarde"
      : elegida && sugerida && elegida < claveFechaEnZona(sugerida, zona)
        ? "sin-margen"
        : "ok";
  const aprox = eta.parcial || eta.asumeDesbloqueo || sinFecha;
  const motivo = [
    eta.motivoSinEstimar,
    eta.parcial ? "Falta confirmar estación, equipo, atención del operario o calendario para parte del trabajo." : null,
    eta.asumeDesbloqueo
      ? "Supone que los trabajos bloqueados se habilitan ahora."
      : null,
    sinFecha && !eta.motivoSinEstimar
      ? "Hay trabajo sin duración o sin una ventana disponible para estimar el fin completo."
      : null,
  ]
    .filter(Boolean)
    .join(" ");
  return {
    // Fechas de calendario del taller para las vistas que no muestran horas.
    fechaProduccion: sinFecha ? null : claveFechaEnZona(fin, zona),
    fechaSugerida: sinFecha ? null : claveFechaEnZona(sugerida ?? fin, zona),
    margenDias,
    etiqueta: sinFecha
      ? "Sin estimación completa"
      : `${aprox ? "~" : "≈"} ${fechaHoraEta(fin, opts)}`,
    sugeridaEtiqueta: sugerida ? fechaHoraEta(sugerida, opts) : null,
    margenEtiqueta: `${margenDias} ${margenDias === 1 ? "día hábil" : "días hábiles"} de margen`,
    nivel,
    aprox,
    motivo,
    sinFecha,
  };
}

/** La recomendación usa el día del taller; una ETA incompleta no fija promesas. */
export function fechaRecomendadaEta(
  eta: SimulacionItem | null | undefined,
  opts: Opciones = {},
): string | null {
  if (
    !eta?.finEstimado ||
    eta.sinEstimar ||
    !Number.isFinite(eta.finEstimado.getTime())
  )
    return null;
  const zona = opts.zona ?? ZONA_DEFAULT;
  return claveFechaEnZona(
    sumarDiasHabiles(
      eta.finEstimado,
      opts.margenDias ?? 0,
      opts.noLaborables,
      zona,
    ),
    zona,
  );
}

/** La promesa de la OT es la última entrega individual, cada una con su margen. */
export function describirEtaOrden(
  items: Array<{ eta: SimulacionItem | null | undefined; margenDias: number }>,
  fechaElegida: string | null,
  opts: Omit<Opciones, "margenDias"> = {},
) {
  if (!items.length || items.every((i) => !i.eta)) return null;
  const zona = opts.zona ?? ZONA_DEFAULT;
  const sinEstimar = items.some(
    ({ eta }) =>
      !eta ||
      eta.sinEstimar ||
      !eta.finEstimado ||
      !Number.isFinite(eta.finEstimado.getTime()),
  );
  const etas = items.flatMap(({ eta }) => (eta ? [eta] : []));
  const fin = sinEstimar
    ? null
    : new Date(Math.max(...etas.map((e) => +e.finEstimado!)));
  const entrega = sinEstimar
    ? null
    : new Date(
        Math.max(
          ...items.map(
            ({ eta, margenDias }) =>
              +sumarDiasHabiles(
                eta!.finEstimado!,
                margenDias,
                opts.noLaborables,
                zona,
              ),
          ),
        ),
      );
  const margenMax = Math.max(...items.map((i) => i.margenDias));
  const margenMin = Math.min(...items.map((i) => i.margenDias));
  const resumen = describirEta(
    {
      finEstimado: fin,
      sinEstimar,
      parcial: etas.some((e) => e.parcial),
      asumeDesbloqueo: etas.some((e) => e.asumeDesbloqueo),
      motivoSinEstimar: [
        ...new Set(etas.map((e) => e.motivoSinEstimar).filter(Boolean)),
      ].join(" "),
    },
    fechaElegida,
    opts,
  )!;
  const sugerida = entrega ? claveFechaEnZona(entrega, zona) : null;
  const elegida = fechaElegida?.slice(0, 10);
  return {
    ...resumen,
    fechaSugerida: sugerida,
    sugeridaEtiqueta:
      entrega && margenMax > 0 ? fechaHoraEta(entrega, opts) : null,
    margenDias: margenMax,
    margenEtiqueta:
      margenMin === margenMax
        ? `${margenMax} ${margenMax === 1 ? "día hábil" : "días hábiles"} de margen`
        : `Según producto: ${margenMin}–${margenMax} días hábiles`,
    nivel:
      resumen.nivel === "tarde"
        ? ("tarde" as const)
        : elegida && sugerida && elegida < sugerida
          ? ("sin-margen" as const)
          : ("ok" as const),
  };
}
