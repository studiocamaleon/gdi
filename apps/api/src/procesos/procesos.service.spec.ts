import { UnidadBaseCentroCosto, UnidadProduccionMaquina } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProcesosService } from './procesos.service';
import {
  ModoProductividadProcesoDto,
  PlantillaMaquinariaDto,
  TipoOperacionProcesoDto,
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
      productivityValue: Prisma.Decimal | null;
      productivityUnit: UnidadProduccionMaquina | null;
      setupMin: Prisma.Decimal | null;
      cleanupMin?: Prisma.Decimal | null;
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
    cleanupMin: Prisma.Decimal | null;
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
    ) => { setupMin: Prisma.Decimal | null; cleanupMin: Prisma.Decimal | null };
  });

  it('acepta modo variable con productividad base', () => {
    const payload: UpsertProcesoDto = {
      nombre: 'Proceso prueba',
      plantillaMaquinaria: PlantillaMaquinariaDto.impresora_laser,
      activo: true,
      operaciones: [
        {
          nombre: 'Operacion 1',
          tipoOperacion: TipoOperacionProcesoDto.impresion,
          centroCostoId: 'centro-1',
          modoProductividad: ModoProductividadProcesoDto.variable,
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
    ).not.toThrow();
  });

  it('rechaza incompatibilidad unidad centro-operacion', () => {
    const payload: UpsertProcesoDto = {
      nombre: 'Proceso prueba',
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

  it('acepta modo variable cuando el perfil aporta productividad', () => {
    const payload: UpsertProcesoDto = {
      nombre: 'Proceso perfil',
      plantillaMaquinaria: PlantillaMaquinariaDto.impresora_laser,
      activo: true,
      operaciones: [
        {
          nombre: 'Operacion con perfil',
          tipoOperacion: TipoOperacionProcesoDto.impresion,
          centroCostoId: 'centro-1',
          maquinaId: 'maq-1',
          perfilOperativoId: 'perfil-1',
          modoProductividad: ModoProductividadProcesoDto.variable,
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
            productivityValue: new Prisma.Decimal(120),
            productivityUnit: 'M2_H',
            setupMin: new Prisma.Decimal(15),
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

  it('deriva cleanup desde el perfil cuando la operación no lo define', () => {
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
            productivityValue: new Prisma.Decimal(35),
            productivityUnit: UnidadProduccionMaquina.PPM,
            setupMin: null,
            cleanupMin: new Prisma.Decimal(3),
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

    expect(derived.setupMin).toBeNull();
    expect(Number(derived.cleanupMin)).toBe(3);
  });

  it('permite modo variable cuando hay perfil operativo', () => {
    const payload: UpsertProcesoDto = {
      nombre: 'Proceso con perfil forzado',
      plantillaMaquinaria: PlantillaMaquinariaDto.impresora_laser,
      activo: true,
      operaciones: [
        {
          nombre: 'Operacion con perfil',
          tipoOperacion: TipoOperacionProcesoDto.impresion,
          centroCostoId: 'centro-1',
          maquinaId: 'maq-1',
          perfilOperativoId: 'perfil-1',
          modoProductividad: ModoProductividadProcesoDto.variable,
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
            productivityValue: new Prisma.Decimal(100),
            productivityUnit: UnidadProduccionMaquina.PPM,
            setupMin: new Prisma.Decimal(4),
          },
        ],
      ]),
    };

    expect(() =>
      validateBusinessRules.call(service, payload, references),
    ).not.toThrow();
  });
});
