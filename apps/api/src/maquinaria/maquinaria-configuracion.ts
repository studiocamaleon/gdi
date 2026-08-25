import {
  EstadoConfiguracionMaquinaDto,
  PlantillaMaquinariaDto,
  TipoComponenteDesgasteMaquinaDto,
  UnidadDesgasteMaquinaDto,
  type UpsertMaquinaDto,
} from './dto/upsert-maquina.dto';
import {
  getConsumableChannelFromDetail,
  getPerfilConsumableChannels,
  PRINTER_TEMPLATES_WITH_MACHINE_CONSUMABLES,
  requiredConsumableChannelsFromColorMode,
} from './consumibles-impresion';
import { getMissingMachineDataByTemplate } from './maquinaria-template-machine-rules';
import { getPerfilOperativoConfigurationIssues } from './maquinaria-template-profile-rules';

export type MaquinaConfiguracionFaltante = {
  codigo: string;
  seccion: 'descripcion' | 'ajustes';
  mensaje: string;
  campo?: string;
  perfilId?: string;
};

export type MaquinaDiagnosticoConfiguracion = {
  estado: EstadoConfiguracionMaquinaDto;
  faltantes: MaquinaConfiguracionFaltante[];
};

const FIELD_LABELS: Record<string, string> = {
  nombre: 'Nombre',
  plantaId: 'Planta',
  plantilla: 'Tipo de máquina',
  estado: 'Estado operativo',
  unidadProduccionPrincipal: 'Unidad de producción',
  anchoUtil: 'Ancho útil',
  largoUtil: 'Largo útil',
  altoUtil: 'Alto útil',
  tecnologia: 'Tecnología',
  geometria: 'Geometría',
  margenesNoImprimiblesMm: 'Márgenes no imprimibles',
  modosOperacionSoportados: 'Modos de operación soportados',
  margenesDesperdicioMm: 'Márgenes de desperdicio',
  margenEntrePliegosMm: 'Margen entre pliegos',
  productivityValue: 'Productividad',
  productivityUnit: 'Unidad de productividad',
  caras: 'Caras',
  gramajeMaxGr: 'Gramaje máximo',
  pliegosMaxPorTanda: 'Pliegos por tanda',
  tiempoPorCorteSeg: 'Tiempo por corte',
  tipoTrabajo: 'Tipo de trabajo',
  calidad: 'Calidad',
  tipoOperacion: 'Operación',
  material: 'Material',
  espesorMinMm: 'Espesor mínimo',
  espesorMaxMm: 'Espesor máximo',
  tipoAnillo: 'Tipo de anillo',
  tiempoPrensadoSeg: 'Tiempo de planchado',
};

const WEAR_REQUIRED_TEMPLATES = new Set<PlantillaMaquinariaDto>([
  PlantillaMaquinariaDto.impresora_laser,
  PlantillaMaquinariaDto.plotter_cad,
  PlantillaMaquinariaDto.router_cnc,
  PlantillaMaquinariaDto.mesa_de_corte,
  PlantillaMaquinariaDto.impresora_3d,
]);

const channelLabel = (channel: string) =>
  ({
    negro: 'negro',
    cyan: 'cyan',
    magenta: 'magenta',
    amarillo: 'amarillo',
    blanco: 'blanco',
    barniz: 'barniz',
    primer: 'primer',
  })[channel] ?? channel;

function baseIssues(payload: UpsertMaquinaDto) {
  const required: Array<[keyof UpsertMaquinaDto, string]> = [
    ['nombre', 'Nombre'],
    ['plantaId', 'Planta'],
    ['plantilla', 'Tipo de máquina'],
    ['estado', 'Estado operativo'],
    ['unidadProduccionPrincipal', 'Unidad de producción'],
  ];
  return required
    .filter(([key]) => {
      const value = payload[key];
      return value === null || value === undefined || value === '';
    })
    .map(([key, label]) => ({
      codigo: `base.${String(key)}`,
      seccion: 'descripcion' as const,
      campo: String(key),
      mensaje: `Completá ${label}.`,
    }));
}

export function getMaquinaDiagnosticoConfiguracion(
  payload: UpsertMaquinaDto,
): MaquinaDiagnosticoConfiguracion {
  const faltantes: MaquinaConfiguracionFaltante[] = baseIssues(payload);
  if (faltantes.length > 0) {
    return { estado: EstadoConfiguracionMaquinaDto.borrador, faltantes };
  }

  for (const fieldKey of getMissingMachineDataByTemplate(payload)) {
    faltantes.push({
      codigo: `maquina.${fieldKey}`,
      seccion: 'ajustes',
      campo: fieldKey,
      mensaje: `Completá ${FIELD_LABELS[fieldKey] ?? fieldKey}.`,
    });
  }

  const perfilesActivos = payload.perfilesOperativos.filter(
    (perfil) => perfil.activo,
  );
  if (perfilesActivos.length === 0) {
    faltantes.push({
      codigo: 'perfiles.sin_activos',
      seccion: 'ajustes',
      mensaje: 'Agregá al menos un perfil operativo activo.',
    });
  }

  for (const perfil of perfilesActivos) {
    const perfilNombre = perfil.nombre.trim() || 'Sin nombre';
    const issues = getPerfilOperativoConfigurationIssues(
      payload.plantilla,
      perfil,
      payload.parametrosTecnicos,
    );
    for (const issue of issues) {
      if (issue.tipo === 'campo') {
        faltantes.push({
          codigo: `perfil.${perfil.id ?? perfilNombre}.${issue.fieldKey}`,
          seccion: 'ajustes',
          campo: issue.fieldKey,
          perfilId: perfil.id,
          mensaje: `Perfil “${perfilNombre}”: completá ${FIELD_LABELS[issue.fieldKey] ?? issue.fieldKey}.`,
        });
      } else if (issue.tipo === 'tipo_perfil') {
        faltantes.push({
          codigo: `perfil.${perfil.id ?? perfilNombre}.tipo`,
          seccion: 'ajustes',
          perfilId: perfil.id,
          mensaje: `Perfil “${perfilNombre}”: el tipo de perfil no corresponde a esta máquina.`,
        });
      } else if (issue.tipo === 'modo') {
        faltantes.push({
          codigo: `perfil.${perfil.id ?? perfilNombre}.modo`,
          seccion: 'ajustes',
          perfilId: perfil.id,
          mensaje: `Perfil “${perfilNombre}”: indicá el modo de trabajo.`,
        });
      }
    }
  }

  addConsumableIssues(payload, faltantes);
  addWearIssues(payload, faltantes);

  return {
    estado:
      faltantes.length === 0
        ? EstadoConfiguracionMaquinaDto.lista
        : EstadoConfiguracionMaquinaDto.incompleta,
    faltantes,
  };
}

