import { UnidadBaseCentroCosto, UnidadProduccionMaquina } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProcesosService } from './procesos.service';
import {
  ModoProductividadProcesoDto,
  PlantillaMaquinariaDto,
  TipoOperacionProcesoDto,
  TipoProcesoDto,
  UnidadProcesoDto,
  type UpsertProcesoDto,
} from './dto/upsert-proceso.dto';

type ReferenceShape = {
  centrosById: Map<
    string,
    {
      id: string;
      nombre: string;
      unidadBaseFutura: UnidadBaseCentroCosto;
    }
  >;
  maquinasById: Map<
    string,
    {
      id: string;
      nombre: string;
      centroCostoPrincipalId: string | null;
      plantilla?: string;
      unidadProduccionPrincipal?: UnidadProduccionMaquina;
    }
  >;
  perfilesById: Map<
    string,
    {
      id: string;
      nombre: string;
      maquinaId: string;
      productividad: Prisma.Decimal | null;
      unidadProductividad: UnidadProduccionMaquina | null;
      tiempoPreparacionMin: Prisma.Decimal | null;
      tiempoCargaMin?: Prisma.Decimal | null;
      tiempoDescargaMin?: Prisma.Decimal | null;
      tiempoRipMin?: Prisma.Decimal | null;
    }
  >;
};

