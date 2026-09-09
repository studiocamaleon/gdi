/**
 * Diagnóstico documental pre-F5, 08/09/2026. No usa base de datos ni maquinaria real.
 * Ejecutar desde apps/api: npx ts-node --project tsconfig.json test/validacion-maquinas-visual-ilusion.ts
 * Los valores de la fixture son sintéticos: NO son recetas de Vega ni de Kongsberg.
 * Registra comportamiento actual, incluidos límites; no certifica compatibilidad física
 * ni convierte los límites observados en expectativas de una prueba de regresión.
 */
import {
  erroresConfiguracionCorte,
  erroresPerfilCorte,
} from '../src/maquinaria/procesamiento-corte';
import { escenarioHerramientas } from '../src/motor-universal/__tests__/fixtures/operaciones-corte';

type Observacion = { caso: string; resultado: unknown };
const observaciones: Observacion[] = [];
function observar(caso: string, ejecutar: () => unknown) {
  try {
    observaciones.push({ caso, resultado: ejecutar() });
  } catch (error) {
    observaciones.push({
      caso,
      resultado: {
        rechazado: true,
        mensaje: error instanceof Error ? error.message : String(error),
      },
    });
  }
}
const redondear = (n: number) => Number(n.toFixed(6));

observar(
  '01. Tres operaciones, 10 piezas / 2 placas y dos herramientas montadas',
  () => {
    const r = escenarioHerramientas(10, 2).calcular();
    return {
      operaciones: r.operaciones.map((o) => ({
        operacion: o.operacion,
        metros: redondear(o.metros),
        metrosProcesados: redondear(o.metrosProcesados),
        perfil: o.perfilId,
        herramienta: o.herramienta.id,
      })),
      placas: r.placas,
      cambiosFisicos: r.cambiosHerramienta,
      manejoMin: r.manejoMin,
      recorridoMin: redondear(r.recorridoMin),
      runMin: redondear(r.runMin),
    };
  },
);

observar('02. Dos cuchillas alternan una posición; rueda en otra', () => {
  const s = escenarioHerramientas(10, 2);
  s.configuracion.herramientas.push({
    ...structuredClone(s.configuracion.herramientas[0]),
    id: 'cuchilla-parcial',
    nombre: 'Cuchilla intercambiable de prueba',
    montada: false,
    operaciones: ['CORTE_PARCIAL'],
  });
  s.perfiles[1].detalleJson.herramientaId = 'cuchilla-parcial';
  const r = s.calcular();
  return { cambiosFisicos: r.cambiosHerramienta, cambiosMin: r.cambiosMin };
});

observar('03. Fresa en posición 3 sin restricción de cabezal/adaptador', () => {
  const s = escenarioHerramientas();
  s.configuracion.posiciones = 3;
  s.configuracion.herramientas[0].tipo = 'FRESA';
  s.configuracion.herramientas[0].posicion = 3;
  return {
    errores: erroresConfiguracionCorte(s.configuracion, 'mesa_de_corte'),
  };
});

observar('04. Módulo láser opcional dentro de una mesa de corte', () => {
  const s = escenarioHerramientas();
  s.configuracion.herramientas[0].tipo = 'LASER';
  return {
    errores: erroresConfiguracionCorte(s.configuracion, 'mesa_de_corte'),
  };
});

observar('05. Hendido con una lámina de hendido en lugar de rueda', () => {
  const s = escenarioHerramientas();
  s.configuracion.herramientas[1].tipo = 'CUCHILLA';
  return {
    errores: erroresConfiguracionCorte(s.configuracion, 'mesa_de_corte'),
  };
});

for (const operacion of ['PERFORADO', 'DIBUJO', 'TALADRADO']) {
  observar(`06. Operación adicional ${operacion}`, () => {
    const s = escenarioHerramientas();
    const config = {
      ...s.configuracion,
      herramientas: [
        { ...s.configuracion.herramientas[0], operaciones: [operacion] },
      ],
    };
    return { errores: erroresConfiguracionCorte(config, 'mesa_de_corte') };
  });
}

observar(
  '07. Dos perfiles de hendido compatibles con el mismo material/espesor',
  () => {
    const s = escenarioHerramientas();
    s.paso.perfilesDisponibles!.push({
      ...structuredClone(s.perfiles[2]),
      id: 'HENDIDO-TRANSVERSAL',
      nombre: 'Hendido transversal de prueba',
      productivityValue: 2,
    });
    return s.calcular();
  },
);

