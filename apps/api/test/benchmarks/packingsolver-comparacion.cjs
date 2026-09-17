/* Experimento de motor alternativo. No conectado al cotizador ni a persistencia.
 * PACKINGSOLVER_BIN=/ruta/bin node .../packingsolver-comparacion.cjs entrada.json salida 30
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const { validarResultadoNestingOpenNest } = require('../../dist/src/workers/geometria/validar-nesting-opennest');
const { contarPatronesResultado } = require('../../dist/src/workers/geometria/calidad-nesting');
const binary = process.env.PACKINGSOLVER_BIN;
if (!binary) throw new Error('Definir PACKINGSOLVER_BIN con el binario compilado y versionado.');
const input = JSON.parse(fs.readFileSync(process.argv[2]));
const dir = path.resolve(process.argv[3]);
const seconds = Number(process.argv[4] || 30);
const rotationCap = Number(process.env.GRAFONEST_COMPARISON_ROTATIONS || 0);
fs.mkdirSync(dir, { recursive: true });
const polygon = (vertices) => {
  const signedArea = vertices.reduce((s, p, i) => {
    const q = vertices[(i + 1) % vertices.length];
    return s + p.x * q.y - q.x * p.y;
  }, 0);
  // PackingSolver exige orientación positiva incluso para el anillo de un
  // hueco. Cambia el orden de lectura, nunca las coordenadas ni la geometría.
  return { type: 'polygon', vertices: signedArea < 0 ? [...vertices].reverse() : vertices };
};
const instance = {
  objective: 'bin-packing',
  parameters: { item_item_minimum_spacing: input.separacionMm },
  bin_types: [{ type: 'rectangle', width: input.placa.anchoMm, height: input.placa.altoMm,
    copies: input.placa.maxPlacas, item_bin_minimum_spacing: input.placa.margenMm }],
  item_types: input.piezas.map((p) => {
    const n = rotationCap > 0 ? Array.from({ length: Math.min(rotationCap, p.rotaciones) }, (_, i) => i + 1).filter((i) => p.rotaciones % i === 0).at(-1) : p.rotaciones;
    return { ...polygon(p.contorno), holes: (p.huecos || []).map(polygon),
      copies: p.cantidad, allow_mirroring: false,
      allowed_rotations: Array.from({ length: n }, (_, i) => ({ start: i * 360 / n, end: i * 360 / n, mirror: false })),
    };
  }),
};
fs.writeFileSync(path.join(dir, 'entrada-packingsolver.json'), JSON.stringify(instance));
const certificate = path.join(dir, 'certificado.json');
const inicio = performance.now();
const child = spawn(binary, ['--input', path.join(dir, 'entrada-packingsolver.json'), '--certificate', certificate,
  '--output', path.join(dir, 'diagnostico.json'), '--time-limit', String(seconds), '--memory-limit', '1024', '--verbosity-level', '1', '--linear-programming-solver', 'highs'],
  { detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
child.stdout.pipe(fs.createWriteStream(path.join(dir, 'stdout.log')));
child.stderr.pipe(fs.createWriteStream(path.join(dir, 'stderr.log')));
const timeout = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }, (seconds + 10) * 1000);
const curvas = [];
let previous = '';
function convertir(raw) {
  if (!raw || !Array.isArray(raw.bins)) throw new Error('El motor aún no entregó un plan completo.');
  const placements = [], copias = new Map(); let placa = 0;
  for (const bin of raw.bins || []) for (let i = 0; i < bin.copies; i++, placa++) {
    if (!Number.isSafeInteger(bin.copies) || bin.copies < 1 || placa >= input.placa.maxPlacas) throw new Error('Cantidad de placas inválida.');
    for (const pose of bin.items || []) {
      if (pose.mirror) throw new Error('El candidato espeja una pieza.');
      const p = input.piezas[pose.id];
      if (!p) throw new Error('Tipo desconocido.');
      const rad = pose.angle * Math.PI / 180, c = Math.cos(rad), s = Math.sin(rad);
      const mm = (n) => Math.round(n * 1e6) / 1e6;
      const transformar = (ps) => ps.map((q) => ({ x: mm(q.x * c - q.y * s + pose.x), y: mm(q.x * s + q.y * c + pose.y) }));
      const copia = copias.get(p.id) || 0; copias.set(p.id, copia + 1);
      placements.push({ piezaId: p.id, copia, placa, rotacionGrados: pose.angle, traslacion: { x: pose.x, y: pose.y },
        contorno: transformar(p.contorno), huecos: (p.huecos || []).map(transformar) });
    }
  }
  // Adaptación al contrato de validación v1; versionMotor identifica la fuente
  // experimental. No se publica como una ejecución de OpenNest en la aplicación.
  return validarResultadoNestingOpenNest(input, {
    schemaVersion: 1, algoritmo: 'opennest-v1', motor: input.motor, versionMotor: 'packingsolver-experimental',
    cantidadSolicitada: input.piezas.reduce((s, p) => s + p.cantidad, 0), cantidadColocada: placements.length,
    placasUsadas: placa, duracionMs: performance.now() - inicio, placements,
  });
}
function observar() {
  let contenido;
  try { contenido = fs.readFileSync(certificate, 'utf8'); } catch { return; }
  if (contenido === previous) return;
  let raw;
  try { raw = JSON.parse(contenido); } catch { return; } // escritura en curso
  previous = contenido;
  const tMs = Math.round(performance.now() - inicio);
  try {
    const validado = convertir(raw);
    const row = { tMs, valido: true, placas: validado.placasUsadas, patrones: contarPatronesResultado(validado) };
    curvas.push(row);
    fs.writeFileSync(path.join(dir, 'resultado-validado.json'), JSON.stringify(validado));
    console.log(JSON.stringify(row));
  } catch (error) { const row = { tMs, valido: false, error: error.message }; curvas.push(row); console.log(JSON.stringify(row)); }
}
const interval = setInterval(observar, 300);
child.on('error', (error) => { console.error(error); process.exitCode = 1; });
child.on('close', (code, signal) => {
  clearTimeout(timeout); clearInterval(interval); observar();
  const resumen = { code, signal, totalMs: Math.round(performance.now() - inicio), presupuestoMotorSegundos: seconds,
    rotacionesExploradas: instance.item_types.map((p) => p.allowed_rotations.length), curvas };
  fs.writeFileSync(path.join(dir, 'mediciones.json'), JSON.stringify(resumen, null, 2));
  console.log(JSON.stringify(resumen));
});
