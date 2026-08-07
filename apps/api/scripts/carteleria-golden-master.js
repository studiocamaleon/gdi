#!/usr/bin/env node
/**
 * Golden-master del CARTEL-BACKLIGHT (ruta real de 9 pasos) para el refactor
 * de derivadores geométricos (docs/derivadores-geometricos-diseno.md §5.1).
 *
 * A diferencia de motor-golden-master.js (batería genérica), acá los casos
 * ejercitan lo ESPECÍFICO de cartelería: profundidad, opcionales de ruta,
 * overrides del configurador (configPasoRuntime), selección de módulo LED y
 * compra por barras. La huella incluye outputs canónicos y tiempos por paso,
 * porque la herencia entre pasos es justamente lo que el refactor no puede
 * romper.
 *
 *   node scripts/carteleria-golden-master.js baseline   # antes del cambio
 *   node scripts/carteleria-golden-master.js compare    # falla si difiere
 *
 * Pega directo al backend (http://localhost:3001/api) con Authorization Bearer.
 */
const { writeFileSync, readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');

const API = process.env.GM_API_URL ?? 'http://localhost:3001/api';
const EMAIL = process.env.GM_EMAIL ?? 'admin@gdi-demo.local';
const PASSWORD = process.env.GM_PASSWORD ?? 'Admin123!';
const OUT = join(__dirname, 'carteleria-golden-master.baseline.json');

const PRODUCTO_CODIGO = 'CARTEL-BACKLIGHT';

// configPasoIds de la ruta RUTA-CARTEL-BACKLIGHT en dev (dump 2026-08-05).
// [F4 efectos, 2026-08-07] Se cayó `demasia`: el paso fantasma "Demasía de
// tensado" (modificacion_pre) salió de la ruta y su efecto lo declara ahora
// "Tensado de lona". La ruta pasó de 9 a 8 pasos.
const PASO = {
  corteHierros: '234a24d0-cb0b-443b-8ea0-d7f276d7bfbc',
  soldadura: '62849922-906a-49c7-9fe3-1194952bff87',
  pintura: '19d5f028-8fb5-4a99-b627-5f38a7970d09',
  impresion: '2ac89d50-c6db-41ca-9c01-0960887b44dc',
  chapaTrasera: 'ad7e90d7-432f-465a-936d-a5eadaa44bb0',
  iluminacion: '8df31f17-eadc-4328-8305-64536a848c7f',
  tensado: 'd3120441-b7f3-487a-aa01-f87c18e928c2',
  cenefas: '20d9b80e-ae2f-4423-b977-9c34862ad4fe',
};

// Variantes de módulo LED (CART-LED-MOD) en dev.
const LED_3W = '368215f1-1072-4e27-bcb5-61f603603636'; // CART-LED-BL-3W

// Selecciones de los slots COMERCIAL_ELIGE (el sheet manda defaults; acá van
// explícitas para que la huella sea determinística). Claves con el formato
// del sheet: `${configPasoId}_${slotCodigo}`.
const SELECCIONES = {
  [`${PASO.corteHierros}_perfil_estructural`]:
    '800b2762-cacc-411b-b862-745d8227cfb6', // CART-PERFIL-4040 (declara largoBarra → barras enteras)
  [`${PASO.corteHierros}_anclaje`]:
    'da4afb43-c022-47b4-977a-92c68e2ea918', // CART-ANC-PARED
  [`${PASO.pintura}_pintura`]:
    '867ca666-cbf5-4b6c-9637-634e96c4fa9c', // CART-PINT-NEG
  [`${PASO.impresion}_sustrato_principal`]:
    'cc348be8-de42-4779-bf80-1031bc61934d', // LONA-BACKLIT-152CM-50M
  // E4: la chapa trasera compra HOJAS reales (montaje_sobre_sustrato +
  // plate-segments); el slot pasó de `chapa` (m² teóricos) a `sustrato_montaje`.
  [`${PASO.chapaTrasera}_sustrato_montaje`]:
    'd0a5346d-6771-411a-9f83-400fc4cdbb98', // CART-CHAPA-GALV07-HOJA 1,22×2,44
  [`${PASO.iluminacion}_modulos_led`]:
    '5420927f-4650-4c0a-8de3-44f64dd624ae', // CART-LED-2835
  [`${PASO.cenefas}_chapa`]:
    '27de75b1-bd93-48d7-8b7f-51610436dc61', // CART-CHAPA-GALV07
};

const BASE = {
  cantidad: 1,
  piezas: [{ cantidad: 1, anchoMm: 2400, altoMm: 1200 }],
  profundidadMm: 180,
  slotMateriales: SELECCIONES,
};

const TODOS_OPCIONALES = {
  [PASO.pintura]: true,
  [PASO.chapaTrasera]: true,
  [PASO.cenefas]: true,
};

/**
 * Los casos E2E ya verificados del doc (§5.1) + variantes de opcionales.
 * Esperados anotados como referencia humana; la comparación es la huella.
 */
const CASOS = [
  {
    label: 'todo_activo', // esperado: $858.758 con margen 45%
    jobContext: { ...BASE, opcionalesActivados: TODOS_OPCIONALES },
  },
  {
    label: 'sin_opcionales',
    jobContext: { ...BASE, opcionalesActivados: {} },
  },
  {
    label: 'refuerzos_c50', // esperado: 25,44 ml de perfil
    jobContext: {
      ...BASE,
      opcionalesActivados: TODOS_OPCIONALES,
      configPasoRuntime: { [PASO.corteHierros]: { sepRefuerzoVcm: 50 } },
    },
  },
  {
    label: 'densidad_150', // esperado: 70 módulos
    jobContext: {
      ...BASE,
      opcionalesActivados: TODOS_OPCIONALES,
      configPasoRuntime: { [PASO.iluminacion]: { densidad: 1.5 } },
    },
  },
  {
    label: 'modulo_3w', // esperado: 16 módulos, 48 W, fuente 100 W
    jobContext: {
      ...BASE,
      opcionalesActivados: TODOS_OPCIONALES,
      slotMateriales: {
        ...SELECCIONES,
        [`${PASO.iluminacion}_modulos_led`]: LED_3W,
      },
    },
  },
  {
    label: 'chico_simple', // sin refuerzos verticales (1×0,5 m no llega a 100 cm)
    jobContext: {
      cantidad: 1,
      piezas: [{ cantidad: 1, anchoMm: 1000, altoMm: 500 }],
      profundidadMm: 150,
      opcionalesActivados: {},
      slotMateriales: SELECCIONES,
    },
  },
  {
    label: 'sin_profundidad', // guard: cajón doble sin D debe cortar con error
    jobContext: {
      cantidad: 1,
      piezas: [{ cantidad: 1, anchoMm: 2400, altoMm: 1200 }],
      opcionalesActivados: {},
      slotMateriales: SELECCIONES,
    },
  },
];

async function login() {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`login falló: HTTP ${res.status}`);
  const { accessToken } = await res.json();
  return accessToken;
}

