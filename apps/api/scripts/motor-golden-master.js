#!/usr/bin/env node
/**
 * Golden-master del motor de cotización sobre los datos REALES ya cargados.
 *
 * Cotiza todos los productos del tenant con una batería de jobContexts y
 * guarda una huella determinística (precio + materiales + cantidades por paso).
 * Sirve como red de seguridad para refactors del motor (A1, A11, etc.):
 *
 *   node scripts/motor-golden-master.js baseline   # captura antes del cambio
 *   ... aplicar el cambio ...
 *   node scripts/motor-golden-master.js compare     # falla si algo difiere
 *
 * Pega directo al backend (http://localhost:3001/api) con Authorization Bearer.
 */
const { writeFileSync, readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');

const API = process.env.GM_API_URL ?? 'http://localhost:3001/api';
const EMAIL = process.env.GM_EMAIL ?? 'admin@gdi-demo.local';
const PASSWORD = process.env.GM_PASSWORD ?? 'Admin123!';
const OUT = join(__dirname, 'motor-golden-master.baseline.json');

// Cantidades y medidas variadas para ejercitar nesting/material-resolution.
const JOB_VARIANTS = [
  { label: 'q1000_A5', cantidad: 1000, anchoMm: 148, altoMm: 210 },
  { label: 'q500_A4', cantidad: 500, anchoMm: 210, altoMm: 297 },
  { label: 'q250_10x15', cantidad: 250, anchoMm: 100, altoMm: 150 },
  { label: 'q5000_9x5', cantidad: 5000, anchoMm: 90, altoMm: 50 },
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

async function listarProductos(token) {
  const res = await fetch(`${API}/productos-servicios/productos?limit=200`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`listar productos falló: HTTP ${res.status}`);
  const body = await res.json();
  // El endpoint ahora devuelve un envelope paginado { data, total, ... }.
  return Array.isArray(body) ? body : (body.data ?? []);
}

async function cotizar(token, productoId, job) {
  const res = await fetch(`${API}/motor-universal/cotizar`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      productoId,
      jobContext: {
        cantidad: job.cantidad,
        piezas: [{ cantidad: job.cantidad, anchoMm: job.anchoMm, altoMm: job.altoMm }],
      },
    }),
  });
  return res.json();
}

/** Huella determinística: precio + materiales resueltos + cantidades por paso. */
function fingerprint(out) {
  if (!out || !out.exitoso || !out.cotizacion) {
    return { exitoso: false, errores: (out?.errores ?? []).map((e) => e.codigo).sort() };
  }
  const c = out.cotizacion;
  return {
    exitoso: true,
    costoTotal: c.costoTotal ?? null,
    precioBrutoTotal: c.desglosePrecio?.precioBrutoTotal ?? null,
    pasos: (c.pasos ?? []).map((p) => ({
      familia: p.familiaCodigo,
      cantidad: p.cantidadCalculada ?? null,
      materiales: (p.materiales ?? []).map((m) => ({
        variante: m.varianteId ?? m.sku ?? null,
        cantidad: m.cantidad ?? null,
        costo: m.costoTotal ?? null,
      })),
    })),
  };
}

async function run(mode) {
  const token = await login();
  const productos = await listarProductos(token);
  const result = {};
  for (const prod of productos) {
    for (const job of JOB_VARIANTS) {
      const key = `${prod.codigo}__${job.label}`;
      const out = await cotizar(token, prod.id, job);
      result[key] = fingerprint(out);
    }
  }

  if (mode === 'baseline') {
    writeFileSync(OUT, JSON.stringify(result, null, 2));
    const ok = Object.values(result).filter((r) => r.exitoso).length;
    console.log(`baseline guardada: ${Object.keys(result).length} casos (${ok} exitosos) → ${OUT}`);
    return;
  }

  // compare
  if (!existsSync(OUT)) throw new Error('no hay baseline; corré "baseline" primero.');
  const base = JSON.parse(readFileSync(OUT, 'utf8'));
  const diffs = [];
  for (const key of Object.keys(base)) {
    const a = JSON.stringify(base[key]);
    const b = JSON.stringify(result[key]);
    if (a !== b) diffs.push({ key, baseline: base[key], actual: result[key] });
  }
  if (diffs.length === 0) {
    console.log(`OK: ${Object.keys(base).length} casos idénticos a la baseline. Sin cambios de pricing.`);
  } else {
    console.log(`DIFERENCIAS en ${diffs.length}/${Object.keys(base).length} casos:`);
    for (const d of diffs.slice(0, 10)) {
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
