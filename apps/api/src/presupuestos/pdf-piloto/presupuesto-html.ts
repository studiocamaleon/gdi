import { formatearMonedaDoc, monedaDe } from '../../common/moneda';
import type { PresupuestoPdfDatos } from '../presupuesto-pdf.service';

/** Cambiar al modificar plantilla, fuentes o contrato de impresión. */
export const VERSION_PRESUPUESTO_HTML = 'presupuesto-marca-v1';

export function escaparHtml(value: string | number | null | undefined): string {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char]!,
  );
}

function fecha(value: string | null): string {
  if (!value) return 'Sin indicar';
  const [y, m, d] = value.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** HTML autónomo: ninguna URL del tenant se carga como recurso remoto. */
export function presupuestoHtml(d: PresupuestoPdfDatos): string {
  const moneda = d.empresa?.moneda ?? monedaDe(null);
  const money = (n: number) => escaparHtml(formatearMonedaDoc(n, moneda));
  const cantidad = (n: number) =>
    escaparHtml(
      new Intl.NumberFormat(moneda.locale, { maximumFractionDigits: 4 }).format(
        n,
      ),
    );
  const initials = d.negocio
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
  const logo =
    /^data:image\/(png|jpeg|webp|svg\+xml);base64,[a-zA-Z0-9+/=\r\n]+$/.test(
      d.logoDataUri ?? '',
    )
      ? d.logoDataUri
      : null;
  const contacto = [
    d.empresa?.telefono,
    d.empresa?.email,
    d.empresa?.sitioWebLegible,
  ].filter(Boolean);
  const campos = [
    ['Preparado para', d.cliente ?? 'Cliente'],
    ['Emisión', fecha(d.fechaEmision)],
    ['Válido hasta', fecha(d.fechaValidez)],
    ['Tu asesor', d.vendedor ?? d.negocio],
  ];
  const descuento = d.descuentoTotal ?? 0;
  const totales: Array<[string, number]> =
    descuento > 0
      ? [
          ['Subtotal de lista', d.subtotal + descuento],
          ['Descuento', -descuento],
          ['Subtotal con descuento', d.subtotal],
        ]
      : [['Subtotal', d.subtotal]];
  if (d.cargosDirectos > 0) totales.push(['Cargos directos', d.cargosDirectos]);
  totales.push(['Impuestos', d.impuestos]);
  if ((d.fidelizacionCanjePuntos ?? 0) > 0)
    totales.push([
      `Canje de ${d.fidelizacionCanjePuntos} puntos`,
      -(d.fidelizacionCanjeMonto ?? 0),
    ]);
  const condiciones =
    d.condicionesTexto?.trim() ||
    [
      d.senaSugeridaPct
        ? `Seña del ${cantidad(d.senaSugeridaPct)}% para iniciar el trabajo. Saldo contra entrega.`
        : null,
      d.fechaValidez
        ? `Propuesta válida hasta el ${fecha(d.fechaValidez)}.`
        : null,
    ]
      .filter(Boolean)
      .join(' ');

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="color-scheme" content="light">
<title>${escaparHtml(d.numero)} - ${escaparHtml(d.negocio)}</title>
<style>${CSS_PRESUPUESTO}</style></head><body>
<header class="brand-row">
  <div class="business"><div class="mark">${logo ? `<img src="${logo}" alt="">` : escaparHtml(initials)}</div>
    <div class="business-copy"><strong>${escaparHtml(d.negocio)}</strong>
      ${d.empresa?.domicilio ? `<p>${escaparHtml(d.empresa.domicilio)}</p>` : ''}
      ${contacto.length ? `<p>${contacto.map(escaparHtml).join(' · ')}</p>` : ''}
    </div>
  </div>
  <div class="co-brand"><span>Con tecnología</span><b>grafoprint<span class="dot">.</span></b></div>
</header>
<section class="hero">
  <div><p class="eyebrow">${d.borrador ? 'Borrador · sujeto a aprobación' : 'Una propuesta para vos'}</p><h1>Presupuesto<span class="dot">.</span></h1></div>
  <div class="document-number"><span>Referencia</span><strong>${escaparHtml(d.numero)}</strong></div>
</section>
<dl class="metadata">${campos.map(([label, value]) => `<div><dt>${label}</dt><dd>${escaparHtml(value)}</dd></div>`).join('')}</dl>
<section class="details"><div class="section-heading"><h2>Detalle del trabajo</h2><span>${d.items.length} ${d.items.length === 1 ? 'producto' : 'productos'}</span></div>
<table><colgroup><col class="description-col"><col class="quantity-col"><col class="unit-col"><col class="amount-col"></colgroup>
<thead><tr><th>Producto / especificaciones</th><th class="numeric">Cantidad</th><th class="numeric">Unitario</th><th class="numeric">Importe</th></tr></thead>
<tbody>${d.items
    .map(
      (
        item,
        index,
      ) => `<tr${item.specs.length > 12 || JSON.stringify(item).length > 2000 ? ' class="extensive"' : ''}>
  <td><div class="item-heading"><span class="item-index">${String(index + 1).padStart(2, '0')}</span><strong>${escaparHtml(item.nombre)}</strong></div>
    ${item.specs.length ? `<div class="specs">${item.specs.map((s) => `<p><span>${escaparHtml(s.etiqueta)}:</span> ${escaparHtml(s.valor)}</p>`).join('')}</div>` : ''}
    ${item.adicionales.length ? `<p class="additional">Incluye ${item.adicionales.map(escaparHtml).join(' · ')}</p>` : ''}
    ${(item.descuentoMonto ?? 0) > 0 ? `<p class="discount">Bonificación ${item.descuentoPct ? `${cantidad(item.descuentoPct)}%` : money(item.descuentoMonto!)}${item.totalLista != null ? ` · Antes ${money(item.totalLista)}` : ''}</p>` : ''}
  </td><td class="numeric">${cantidad(item.cantidad)}<span class="unit">${escaparHtml(item.cantidadUnidad)}</span></td>
  <td class="numeric">${money(item.cantidad > 0 ? item.total / item.cantidad : item.total)}</td><td class="numeric amount">${money(item.total)}</td>
</tr>`,
    )
    .join('')}</tbody></table>
<p class="table-note">Importes por producto con impuestos incluidos. Moneda: ${escaparHtml(moneda.codigo)}.</p></section>
<div class="settlement${condiciones.length + (d.observaciones?.length ?? 0) > 1800 ? ' extensive' : ''}">
<section class="summary"><div class="summary-kicker"><span class="section-index">02</span><h2>Tu propuesta,<br>en números<span class="dot">.</span></h2></div>
  <div class="totals"><dl>${totales.map(([label, value]) => `<div${value < 0 ? ' class="discount"' : ''}><dt>${escaparHtml(label)}</dt><dd>${money(value)}</dd></div>`).join('')}</dl>
  <div class="grand-total"><span>Total del presupuesto</span><strong>${money(d.total)}</strong></div></div>
</section>
${
  condiciones || d.observaciones || (d.fidelizacionPuntosEstimados ?? 0) > 0
    ? `<section class="conditions"><h2>Para tener en cuenta</h2>
${condiciones ? `<p>${escaparHtml(condiciones)}</p>` : ''}
${d.observaciones?.trim() ? `<div class="observations"><h3>Observaciones</h3><p>${escaparHtml(d.observaciones)}</p></div>` : ''}
${(d.fidelizacionPuntosEstimados ?? 0) > 0 ? `<p class="loyalty">Esta compra suma aproximadamente ${cantidad(d.fidelizacionPuntosEstimados!)} puntos. Se acreditan al completar, pagar y retirar el trabajo.</p>` : ''}
</section>`
    : ''
}
<div class="closing">Gracias por confiar en ${escaparHtml(d.negocio)}.</div>
</div>
</body></html>`;
}

export function presupuestoFooter(d: PresupuestoPdfDatos): string {
  return `<!doctype html><html><head><meta charset="utf-8"></head><body><div style="width:100%;margin:0 15mm;color:#626665;font:9px Arial,sans-serif;display:flex;justify-content:space-between;border-top:1px solid #dadbd5;padding-top:8px"><span>${escaparHtml(d.numero)} · ${escaparHtml(d.negocio)}</span><span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span></div></body></html>`;
}

const CSS_PRESUPUESTO = `
@font-face{font-family:Geist;src:url('Geist-Regular.ttf') format('truetype');font-weight:400}
@font-face{font-family:Geist;src:url('Geist-Bold.ttf') format('truetype');font-weight:700}
@page{size:A4;margin:13mm 15mm 18mm}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;color:#101214;background:white;font:9pt/1.45 Geist,Arial,sans-serif}
p,h1,h2,h3,dl,dd{margin:0}p{orphans:3;widows:3}h2,h3{break-after:avoid}
.dot{color:#ff7546}.brand-row{display:flex;justify-content:space-between;gap:8mm;align-items:center;padding-bottom:7mm;border-bottom:1px solid #dadbd5;break-inside:avoid}
.business{display:flex;gap:3.5mm;align-items:center;min-width:0;flex:1}.business-copy{min-width:0}.business strong{font-size:11pt;overflow-wrap:anywhere}.business p{font-size:7.5pt;color:#626665;margin-top:1mm;overflow-wrap:anywhere}
.mark{width:13mm;height:13mm;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:#f3f2ee;border:1px solid #dadbd5;border-radius:2mm;font-size:14pt;font-weight:700}.mark img{max-width:100%;max-height:100%;object-fit:contain;padding:1mm}
.co-brand{text-align:right;flex-shrink:0}.co-brand>span{display:block;font-size:6.5pt;color:#626665}.co-brand b{display:block;font-size:13pt;letter-spacing:-.7px}
.hero{display:flex;align-items:flex-end;justify-content:space-between;gap:8mm;padding:9mm 0 8mm;break-inside:avoid}.eyebrow{font-size:7pt;letter-spacing:1.3px;text-transform:uppercase;color:#b83f1a;margin-bottom:2mm}h1{font-size:31pt;line-height:1.1;letter-spacing:-1.6px;font-weight:700}.document-number{text-align:right;max-width:64mm}.document-number span{display:block;color:#626665;font-size:7pt;margin-bottom:1mm}.document-number strong{font-size:11pt;overflow-wrap:anywhere}
.metadata{display:grid;grid-template-columns:1.4fr 1fr 1fr 1.15fr;gap:4mm;padding:5mm;background:#f3f2ee;border:1px solid #dadbd5;border-radius:2mm;margin-bottom:8mm;break-inside:avoid}.metadata dt{font-size:6.5pt;text-transform:uppercase;letter-spacing:.7px;color:#626665;margin-bottom:2mm}.metadata dd{font-size:8.5pt;overflow-wrap:anywhere}
.section-heading{display:flex;align-items:center;justify-content:space-between;gap:6mm;margin-bottom:3mm;break-after:avoid}.section-heading h2{font-size:12pt;letter-spacing:-.3px}.section-heading>span{font-size:7pt;color:#626665}
table{width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group}tr{break-inside:avoid}th{background:#f3f2ee;font-size:6.5pt;letter-spacing:.25px;color:#626665;text-align:left;font-weight:400;padding:3mm 2.5mm;border-block:1px solid #dadbd5}td{padding:4mm 2.5mm;border-bottom:1px solid #dadbd5;vertical-align:top;overflow-wrap:anywhere}.description-col{width:46%}.quantity-col{width:12%}.unit-col{width:21%}.amount-col{width:21%}.numeric{text-align:right;font-variant-numeric:tabular-nums;font-size:8pt}.unit{display:block;color:#626665;font-size:7pt;margin-top:.7mm}.amount{font-weight:700}.item-heading{display:flex;align-items:baseline;gap:2mm;font-size:9pt}.item-index{font-size:7pt;color:#626665;font-weight:400;flex-shrink:0}.specs{margin:2mm 0 0 5mm;font-size:7pt;color:#3d4140}.specs p{margin:.5mm 0}.specs span{color:#626665}.additional,.discount{font-size:7pt;color:#27735d;margin-top:2mm}.additional{color:#626665}.table-note{font-size:6.8pt;color:#626665;margin-top:2mm}
.summary{display:flex;gap:10mm;justify-content:space-between;margin:8mm 0;break-inside:avoid}.summary-kicker{display:flex;gap:3mm;padding-top:2mm}.section-index{font-size:7pt;color:#b83f1a}.summary h2{font-size:15pt;line-height:1.25;letter-spacing:-.45px}.totals{width:91mm;flex-shrink:0}.totals dl>div{display:flex;gap:4mm;justify-content:space-between;padding:1.8mm 0;font-size:8pt}.totals dt{color:#626665}.totals dd{text-align:right;flex-shrink:0;font-variant-numeric:tabular-nums}.totals .discount{margin-top:0}.totals .discount dt{color:#27735d}.grand-total{margin-top:3mm;padding:4mm 5mm;background:#101214;color:#fbfaf7;border-radius:2mm}.grand-total span{font-size:7.5pt;display:block;margin-bottom:1.5mm;color:#c5c8c5}.grand-total strong{font-size:22pt;line-height:1.15;letter-spacing:-.6px;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}
.conditions{border-top:2px solid #ff7546;padding-top:4mm;margin-top:5mm}.conditions h2{font-size:10pt;margin-bottom:2mm}.conditions p{font-size:8pt;color:#626665;white-space:pre-wrap;overflow-wrap:anywhere}.observations{margin-top:4mm}.observations h3{font-size:8pt;font-weight:700;margin-bottom:1.5mm}.loyalty{margin-top:3mm}.closing{margin-top:6mm;padding-top:4mm;border-top:1px solid #dadbd5;font-size:8pt;break-inside:avoid;color:#626665}
.settlement{break-inside:avoid}.extensive{break-inside:auto}.extensive .specs p{break-inside:avoid}
`;