function addConsumableIssues(
  payload: UpsertMaquinaDto,
  faltantes: MaquinaConfiguracionFaltante[],
) {
  if (!PRINTER_TEMPLATES_WITH_MACHINE_CONSUMABLES.has(payload.plantilla)) {
    return;
  }
  const activos = payload.consumibles.filter((item) => item.activo);

  if (payload.plantilla === PlantillaMaquinariaDto.impresora_laser) {
    const fromMachine = requiredConsumableChannelsFromColorMode(
      payload.parametrosTecnicos?.coloresSoportados ??
        payload.parametrosTecnicos?.configuracionColor ??
        payload.parametrosTecnicos?.configuracionCanales,
    );
    const channels =
      fromMachine.length > 0
        ? fromMachine
        : Array.from(
            new Set(
              payload.perfilesOperativos
                .filter((item) => item.activo)
                .flatMap((perfil) =>
                  getPerfilConsumableChannels(
                    perfil.detalle ?? {},
                    payload.parametrosTecnicos ?? {},
                  ),
                ),
            ),
          );
    if (channels.length === 0) {
      faltantes.push({
        codigo: 'consumibles.canales',
        seccion: 'ajustes',
        mensaje:
          'Indicá los colores soportados para determinar qué consumibles necesita la máquina.',
      });
      return;
    }
    for (const channel of channels) {
      const valid = activos.some(
        (item) =>
          getConsumableChannelFromDetail(item.detalle ?? {}) === channel &&
          Boolean(item.materiaPrimaVarianteId) &&
          Number(item.consumoBase ?? 0) > 0,
      );
      if (!valid) {
        faltantes.push({
          codigo: `consumibles.${channel}`,
          seccion: 'ajustes',
          mensaje: `Configurá el consumible ${channelLabel(channel)} con material y consumo mayor que cero.`,
        });
      }
    }
    return;
  }

  for (const perfil of payload.perfilesOperativos.filter(
    (item) => item.activo,
  )) {
    const channels = getPerfilConsumableChannels(
      perfil.detalle ?? {},
      payload.parametrosTecnicos ?? {},
    );
    if (channels.length === 0) {
      faltantes.push({
        codigo: `consumibles.${perfil.id ?? perfil.nombre}.canales`,
        seccion: 'ajustes',
        perfilId: perfil.id,
        mensaje: `Perfil “${perfil.nombre}”: indicá los colores para configurar sus consumibles.`,
      });
      continue;
    }
    for (const channel of channels) {
      const valid = activos.some(
        (item) =>
          item.perfilOperativoId === perfil.id &&
          getConsumableChannelFromDetail(item.detalle ?? {}) === channel &&
          Boolean(item.materiaPrimaVarianteId) &&
          Number(item.consumoBase ?? 0) > 0,
      );
      if (!valid) {
        faltantes.push({
          codigo: `consumibles.${perfil.id ?? perfil.nombre}.${channel}`,
          seccion: 'ajustes',
          perfilId: perfil.id,
          mensaje: `Perfil “${perfil.nombre}”: configurá el consumible ${channelLabel(channel)} con material y consumo mayor que cero.`,
        });
      }
    }
  }
}

function addWearIssues(
  payload: UpsertMaquinaDto,
  faltantes: MaquinaConfiguracionFaltante[],
) {
  if (!WEAR_REQUIRED_TEMPLATES.has(payload.plantilla)) return;
  const esCabezalCad = payload.plantilla === PlantillaMaquinariaDto.plotter_cad;
  const valid = payload.componentesDesgaste.some(
    (item) =>
      item.activo &&
      Boolean(item.nombre.trim()) &&
      Boolean(item.tipo) &&
      Boolean(item.unidadDesgaste) &&
      (!esCabezalCad ||
        (item.tipo === TipoComponenteDesgasteMaquinaDto.cabezal &&
          item.unidadDesgaste === UnidadDesgasteMaquinaDto.ml_tinta)) &&
      Number(item.vidaUtilEstimada ?? 0) > 0 &&
      (Boolean(item.materiaPrimaVarianteId) ||
        (item.precioUnitario !== undefined &&
          item.precioUnitario !== null &&
          Number.isFinite(Number(item.precioUnitario)))),
  );
  if (!valid) {
    faltantes.push({
      codigo: 'desgaste.sin_componente_valido',
      seccion: 'ajustes',
      mensaje: esCabezalCad
        ? 'Agregá el cabezal de impresión con su vida útil en ml de tinta y su precio.'
        : 'Agregá un componente de desgaste activo con vida útil y un precio o repuesto asociado.',
    });
  }
}
