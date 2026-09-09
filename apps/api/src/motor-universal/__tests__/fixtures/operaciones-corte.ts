import {
  configuracionCorteInicial,
  type ConfiguracionProcesamientoCorte,
} from '../../../maquinaria/procesamiento-corte';
import type { PasoCargado, JobContext, PasoEjecutado } from '../../tipos';
import type { PlanOperacionesCorte } from '../../procesamiento-corte';
import {
  prepararProcesamientoCorte,
  calcularProcesamientoCorte,
} from '../../procesamiento-corte';
import { lineasDesgasteCorte } from '../../repartir-operaciones-corte';
export function escenarioHerramientas(cantidad = 1, placas = 1) {
  const configuracion: ConfiguracionProcesamientoCorte = {
    ...configuracionCorteInicial(),
    posiciones: 2,
    preparacionMin: 5,
    limpiezaMin: 2,
    cargaDescargaPlacaMin: 1,
    registroPlacaMin: 0.5,
    cambioMin: 3,
    activacionSeg: 0.6,
    herramientas: [
      {
        id: 'cuchilla',
        nombre: 'Cuchilla de prueba',
        tipo: 'CUCHILLA',
        activo: true,
        posicion: 1,
        montada: true,
        operaciones: ['CORTE_COMPLETO', 'CORTE_PARCIAL'],
        espesorMaxMm: 10,
        desgaste: { modo: 'POR_METRO', costoReposicion: 200, vidaUtil: 100 },
      },
      {
        id: 'rueda',
        nombre: 'Rueda de prueba',
        tipo: 'RUEDA',
        activo: true,
        posicion: 2,
        montada: true,
        operaciones: ['HENDIDO'],
        espesorMaxMm: 10,
        desgaste: { modo: 'INCLUIDO_CENTRO' },
      },
    ],
  };
  const perfiles = (
    ['CORTE_COMPLETO', 'CORTE_PARCIAL', 'HENDIDO'] as const
  ).map((op, i) => ({
    id: op,
    nombre: op,
    activo: true,
    tipo: 'corte',
    setupMin: 0,
    cleanupMin: 0,
    productivityValue: [2, 1, 4][i],
    productivityUnit: 'M_MIN',
    detalleJson: {
      procesamientoCorteVersion: 1,
      herramientaId: i === 2 ? 'rueda' : 'cuchilla',
      operacionCorte: op,
      material: ['corrugado'],
      espesorMinMm: 1,
      espesorMaxMm: 5,
      modoVelocidad: 'POR_PASADA',
      pasadas: i === 0 ? 2 : 1,
      anchoCorteMm: 0,
      ajusteMin: [0.2, 0.3, 0.1][i],
    },
  }));
  const contornos = [
    {
      puntos: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ],
      esHueco: false,
    },
  ];
  const fabricacion = {
    geometriaId: 'geom-1',
    archivoHash: 'hash-original',
    entidades: [
      {
        entidadId: 'exterior',
        capa: 'CORTAR',
        rol: 'CORTE_EXTERIOR',
        operacion: 'CORTE_COMPLETO',
        conservar: true,
        puntos: contornos[0].puntos,
        cerrada: true,
        longitudMm: 400,
      },
      {
        entidadId: 'parcial',
        capa: 'otra',
        rol: 'CORTE_PARCIAL',
        operacion: 'CORTE_PARCIAL',
        conservar: true,
        puntos: [
          { x: 0, y: 10 },
          { x: 100, y: 10 },
        ],
        cerrada: false,
        longitudMm: 100,
      },
      {
        entidadId: 'hendido',
        capa: 'otra',
        rol: 'HENDIDO',
        operacion: 'HENDIDO',
        conservar: true,
        puntos: [
          { x: 20, y: 0 },
          { x: 20, y: 100 },
          { x: 30, y: 100 },
        ],
        cerrada: false,
        longitudMm: 200,
      },
      {
        entidadId: 'grafica',
        capa: 'GRAFICA',
        rol: null,
        operacion: null,
        conservar: true,
        puntos: contornos[0].puntos,
        cerrada: true,
        longitudMm: 400,
      },
    ],
  };
  const pieza = { id: 'pieza', contornos, fabricacion, cantidadPorUnidad: 1 };
  const ctx = {
    cantidad,
    geometriaVectorial: { piezas: [pieza] },
  } as unknown as JobContext;
  const paso = {
    rutaPasoId: 'corte',
    rutaPasoOrden: 1,
    familiaCodigo: 'troquelado_digital',
    nombreVisible: 'Mesa',
    configPasoId: 'cfg',
    modoActivacion: 'OBLIGATORIO',
    condicionActivacionJson: null,
    modoTiempo: 'T-3',
    mecanismoCantidad: 'CALCULADO_POR_PASO',
    mecanismoCantidadConfigJson: null,
    multiplicadoresActivos: [],
    paramsPasoJson: { cotizarOperacionesVectoriales: true },
    maquinaM1Id: 'mesa',
    perfilM1Id: null,
    centroCostoId: null,
    setupOverrideMin: null,
    cleanupOverrideMin: null,
    tiempoFijoOverrideMin: null,
    maquina: {
      id: 'mesa',
      codigo: 'mesa',
      nombre: 'Mesa de prueba',
      plantilla: 'MESA_DE_CORTE',
      centroCostoPrincipalId: 'cc',
      centroCostoPrincipalNombre: 'Corte',
      parametrosTecnicosJson: { procesamientoCorte: configuracion },
    },
    perfilesDisponibles: perfiles,
  } as unknown as PasoCargado;
  const material = {
    id: 'variante',
    materiaPrimaId: 'corrugado',
    atributosVarianteJson: { espesorMm: 3 },
  };
  const plan: PlanOperacionesCorte = {
    substrates: [
      { kind: 'sheet', count: placas, widthMm: 1000, heightMm: 1000 },
    ],
    placements: Array.from({ length: cantidad }, (_, i) => ({
      pieceId: 'pieza',
      substrateIndex: i % placas,
      xMm: i * 100,
      yMm: 0,
      widthMm: 100,
      heightMm: 100,
      rotated: false,
      meta: { ...pieza },
    })),
  };
  const calcular = () =>
    calcularProcesamientoCorte(
      paso,
      ctx,
      prepararProcesamientoCorte(paso, ctx, material),
      plan,
    );
  const ejecutado = (): PasoEjecutado => {
    const snapshot = { ...calcular(), redondeo: 'MINUTO' as const };
    const totalMin = Math.ceil(7 + snapshot.runMin);
    return {
      rutaPasoId: paso.rutaPasoId,
      rutaPasoOrden: 1,
      familiaCodigo: paso.familiaCodigo,
      configPasoId: 'cfg',
      activado: true,
      nombreVisible: 'Mesa',
      tiempo: {
        setupMin: 5,
        cleanupMin: 2,
        runMin: snapshot.runMin,
        tiempoFijoMin: 0,
        totalMin,
        tarifaHora: 60,
        centroCostoId: 'cc',
        costo: totalMin,
        procesamientoCorte: snapshot,
      },
      materiales: lineasDesgasteCorte(snapshot),
      costoTotal: totalMin + snapshot.desgasteCosto,
      nestingResult: {
        ...plan,
        algorithm: 'irregular-2d-bottom-left-v1',
        cantidadCalculada: placas,
        unidad: 'pliegos',
        aprovechamientoPct: 10,
        maquina: { id: 'mesa', nombre: 'Mesa' },
        perfil: { id: 'CORTE_COMPLETO', nombre: 'Completo' },
        piezasAcomodadas: cantidad,
      },
    };
  };
  return {
    paso,
    ctx,
    plan,
    material,
    configuracion,
    perfiles,
    calcular,
    ejecutado,
  };
}
