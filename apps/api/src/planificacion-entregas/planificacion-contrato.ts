import type { AlternativaReprogramada } from './reprogramacion-escenarios';
import { createHash } from 'node:crypto';
import type { CotizarInput } from '../motor-universal/tipos';
import type { ContextoPiloto } from '../eta/planificacion/prototipo-entregas';
import type { planificarCotizacionesF6 } from '../eta/planificacion/adaptador-cotizacion';
import type { SolicitarPlanEntregaDto } from './planificacion.dto';
import type { RevisionLayoutsEntregas } from '../eta/planificacion/layouts-entregas';

/** Canonización local: hashes de datos, no firmas de autenticación. */
export function huellaPlan(
  valor: unknown,
  normalizar: (v: unknown) => unknown = (v) => v,
): string {
  return createHash('sha256')
    .update(
      JSON.stringify(valor, (_, valor: unknown) => {
        const v = normalizar(valor);
        return v &&
          typeof v === 'object' &&
          !Array.isArray(v) &&
          !(v instanceof Date)
          ? Object.fromEntries(
              Object.entries(v).sort(([a], [b]) => a.localeCompare(b)),
            )
          : v;
      }),
    )
    .digest('hex');
}

export type SolicitudPlanCongelada = {
  schemaVersion: 1;
  input: CotizarInput;
  recetaRevisionId: string | null;
  recetaHuella: string | null;
  entregas: SolicitarPlanEntregaDto['entregas'];
  porEntrega?: boolean;
};

type Adaptacion = ReturnType<typeof planificarCotizacionesF6>;
/** Persiste sólo resultados de planificación, sin los snapshots CAD por cantidad. */
export type ResultadoPlanGuardado = {
  schemaVersion: 1;
  calculadaEl: string;
  zona: string;
  margenDiasHabiles: number;
  configuracionHuella: string;
  fuentes: Adaptacion['fuentes'];
  operaciones: Adaptacion['entrada']['operaciones'];
  resultado: Omit<Adaptacion['resultado'], 'alternativas'> & {
    alternativas: AlternativaReprogramada[];
  };
  reprogramacion?: {
    trabajos: { id: string; numero: string }[];
    excluidas: string[];
    evaluadas: number;
    motivo: string | null;
  };
  detalles: Adaptacion['detalles'];
  politica?: 'POR_ENTREGA';
  nesting?: RevisionLayoutsEntregas;
};

export function huellaContextoPlan(
  t: ContextoPiloto,
  margenDiasHabiles: number,
) {
  // El paso del tiempo se controla con calculadaEl y una nueva simulación. La
  // huella detecta cambios de datos aunque dos lecturas sucedan en el mismo minuto.
  return huellaPlan({
    ruteoEstaciones: 'personal-fijo-en-agenda-v9',
    zona: t.zona,
    margenDiasHabiles,
    tiempoEntrePasosMin: t.tiempoEntrePasosMin,
    items: [...t.items].sort((a, b) => a.id.localeCompare(b.id)),
    estaciones: [...t.estaciones].sort((a, b) => a.id.localeCompare(b.id)),
    medianas: [...t.medianas].sort(([a], [b]) => a.localeCompare(b)),
    noLaborables: [...(t.noLaborables ?? [])].sort(),
  });
}

export function serializarPlan(
  resultado: Adaptacion,
  zona: string,
  margen: number,
  ahora: Date,
): ResultadoPlanGuardado {
  // JSON convierte las fechas de la traza a UTC. Nada de Map/Set cruza la API.
  return JSON.parse(
    JSON.stringify({
      schemaVersion: 1,
      calculadaEl: ahora.toISOString(),
      zona,
      margenDiasHabiles: margen,
      configuracionHuella: resultado.configuracionHuella,
      fuentes: resultado.fuentes,
      operaciones: resultado.entrada.operaciones,
      resultado: resultado.resultado,
      detalles: resultado.detalles,
    }),
  ) as ResultadoPlanGuardado;
}

/** Fuente estable del plan previo a la OT; updatedAt cubre los inputs compactos. */
export function huellaOrigenCotizacion(c: {
  id: string;
  updatedAt: Date;
  cantidad: unknown;
  recetaRevisionId: string | null;
  recetaHuella: string | null;
  cotizacion: { clienteId: string | null };
}) {
  return huellaPlan({
    cotizacionItemId: c.id,
    actualizadaEl: c.updatedAt,
    cantidad: Number(c.cantidad),
    recetaRevisionId: c.recetaRevisionId,
    recetaHuella: c.recetaHuella,
    clienteId: c.cotizacion.clienteId,
  });
}
