import 'reflect-metadata';

import {
  EstadoMaquinaDto,
  GeometriaTrabajoMaquinaDto,
  PlantillaMaquinariaDto,
  TipoComponenteDesgasteMaquinaDto,
  TipoConsumibleMaquinaDto,
  TipoPerfilOperativoMaquinaDto,
  UnidadConsumoMaquinaDto,
  UnidadDesgasteMaquinaDto,
  UnidadProduccionMaquinaDto,
  type UpsertMaquinaDto,
} from '../dto/upsert-maquina.dto';
import { getMaquinaDiagnosticoConfiguracion } from '../maquinaria-configuracion';

function base(plantilla: PlantillaMaquinariaDto): UpsertMaquinaDto {
  return {
    nombre: 'Máquina de prueba',
    plantilla,
    plantaId: '11111111-1111-4111-8111-111111111111',
    estado: EstadoMaquinaDto.inactiva,
    geometriaTrabajo: GeometriaTrabajoMaquinaDto.plano,
    unidadProduccionPrincipal: UnidadProduccionMaquinaDto.hora,
    activo: false,
    perfilesOperativos: [],
    consumibles: [],
    componentesDesgaste: [],
  };
}

describe('diagnóstico de configuración de maquinaria', () => {
  it('no exige repuestos a una anilladora porque esa sección no existe', () => {
    const payload = base(PlantillaMaquinariaDto.anilladora);
    payload.perfilesOperativos = [
      {
        nombre: 'Espiral plástico',
        tipoPerfil: TipoPerfilOperativoMaquinaDto.fabricacion,
        activo: true,
        productivityValue: 1200,
        productivityUnit: UnidadProduccionMaquinaDto.hora,
        detalle: { tipoAnillo: 'ESPIRAL_PLASTICO' },
      },
    ];

    expect(getMaquinaDiagnosticoConfiguracion(payload)).toEqual({
      estado: 'lista',
      faltantes: [],
    });
  });

  it('no exige repuestos a una plancha térmica', () => {
    const payload = base(PlantillaMaquinariaDto.plancha_termica);
    payload.perfilesOperativos = [
      {
        nombre: 'DTF',
        tipoPerfil: TipoPerfilOperativoMaquinaDto.fabricacion,
        activo: true,
        detalle: { tiempoPrensadoSeg: 20 },
      },
    ];

    expect(getMaquinaDiagnosticoConfiguracion(payload).faltantes).toEqual([]);
  });

  it('explica que una impresora 3D completa en apariencia necesita desgaste', () => {
    const payload = base(PlantillaMaquinariaDto.impresora_3d);
    Object.assign(payload, {
      anchoUtil: 800,
      largoUtil: 1200,
      altoUtil: 100,
      parametrosTecnicos: { tecnologia: 'FDM' },
      perfilesOperativos: [
        {
          nombre: 'PETG',
          tipoPerfil: TipoPerfilOperativoMaquinaDto.fabricacion,
          activo: true,
          productivityValue: 40,
          productivityUnit: UnidadProduccionMaquinaDto.g_h,
        },
      ],
    });

    const faltantes = getMaquinaDiagnosticoConfiguracion(payload).faltantes;
    expect(faltantes).toHaveLength(1);
    expect(faltantes[0]).toMatchObject({
      codigo: 'desgaste.sin_componente_valido',
    });
    expect(faltantes[0]?.mensaje).toContain('componente de desgaste');
  });

  it('identifica el tiempo por corte faltante en cada perfil de guillotina', () => {
    const payload = base(PlantillaMaquinariaDto.guillotina);
    Object.assign(payload, {
      anchoUtil: 600,
      altoUtil: 165,
      perfilesOperativos: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          nombre: 'Papel obra',
          tipoPerfil: TipoPerfilOperativoMaquinaDto.corte,
          activo: true,
          detalle: { gramajeMaxGr: 100, pliegosMaxPorTanda: 500 },
        },
      ],
    });

    expect(getMaquinaDiagnosticoConfiguracion(payload).faltantes).toEqual([
      expect.objectContaining({
        campo: 'tiempoPorCorteSeg',
        mensaje: 'Perfil “Papel obra”: completá Tiempo por corte.',
      }),
    ]);
  });

  it('muestra el nombre funcional del campo físico faltante', () => {
    const payload = base(PlantillaMaquinariaDto.router_cnc);
    payload.anchoUtil = 1300;
    payload.largoUtil = 1800;
    payload.perfilesOperativos = [
      {
        nombre: 'Corte MDF',
        tipoPerfil: TipoPerfilOperativoMaquinaDto.mecanizado,
        activo: true,
        productivityValue: 1700,
        productivityUnit: UnidadProduccionMaquinaDto.mm_min,
        detalle: { tipoOperacion: 'CORTE' },
      },
    ];

    expect(getMaquinaDiagnosticoConfiguracion(payload).faltantes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          campo: 'altoUtil',
          mensaje: 'Completá Alto útil.',
        }),
      ]),
    );
  });

  it('no exige desgaste al plotter de corte', () => {
    const payload = base(PlantillaMaquinariaDto.plotter_de_corte);
    payload.anchoUtil = 610;
    payload.parametrosTecnicos = {
      modosOperacionSoportados: ['ROLLO', 'HOJAS'],
    };
    payload.perfilesOperativos = [
      {
        nombre: 'Corte simple',
        tipoPerfil: TipoPerfilOperativoMaquinaDto.corte,
        activo: true,
        productivityValue: 10,
        productivityUnit: UnidadProduccionMaquinaDto.m2_h,
      },
    ];

    expect(getMaquinaDiagnosticoConfiguracion(payload).faltantes).toEqual([]);
  });

  it('no exige desgaste a una cortadora láser', () => {
    const payload = base(PlantillaMaquinariaDto.corte_laser);
    payload.anchoUtil = 1300;
    payload.largoUtil = 900;
    payload.perfilesOperativos = [
      {
        nombre: 'Corte MDF',
        tipoPerfil: TipoPerfilOperativoMaquinaDto.corte,
        activo: true,
        productivityValue: 30,
        productivityUnit: UnidadProduccionMaquinaDto.mm_s,
        detalle: { tipoOperacion: 'CORTE' },
      },
    ];

    expect(getMaquinaDiagnosticoConfiguracion(payload).faltantes).toEqual([]);
  });

  it('al Plotter CAD le exige sus tintas CMYK y un único cabezal por ml', () => {
    const payload = base(PlantillaMaquinariaDto.plotter_cad);
    payload.anchoUtil = 1067;
    payload.parametrosTecnicos = {
      margenesNoImprimiblesMm: { superior: 5, inferior: 5 },
      coloresSoportados: ['CMYK'],
    };
    const perfilId = '22222222-2222-4222-8222-222222222222';
    payload.perfilesOperativos = [
      {
        id: perfilId,
        nombre: 'Planos CAD',
        tipoPerfil: TipoPerfilOperativoMaquinaDto.impresion,
        activo: true,
        productivityValue: 25,
        productivityUnit: UnidadProduccionMaquinaDto.m2_h,
        detalle: {
          tipoTrabajo: 'CAD',
          calidad: 'DRAFT',
          colores: ['CMYK'],
        },
      },
    ];
    payload.consumibles = ['cian', 'magenta', 'amarillo', 'negro'].map(
      (color, index) => ({
        materiaPrimaVarianteId: `33333333-3333-4333-8333-33333333333${index}`,
        nombre: `Tinta ${color}`,
        tipo: TipoConsumibleMaquinaDto.tinta,
        unidad: UnidadConsumoMaquinaDto.ml,
        consumoBase: color === 'negro' ? 0.8 : 0.06,
        perfilOperativoId: perfilId,
        activo: true,
        detalle: { color },
      }),
    );

    expect(getMaquinaDiagnosticoConfiguracion(payload).faltantes).toEqual([
      expect.objectContaining({
        codigo: 'desgaste.sin_componente_valido',
        mensaje:
          'Agregá el cabezal de impresión con su vida útil en ml de tinta y su precio.',
      }),
    ]);

    payload.componentesDesgaste = [
      {
        nombre: 'Cabezal de impresión',
        tipo: TipoComponenteDesgasteMaquinaDto.cabezal,
        unidadDesgaste: UnidadDesgasteMaquinaDto.ml_tinta,
        vidaUtilEstimada: 10_000,
        precioUnitario: 500_000,
        soloColor: false,
        activo: true,
      },
    ];

    expect(getMaquinaDiagnosticoConfiguracion(payload)).toEqual({
      estado: 'lista',
      faltantes: [],
    });
  });
});
