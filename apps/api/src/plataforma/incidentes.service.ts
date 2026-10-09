import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { configurarMonitoreo } from '../common/observabilidad-segura';
import { cerrarMonitoreo, reportarFallo } from '../common/observabilidad';

import type {
  FiltroIncidentes,
  Incidente,
  ResumenIncidentes,
} from '../common/incidentes-compartido';
export type {
  FiltroIncidentes,
  Incidente,
  ResumenIncidentes,
} from '../common/incidentes-compartido';

const objeto = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
const fecha = (v: unknown) =>
  typeof v === 'string' && Number.isFinite(Date.parse(v))
    ? new Date(v).toISOString()
    : null;
const numero = (v: unknown) =>
  (typeof v === 'number' || (typeof v === 'string' && /^\d+$/.test(v))) &&
  Number.isSafeInteger(Number(v)) &&
  Number(v) >= 0
    ? Number(v)
    : null;

/** Nunca reenviar la respuesta completa: puede incluir correos de asignación. */
export function proyectarIncidente(
  value: unknown,
  org: string,
): Incidente | null {
  const v = objeto(value),
    proyecto = objeto(v.project).slug;
  if (
    typeof v.id !== 'string' ||
    !/^\d{1,24}$/.test(v.id) ||
    (proyecto !== 'grafoprint-api' && proyecto !== 'grafoprint-web')
  )
    return null;
  const filtrado = objeto(v.filtered);
  const esPrueba = String(v.title).includes('Prueba de monitoreo de Grafo');
  return {
    id: v.id,
    referencia:
      typeof v.shortId === 'string' &&
      /^GRAFOPRINT-(API|WEB)-[A-Z0-9]+$/.test(v.shortId)
        ? v.shortId
        : `INC-${v.id}`,
    proyecto,
    titulo: esPrueba ? 'Prueba de monitoreo de Grafo' : 'Fallo de aplicación',
    estado:
      v.status === 'resolved'
        ? 'resuelto'
        : v.status === 'ignored'
          ? 'archivado'
          : 'abierto',
    prioridad:
      v.priority === 'high' ? 'alta' : v.priority === 'low' ? 'baja' : 'media',
    // El total histórico puede sumar otros entornos; no presentarlo como el período elegido.
    repeticiones: numero(filtrado.count),
    ultimaVez: fecha(filtrado.lastSeen ?? v.lastSeen),
    enlace: `https://${org}.sentry.io/issues/${v.id}/`,
  };
}

@Injectable()
export class IncidentesService {
  private cache = new Map<
    string,
    { hasta: number; datos: ResumenIncidentes }
  >();
  private pendientes = new Map<string, Promise<ResumenIncidentes>>();

  async listar(filtro: FiltroIncidentes): Promise<ResumenIncidentes> {
    const org = process.env.SENTRY_ORG || 'grafoprint';
    const token = process.env.SENTRY_READ_TOKEN;
    const enlace = `https://${/^[a-z0-9-]+$/.test(org) ? org : 'grafoprint'}.sentry.io/issues/`;
    if (!token || !/^[a-z0-9-]{1,80}$/.test(org)) {
      return {
        conexion: 'sin_configurar',
        actualizadoEl: null,
        incidentes: [],
        hayMas: false,
        enlace,
      };
    }
    const clave = JSON.stringify(filtro),
      anterior = this.cache.get(clave);
    if (anterior && anterior.hasta > Date.now()) return anterior.datos;
    const pendiente = this.pendientes.get(clave);
    if (pendiente) return pendiente;
    const consulta = this.consultar(filtro, org, token, enlace, anterior?.datos)
      .then((datos) => {
        this.cache.set(clave, { hasta: Date.now() + 30_000, datos });
        return datos;
      })
      .finally(() => this.pendientes.delete(clave));
    this.pendientes.set(clave, consulta);
    return consulta;
  }

  private async consultar(
    filtro: FiltroIncidentes,
    org: string,
    token: string,
    enlace: string,
    anterior?: ResumenIncidentes,
  ): Promise<ResumenIncidentes> {
    const query = [
      filtro.estado === 'abiertos'
        ? 'is:unresolved'
        : filtro.estado === 'resueltos'
          ? 'is:resolved'
          : '',
      filtro.pruebas === 'no' ? '!operacion:prueba' : '',
    ]
      .filter(Boolean)
      .join(' ');
    const url = new URL(
      `https://us.sentry.io/api/0/organizations/${org}/issues/`,
    );
    url.search = new URLSearchParams({
      environment: filtro.entorno,
      statsPeriod: filtro.periodo,
      query,
      sort: 'date',
      limit: '50',
    }).toString();
    url.searchParams.append('project', 'grafoprint-web');
    url.searchParams.append('project', 'grafoprint-api');
    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(5_000),
        redirect: 'error',
      });
      if (!response.ok) throw new Error('Monitor no disponible');
      const raw: unknown = await response.json();
      if (!Array.isArray(raw)) throw new Error('Respuesta no válida');
      const incidentes = raw.slice(0, 50).flatMap((fila) => {
        const incidente = proyectarIncidente(fila, org);
        return incidente ? [incidente] : [];
      });
      const hayMas = (response.headers.get('link') ?? '')
        .split(',')
        .some(
          (link) =>
            link.includes('rel="next"') && link.includes('results="true"'),
        );
      return {
        conexion: 'conectado',
        actualizadoEl: new Date().toISOString(),
        incidentes,
        hayMas,
        enlace,
      };
    } catch {
      // Sin contenido del proveedor, claves ni errores de red en logs o respuesta.
      return {
        conexion: 'no_disponible',
        actualizadoEl: anterior?.actualizadoEl ?? null,
        incidentes: anterior?.incidentes ?? [],
        hayMas: anterior?.hayMas ?? false,
        enlace,
      };
    }
  }

  async probar() {
    if (!configurarMonitoreo(process.env))
      throw new ServiceUnavailableException(
        'El envío de errores todavía no está habilitado en este entorno.',
      );
    reportarFallo(new Error('Ensayo ficticio de Plataforma'), {
      operacion: 'prueba',
      area: 'plataforma',
    });
    await cerrarMonitoreo();
    return {
      mensaje:
        'Prueba enviada al monitor. Su recepción se confirma cuando aparece en el listado de pruebas.',
    };
  }
}