observar('08. Selección explícita aplica un perfil a todo el hendido', () => {
  const s = escenarioHerramientas();
  const entidades = s.ctx.geometriaVectorial!.piezas[0].fabricacion!.entidades;
  entidades.push({
    ...structuredClone(entidades.find((e) => e.entidadId === 'hendido')!),
    entidadId: 'hendido-transversal',
    capa: 'HENDIDO_TRANSVERSAL',
    puntos: [
      { x: 0, y: 50 },
      { x: 100, y: 50 },
    ],
    longitudMm: 100,
  });
  s.paso.perfilesDisponibles!.push({
    ...structuredClone(s.perfiles[2]),
    id: 'HENDIDO-TRANSVERSAL',
    nombre: 'Hendido transversal de prueba',
    productivityValue: 2,
  });
  s.paso.paramsPasoJson = {
    cotizarOperacionesVectoriales: true,
    perfilesOperacionCorte: { HENDIDO: 'HENDIDO-TRANSVERSAL' },
  };
  return s
    .calcular()
    .operaciones.filter((o) => o.operacion === 'HENDIDO')
    .map((o) => ({ perfil: o.perfilId, fuentes: o.fuentes.length }));
});

observar(
  '09. Silueta cerrada para nesting con únicamente corte parcial',
  () => {
    const s = escenarioHerramientas();
    for (const e of s.ctx.geometriaVectorial!.piezas[0].fabricacion!
      .entidades) {
      e.operacion = e.entidadId === 'exterior' ? 'CORTE_PARCIAL' : null;
    }
    return s.calcular();
  },
);

observar('10. Plan de bobina con operaciones por herramienta', () => {
  const s = escenarioHerramientas();
  s.plan.substrates = [{ kind: 'roll', widthMm: 1000, lengthMm: 1000 }];
  return s.calcular();
});

observar(
  '11. Presión, RPM y profundidad sin límites físicos del módulo',
  () => {
    const s = escenarioHerramientas();
    return {
      errores: erroresPerfilCorte(
        {
          ...s.perfiles[0],
          detalleJson: {
            ...s.perfiles[0].detalleJson,
            presionN: 1_000_000,
            rpm: 1_000_000,
            profundidadMm: 1000,
          },
        },
        s.configuracion,
      ),
    };
  },
);

observar(
  '12. Aumentar profundidad sin cambiar velocidad/pasadas mantiene tiempo',
  () => {
    const s = escenarioHerramientas();
    const antes = s.calcular().runMin;
    const p = s.perfiles[0];
    s.paso.perfilesDisponibles![0] = {
      ...p,
      detalleJson: {
        ...p.detalleJson,
        profundidadMm: 3,
        profundidadPasadaMm: 0.5,
      },
    };
    return {
      antesMin: redondear(antes),
      despuesMin: redondear(s.calcular().runMin),
    };
  },
);

observar(
  '13. Tiempo de manejo aditivo por placa, sin solapamiento de zonas',
  () => {
    const s = escenarioHerramientas(20, 20);
    const r = s.calcular();
    return {
      placas: r.placas,
      cargaDescargaPlacaMin: s.configuracion.cargaDescargaPlacaMin,
      registroPlacaMin: s.configuracion.registroPlacaMin,
      manejoTotalMin: r.manejoMin,
    };
  },
);

observar(
  '14. El snapshot conserva la receta al modificar el catálogo después',
  () => {
    const s = escenarioHerramientas();
    const r = s.calcular();
    s.configuracion.herramientas[0].nombre = 'Nombre posterior';
    s.perfiles[0].productivityValue = 999;
    const o = r.operaciones.find((o) => o.operacion === 'CORTE_COMPLETO')!;
    return {
      nombreConservado: o.herramienta.nombre,
      velocidadConservada: o.velocidad,
    };
  },
);

process.stdout.write(
  JSON.stringify(
    {
      alcance:
        'Diagnóstico de funciones puras; sin DB, UI, controlador ni máquina real.',
      datos: 'Sintéticos. No utilizar como calibración de producción.',
      observaciones,
    },
    null,
    2,
  ) + '\n',
);
