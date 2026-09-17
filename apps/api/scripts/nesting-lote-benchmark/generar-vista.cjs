/** Vista de investigación: contornos de ocupación; no es archivo de corte. */
const fs = require('node:fs');
const path = require('node:path');
const folder = path.resolve(process.argv[2]);
const input = JSON.parse(fs.readFileSync(path.join(folder, 'entrada.json'), 'utf8'));
const templates = JSON.parse(fs.readFileSync(path.join(folder, 'plantillas.json'), 'utf8'));
const colors = ['#2967a4', '#be7828', '#287e6b', '#9254ae', '#cc585e', '#6b7889'];
const labels = input.piezas.map(p => p.id);
const escape = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const text = (x, y, value, size = 16, color = '#24313a', weight = 400) => `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}">${escape(value)}</text>`;
const W = 1460, plateScale = 650 / input.placa.altoMm;
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="1070" viewBox="0 0 ${W} 1070"><rect width="100%" height="100%" fill="#f5f4f0"/><g font-family="Arial, sans-serif">`;
svg += text(32, 40, 'GrafoNest · Estudio de lote mixto', 28, '#172530', 700);
svg += text(32, 72, '50 exhibidores · 450 piezas exactas · 34 placas · 3 patrones', 21);
svg += text(32, 101, 'Contornos exteriores de CORTE_3 · Placa 564 × 860 mm · Margen 5 mm por borde · Separación 0 mm', 15, '#56636c');
labels.forEach((label, i) => {
  const x = 32 + i * 237;
  svg += `<rect x="${x}" y="125" width="14" height="14" rx="3" fill="${colors[i]}"/>` + text(x + 23, 138, label, 16);
});
templates.forEach((t, index) => {
  const x = 28 + index * 476, y = 164, w = 452, h = 762;
  svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="#fff" stroke="#d9ddde"/>`;
  svg += text(x + 16, y + 31, `PATRÓN ${t.nombre}`, 17, '#24313a', 700) + text(x + 245, y + 31, `Repetir ×${t.repeticiones}`, 21, '#24313a', 700);
  const px = x + 12, py = y + 48;
  svg += `<g transform="translate(${px} ${py}) scale(${plateScale})"><rect width="${input.placa.anchoMm}" height="${input.placa.altoMm}" fill="#f2f4f3" stroke="#61737e" stroke-width="1.4"/><rect x="5" y="5" width="${input.placa.anchoMm-10}" height="${input.placa.altoMm-10}" fill="#fff" stroke="#b9c2c6" stroke-dasharray="4 3"/>`;
  for (const p of t.placements) {
    const color = colors[labels.indexOf(p.piezaId)];
    const d = p.contorno.map((q, i) => `${i ? 'L' : 'M'}${q.x.toFixed(5)} ${q.y.toFixed(5)}`).join(' ') + ' Z';
    svg += `<path d="${d}" fill="${color}" fill-opacity=".17" stroke="${color}" stroke-width=".9"><title>${escape(p.piezaId)} · ${p.rotacionGrados}°</title></path>`;
  }
  svg += '</g>';
  const counts = labels.map((label, i) => `${t.counts[i]} ${label}`).filter((s, i) => t.counts[i] > 0);
  const lines = counts.length > 3 ? [counts.slice(0, 3).join(' · '), counts.slice(3).join(' · ')] : [counts.join(' · ')];
  lines.forEach((line, i) => { svg += text(x + 16, y + 718 + i * 23, line, 16); });
});
svg += text(32, 958, 'Balance verificado: 50 cuerpos + 50 soportes + 50 faldones + 200 estantes + 50 costillas + 50 headers.', 17, '#24313a', 700);
svg += text(32, 990, 'Resultado del prototipo por patrones. No demuestra el mínimo geométrico absoluto ni está integrado al cotizador.', 15, '#56636c');
svg += text(32, 1014, 'Escala inferida 25,4/72 mm por unidad. Estante D6 cerrado con una recta de 13,878 mm para calcular la envolvente.', 15, '#56636c');
svg += text(32, 1038, 'Confirmar ese cierre y la orientación de la fibra antes de producir. El patrón A gira header y faldón 90°. No es un archivo de corte.', 15, '#56636c');
svg += '</g></svg>';
fs.writeFileSync(path.join(folder, 'plan-34-placas.svg'), svg);