async function buscarProducto(token) {
  const res = await fetch(
    `${API}/productos-servicios/productos?limit=200&search=${PRODUCTO_CODIGO}`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`buscar producto falló: HTTP ${res.status}`);
  const body = await res.json();
  const lista = Array.isArray(body) ? body : (body.data ?? []);
  const prod = lista.find((p) => p.codigo === PRODUCTO_CODIGO);
  if (!prod) throw new Error(`no existe ${PRODUCTO_CODIGO} en el tenant`);
  return prod;
}

async function cotizar(token, productoId, jobContext) {
  const res = await fetch(`${API}/motor-universal/cotizar`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ productoId, jobContext }),
  });
  return res.json();
}

const round2 = (v) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : v;

/**
 * Huella determinística y RICA: además de precio/materiales (como el golden
 * genérico), captura outputs canónicos y tiempo por paso — la herencia
 * soldadura←puntos, pintura←m², etc. es el corazón del refactor.
 */
function fingerprint(out) {
  if (!out || !out.exitoso || !out.cotizacion) {
    return {
      exitoso: false,
      errores: (out?.errores ?? []).map((e) => e.codigo).sort(),
    };
  }
  const c = out.cotizacion;
  return {
    exitoso: true,
    costoTotal: round2(c.costos?.total ?? null),
    precioBrutoTotal: round2(c.desglosePrecio?.precioBrutoTotal ?? null),
    pasos: (c.pasos ?? []).map((p) => ({
      orden: p.rutaPasoOrden,
      familia: p.familiaCodigo,
      nombre: p.nombreVisible ?? null,
      activado: p.activado,
      cantidad: round2(p.nestingResult?.cantidadCalculada ?? null),
      tiempoMin: round2(p.tiempo?.totalMin ?? null),
      costoTotal: round2(p.costoTotal ?? null),
      outputs: Object.fromEntries(
        Object.entries(p.outputsCanonicos ?? {}).map(([k, v]) => [
          k,
          round2(v),
        ]),
      ),
      materiales: (p.materiales ?? []).map((m) => ({
        variante: m.varianteId ?? m.sku ?? null,
        cantidad: round2(m.cantidad ?? null),
        costo: round2(m.costoTotal ?? null),
      })),
    })),
  };
}

async function run(mode) {
  const token = await login();
  const prod = await buscarProducto(token);
  const result = {};
  for (const caso of CASOS) {
    result[caso.label] = fingerprint(
      await cotizar(token, prod.id, caso.jobContext),
    );
  }

  if (mode === 'baseline') {
    writeFileSync(OUT, JSON.stringify(result, null, 2));
    const ok = Object.values(result).filter((r) => r.exitoso).length;
    console.log(
      `baseline guardada: ${Object.keys(result).length} casos (${ok} exitosos) → ${OUT}`,
    );
    for (const [label, r] of Object.entries(result)) {
      console.log(
        `  ${label}: ${r.exitoso ? `$${r.precioBrutoTotal} (costo $${r.costoTotal})` : `ERRORES ${r.errores.join(',')}`}`,
      );
    }
    return;
  }

  if (!existsSync(OUT)) throw new Error('no hay baseline; corré "baseline" primero.');
  const base = JSON.parse(readFileSync(OUT, 'utf8'));
  const diffs = [];
  for (const key of Object.keys(base)) {
    const a = JSON.stringify(base[key]);
    const b = JSON.stringify(result[key]);
    if (a !== b) diffs.push({ key, baseline: base[key], actual: result[key] });
  }
  if (diffs.length === 0) {
    console.log(
      `OK: ${Object.keys(base).length} casos idénticos a la baseline. El refactor no movió un peso.`,
    );
  } else {
    console.log(`DIFERENCIAS en ${diffs.length}/${Object.keys(base).length} casos:`);
    for (const d of diffs) {
      console.log('  ✗', d.key);
      console.log('    baseline:', JSON.stringify(d.baseline));
      console.log('    actual  :', JSON.stringify(d.actual));
    }
    process.exitCode = 1;
  }
}

run(process.argv[2] === 'compare' ? 'compare' : 'baseline').catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
