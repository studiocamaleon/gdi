import { CATALOGO, type PlantillaCanonica } from './catalogo';
import type { PlantillaRemota } from './wati.client';

/**
 * El estado de las plantillas de un tenant, cruzando el catálogo canónico de
 * Grafo con lo que hay de verdad en su cuenta de Wati.
 *
 * Son TRES grupos y no dos, porque un tenant que ya usaba Wati llega con sus
 * propias plantillas escritas a mano — que hacen el mismo trabajo que las
 * nuestras y no se pueden ignorar. Ver docs/notificaciones-whatsapp-catalogo.md §2
 */

/**
 * Lo que devuelve Meta, más `SIN_SOMETER` que es nuestro.
 *
 * Queda como `string` a propósito: Meta agrega estados y un valor
 * desconocido tiene que llegar a la pantalla tal cual, no romper el listado.
 * Los conocidos son APPROVED, PENDING, REJECTED, PAUSED y DISABLED.
 */
export type EstadoPlantilla = string;

export type PlantillaGestionada = {
  evento: string;
  codigo: string;
  titulo: string;
  cuando: string;
  activoPorDefecto: boolean;
  /** La categoría que PEDIMOS. */
  categoriaPedida: string;
  /** La que Meta efectivamente asignó. Distinta = el texto se leyó como promoción. */
  categoriaAsignada: string | null;
  estado: EstadoPlantilla;
  calidad: string | null;
  idRemoto: string | null;
  parametros: string[];
  cuerpo: string;
};

export type PlantillaPropia = {
  codigo: string;
  estado: string;
  categoria: string | null;
  idioma: string | null;
  calidad: string | null;
  parametros: string[];
  cuerpo: string | null;
  footer: string | null;
};

export type EstadoPlantillas = {
  gestionadas: PlantillaGestionada[];
  propias: PlantillaPropia[];
  resumen: {
    total: number;
    aprobadas: number;
    pendientes: number;
    conProblema: number;
    sinSometer: number;
    recategorizadas: number;
  };
};

/**
 * Estados que piden acción del usuario.
 *
 * `DRAFT` está acá y no entre los buenos: Wati crea las plantillas de la API
 * como borrador y **no las manda a Meta**. Una plantilla en DRAFT parece
 * hecha en el listado y no sirve para notificar a nadie, así que cuenta como
 * problema hasta que alguien la envíe a aprobación.
 */
const CON_PROBLEMA = new Set(['REJECTED', 'PAUSED', 'DISABLED', 'DRAFT']);

export function cruzar(remotas: PlantillaRemota[]): EstadoPlantillas {
  const porNombre = new Map(remotas.map((r) => [r.nombre, r]));

  const gestionadas = CATALOGO.map((c) => armar(c, porNombre.get(c.codigo)));

  // Todo lo que no sea del catálogo es del tenant. Se muestra igual: es la
  // única forma de que entienda por qué tiene dos plantillas parecidas.
  const propias = remotas
    .filter((r) => !CATALOGO.some((c) => c.codigo === r.nombre))
    .map(
      (r): PlantillaPropia => ({
        codigo: r.nombre,
        estado: r.estado,
        categoria: r.categoria,
        idioma: r.idioma,
        calidad: r.calidad,
        parametros: r.parametros,
        cuerpo: r.cuerpo,
        footer: r.footer,
      }),
    );

  return {
    gestionadas,
    propias,
    resumen: {
      total: gestionadas.length,
      aprobadas: gestionadas.filter((g) => g.estado === 'APPROVED').length,
      pendientes: gestionadas.filter((g) => g.estado === 'PENDING').length,
      conProblema: gestionadas.filter((g) => CON_PROBLEMA.has(g.estado)).length,
      sinSometer: gestionadas.filter((g) => g.estado === 'SIN_SOMETER').length,
      // La señal que justifica probar contra una cuenta real antes de soltar
      // el catálogo: pedimos UTILITY y Meta nos devolvió MARKETING.
      recategorizadas: gestionadas.filter(
        (g) => g.categoriaAsignada && g.categoriaAsignada !== g.categoriaPedida,
      ).length,
    },
  };
}

function armar(
  c: PlantillaCanonica,
  remota: PlantillaRemota | undefined,
): PlantillaGestionada {
  return {
    evento: c.evento,
    codigo: c.codigo,
    titulo: c.titulo,
    cuando: c.cuando,
    activoPorDefecto: c.activoPorDefecto,
    categoriaPedida: c.categoria,
    categoriaAsignada: remota?.categoria ?? null,
    estado: remota?.estado ?? 'SIN_SOMETER',
    calidad: remota?.calidad ?? null,
    idRemoto: remota?.id ?? null,
    // Los nombres los manda el catálogo: son los que Grafo sabe completar.
    // Los de la remota sólo sirven para detectar que quedó desalineada.
    parametros: c.parametros.map((p) => p.nombre),
    cuerpo: c.cuerpo,
  };
}