describe('ProcesosService business rules', () => {
  let service: ProcesosService;
  let validateBusinessRules: (
    payload: UpsertProcesoDto,
    references: ReferenceShape,
  ) => void;
  let deriveOperationDefaultsFromPayload: (
    payload: UpsertProcesoDto['operaciones'][number],
    references: ReferenceShape,
  ) => {
    setupMin: Prisma.Decimal | null;
  };

  beforeEach(() => {
    service = new ProcesosService({} as never);
    validateBusinessRules = Reflect.get(
      service as unknown as Record<string, unknown>,
      'validateBusinessRules',
    ) as (payload: UpsertProcesoDto, references: ReferenceShape) => void;
    deriveOperationDefaultsFromPayload = Reflect.get(
      service as unknown as Record<string, unknown>,
      'deriveOperationDefaultsFromPayload',
    ) as (
      payload: UpsertProcesoDto['operaciones'][number],
      references: ReferenceShape,
    ) => { setupMin: Prisma.Decimal | null };
  });

  it('rechaza modo formula sin regla de velocidad', () => {
    const payload: UpsertProcesoDto = {
      nombre: 'Proceso prueba',
      tipoProceso: TipoProcesoDto.maquinaria,
      plantillaMaquinaria: PlantillaMaquinariaDto.impresora_laser,
      activo: true,
      operaciones: [
        {
          nombre: 'Operacion 1',
          tipoOperacion: TipoOperacionProcesoDto.impresion,
          centroCostoId: 'centro-1',
          modoProductividad: ModoProductividadProcesoDto.formula,
          productividadBase: 100,
          unidadSalida: UnidadProcesoDto.hoja,
          unidadTiempo: UnidadProcesoDto.minuto,
          activo: true,
        },
      ],
    };

    const references = {
      centrosById: new Map([
        [
          'centro-1',
          {
            id: 'centro-1',
            nombre: 'Centro 1',
            unidadBaseFutura: UnidadBaseCentroCosto.HORA_MAQUINA,
          },
        ],
      ]),
      maquinasById: new Map(),
      perfilesById: new Map(),
    };

    expect(() =>
      validateBusinessRules.call(service, payload, references),
    ).toThrow(BadRequestException);
  });

  it('rechaza incompatibilidad unidad centro-operacion', () => {
    const payload: UpsertProcesoDto = {
      nombre: 'Proceso prueba',
      tipoProceso: TipoProcesoDto.maquinaria,
      plantillaMaquinaria: PlantillaMaquinariaDto.impresora_laser,
      activo: true,
      operaciones: [
        {
          nombre: 'Operacion 1',
          tipoOperacion: TipoOperacionProcesoDto.impresion,
          centroCostoId: 'centro-1',
          modoProductividad: ModoProductividadProcesoDto.fija,
          productividadBase: 100,
          unidadSalida: UnidadProcesoDto.unidad,
          unidadTiempo: UnidadProcesoDto.minuto,
          activo: true,
        },
      ],
    };

    const references = {
      centrosById: new Map([
        [
          'centro-1',
          {
            id: 'centro-1',
            nombre: 'Centro 1',
            unidadBaseFutura: UnidadBaseCentroCosto.M2,
          },
        ],
      ]),
      maquinasById: new Map(),
      perfilesById: new Map(),
    };

    expect(() =>
      validateBusinessRules.call(service, payload, references),
    ).toThrow(BadRequestException);
  });

  it('acepta modo fija sin productividad manual cuando el perfil aporta productividad', () => {
    const payload: UpsertProcesoDto = {
      nombre: 'Proceso perfil',
      tipoProceso: TipoProcesoDto.maquinaria,
      plantillaMaquinaria: PlantillaMaquinariaDto.impresora_laser,
      activo: true,
      operaciones: [
        {
          nombre: 'Operacion con perfil',
          tipoOperacion: TipoOperacionProcesoDto.impresion,
          centroCostoId: 'centro-1',
          maquinaId: 'maq-1',
          perfilOperativoId: 'perfil-1',
          modoProductividad: ModoProductividadProcesoDto.fija,
          unidadSalida: UnidadProcesoDto.ninguna,
          unidadTiempo: UnidadProcesoDto.minuto,
          activo: true,
        },
      ],
    };

    const references: ReferenceShape = {
      centrosById: new Map([
        [
          'centro-1',
          {
            id: 'centro-1',
            nombre: 'Centro 1',
            unidadBaseFutura: UnidadBaseCentroCosto.M2,
          },
        ],
      ]),
      maquinasById: new Map([
        [
          'maq-1',
          {
            id: 'maq-1',
            nombre: 'Maq 1',
            centroCostoPrincipalId: 'centro-1',
            plantilla: 'IMPRESORA_LASER',
            unidadProduccionPrincipal: UnidadProduccionMaquina.M2_H,
          },
        ],
      ]),
      perfilesById: new Map([
        [
          'perfil-1',
          {
            id: 'perfil-1',
            nombre: 'Perfil rapido',
            maquinaId: 'maq-1',
            productividad: new Prisma.Decimal(120),
            unidadProductividad: 'M2_H',
            tiempoPreparacionMin: new Prisma.Decimal(15),
          },
        ],
      ]),
    };

    expect(() =>
      validateBusinessRules.call(service, payload, references),
    ).not.toThrow();
  });

  it('acepta unidades derivadas desde unidad principal de maquina cuando no hay perfil', () => {
    const payload: UpsertProcesoDto = {
      nombre: 'Proceso con maquina sin perfil',
      tipoProceso: TipoProcesoDto.maquinaria,
      plantillaMaquinaria: PlantillaMaquinariaDto.impresora_laser,
      activo: true,
      operaciones: [
        {
          nombre: 'Operacion sin perfil',
          tipoOperacion: TipoOperacionProcesoDto.impresion,
          centroCostoId: 'centro-1',
          maquinaId: 'maq-1',
          modoProductividad: ModoProductividadProcesoDto.fija,
          productividadBase: 120,
          unidadSalida: UnidadProcesoDto.ninguna,
          unidadTiempo: UnidadProcesoDto.minuto,
          activo: true,
        },
      ],
    };

    const references: ReferenceShape = {
      centrosById: new Map([
        [
          'centro-1',
          {
            id: 'centro-1',
            nombre: 'Centro 1',
            unidadBaseFutura: UnidadBaseCentroCosto.HORA_MAQUINA,
          },
        ],
      ]),
      maquinasById: new Map([
        [
          'maq-1',
          {
            id: 'maq-1',
            nombre: 'Maq 1',
            centroCostoPrincipalId: 'centro-1',
            plantilla: 'IMPRESORA_LASER',
            unidadProduccionPrincipal: UnidadProduccionMaquina.M2_H,
          },
        ],
      ]),
      perfilesById: new Map(),
    };

    expect(() =>
      validateBusinessRules.call(service, payload, references),
    ).not.toThrow();
  });

  it('deriva setup desde RIP+carga+descarga cuando el perfil no tiene tiempoPreparacionMin', () => {
    const references: ReferenceShape = {
      centrosById: new Map(),
      maquinasById: new Map([
        [
          'maq-1',
          {
            id: 'maq-1',
            nombre: 'Maq 1',
            centroCostoPrincipalId: 'centro-1',
            plantilla: 'IMPRESORA_LASER',
            unidadProduccionPrincipal: UnidadProduccionMaquina.PPM,
          },
        ],
      ]),
      perfilesById: new Map([
        [
          'perfil-1',
          {
            id: 'perfil-1',
            nombre: 'Perfil laser',
            maquinaId: 'maq-1',
            productividad: new Prisma.Decimal(35),
            unidadProductividad: UnidadProduccionMaquina.PPM,
            tiempoPreparacionMin: null,
            tiempoRipMin: new Prisma.Decimal(3),
            tiempoCargaMin: new Prisma.Decimal(2),
            tiempoDescargaMin: new Prisma.Decimal(1),
          },
        ],
      ]),
    };

    const derived = deriveOperationDefaultsFromPayload.call(
      service,
      {
        nombre: 'Operacion',
        tipoOperacion: TipoOperacionProcesoDto.impresion,
        maquinaId: 'maq-1',
        perfilOperativoId: 'perfil-1',
        modoProductividad: ModoProductividadProcesoDto.fija,
        unidadSalida: UnidadProcesoDto.ninguna,
        unidadTiempo: UnidadProcesoDto.minuto,
        activo: true,
      },
      references,
    );

    expect(Number(derived.setupMin)).toBe(6);
  });

  it('fuerza modo fija cuando hay perfil operativo aunque el payload pida formula', () => {
    const payload: UpsertProcesoDto = {
      nombre: 'Proceso con perfil forzado',
      tipoProceso: TipoProcesoDto.maquinaria,
      plantillaMaquinaria: PlantillaMaquinariaDto.impresora_laser,
      activo: true,
      operaciones: [
        {
          nombre: 'Operacion con perfil',
          tipoOperacion: TipoOperacionProcesoDto.impresion,
          centroCostoId: 'centro-1',
          maquinaId: 'maq-1',
          perfilOperativoId: 'perfil-1',
          modoProductividad: ModoProductividadProcesoDto.formula,
          unidadSalida: UnidadProcesoDto.ninguna,
          unidadTiempo: UnidadProcesoDto.minuto,
          activo: true,
        },
      ],
    };

    const references: ReferenceShape = {
      centrosById: new Map([
        [
          'centro-1',
          {
            id: 'centro-1',
            nombre: 'Centro 1',
            unidadBaseFutura: UnidadBaseCentroCosto.HORA_MAQUINA,
          },
        ],
      ]),
      maquinasById: new Map([
        [
          'maq-1',
          {
            id: 'maq-1',
            nombre: 'Maq 1',
            centroCostoPrincipalId: 'centro-1',
            plantilla: 'IMPRESORA_LASER',
            unidadProduccionPrincipal: UnidadProduccionMaquina.PPM,
          },
        ],
      ]),
      perfilesById: new Map([
        [
          'perfil-1',
          {
            id: 'perfil-1',
            nombre: 'Perfil rapido',
            maquinaId: 'maq-1',
            productividad: new Prisma.Decimal(100),
            unidadProductividad: UnidadProduccionMaquina.PPM,
            tiempoPreparacionMin: new Prisma.Decimal(4),
          },
        ],
      ]),
    };

    expect(() =>
      validateBusinessRules.call(service, payload, references),
    ).not.toThrow();
  });
});
