import { createHash } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import type { CotizacionItem } from '@prisma/client';
import {
  AgregarAOrdenCentroCopiadoDto,
  DocumentoCentroCopiadoDto,
} from '../dto/cotizar-centro-copiado.dto';

export function objeto(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}
export function canonico(v: unknown): string {
  if (v == null) return 'null';
  if (Array.isArray(v)) return `[${v.map(canonico).join(',')}]`;
  if (v instanceof Date) return JSON.stringify(v.toISOString());
  if (typeof v === 'object' && 'toJSON' in v)
    return canonico((v as { toJSON(): unknown }).toJSON());
  if (typeof v === 'object')
    return `{${Object.entries(v)
      .filter(([, x]) => x !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, x]) => `${JSON.stringify(k)}:${canonico(x)}`)
      .join(',')}}`;
  return JSON.stringify(v);
}
export const huella = (v: unknown) =>
  createHash('sha256').update(canonico(v)).digest('hex');
export function fotoItem(i: CotizacionItem) {
  const { createdAt: _c, updatedAt: _u, ...datos } = i;
  void _c;
  void _u;
  return datos;
}
export function esCopiado(
  i: Pick<CotizacionItem, 'jobContextJson' | 'snapshotJson'>,
) {
  return (
    !!objeto(i.jobContextJson)._centroCopiado ||
    objeto(objeto(i.snapshotJson).producto).codigo === 'SYS-IMPRESION-DOC'
  );
}
export function calculoDe(i: Pick<CotizacionItem, 'snapshotJson'>) {
  const id = objeto(objeto(i.snapshotJson).copiadoComercial).calculoId;
  return typeof id === 'string' ? id : null;
}
export function solicitudDesdeSnapshot(
  i: Pick<CotizacionItem, 'id' | 'jobContextJson' | 'snapshotJson'>,
  clienteId: string | null,
) {
  const m = objeto(objeto(i.jobContextJson)._centroCopiado);
  if (!Object.keys(m).length)
    throw new BadRequestException(
      'Volvé a abrir Centro de copiado para reconstruir este trabajo.',
    );
  const esTomo = m.esTomo === true;
  const segmentos = esTomo ? m.segmentos : [m];
  if (!Array.isArray(segmentos) || !segmentos.length || segmentos.length > 100)
    throw new BadRequestException(
      'La carga de copiado no tiene documentos válidos.',
    );
  const documentos = segmentos.map((v: unknown, n: number) => {
    const s = objeto(v);
    const datos = Object.fromEntries(
      Object.entries(s).filter(([k]) =>
        [
          'nombre',
          'archivoNombre',
          'paginas',
          'paginasOriginales',
          'rangoPaginas',
          'orientacionesPaginas',
          'medidasPaginas',
          'tamano',
          'tamanoAnchoMm',
          'tamanoAltoMm',
          'papelMateriaPrimaId',
          'gramaje',
          'color',
          'faz',
          'cobertura',
          'cad',
          'modo',
          'copiasPorPagina',
        ].includes(k),
      ),
    );
    return {
      ...datos,
      id: `${i.id}:${n}`,
      copias: esTomo ? m.juegos : m.copias,
      grupoId: esTomo ? i.id : undefined,
      terminaciones: esTomo ? [] : (m.terminaciones ?? []),
      tipoAnillo: esTomo ? undefined : m.tipoAnillo,
    };
  });
  const dto = plainToInstance(AgregarAOrdenCentroCopiadoDto, {
    clienteId: clienteId ?? undefined,
    grupoCargaId: m.grupoCargaId ?? i.id,
    tipoCambioId: objeto(objeto(i.snapshotJson).tipoCambio).id,
    documentos,
    grupos: esTomo
      ? [
          {
            id: i.id,
            nombre: m.tomoNombre,
            juegos: m.juegos,
            terminaciones: m.terminaciones ?? [],
            tipoAnillo: m.tipoAnillo,
          },
        ]
      : [],
  });
  if (validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }).length)
    throw new BadRequestException(
      'La carga guardada necesita revisión. Abrila desde Centro de copiado antes de actualizar sus precios.',
    );
  return dto;
}

/** Metadata editable no puede abaratar un trabajo productivo distinto. */
export function exigirMismoTrabajo(
  original: Pick<CotizacionItem, 'productoId' | 'cantidad' | 'jobContextJson'>,
  generado: {
    productoId: string;
    cantidad: number;
    jobContext: Record<string, unknown>;
  },
) {
  const partes = (job: unknown) =>
    Object.fromEntries(
      Object.entries(objeto(job)).filter(
        ([k]) =>
          [
            'cantidad',
            'caras',
            'piezas',
            'modoColor',
            'slotMateriales',
            'cobertura',
            'juegos',
            'hojasPorLibro',
            'tipoAnillo',
            'opcionalesActivados',
            'omitirSetupCleanup',
          ].includes(k) ||
          k.startsWith('maquinaSeleccionada_') ||
          k.startsWith('pliego'),
      ),
    );
  if (
    original.productoId !== generado.productoId ||
    !original.cantidad.equals(generado.cantidad) ||
    canonico(partes(original.jobContextJson)) !==
      canonico(partes(generado.jobContext))
  )
    throw new BadRequestException(
      'El archivo y su cálculo productivo no coinciden. Reconstruí la carga desde Centro de copiado.',
    );
}
export function sinTerminaciones(dto: AgregarAOrdenCentroCopiadoDto) {
  return {
    ...dto,
    documentos: dto.documentos.map(
      (d) => ({ ...d, terminaciones: [] }) as DocumentoCentroCopiadoDto,
    ),
    grupos: dto.grupos?.map((g) => ({ ...g, terminaciones: [] })),
  };
}

export const firmaItemsCopiado = (items: CotizacionItem[]) =>
  huella([...items].sort((a, b) => a.id.localeCompare(b.id)).map(fotoItem));
