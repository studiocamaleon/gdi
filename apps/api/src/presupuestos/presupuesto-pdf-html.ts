import type { PresupuestoPdfDatos } from './presupuesto-pdf.service';

/**
 * HTML del PDF de presupuesto — port VERBATIM del diseño canónico
 * (claude.ai/design · "PDF Presupuesto.html"). Se renderiza con Chrome
 * headless (`page.pdf()`), así que el CSS del diseño se aplica tal cual:
 * el diseño ya trae su bloque `@media print` con `@page {size:A4;margin:0}`.
 *
 * Sólo se interpolan datos y se adapta lo que el diseño tenía hardcodeado
 * (ver notas al pie del archivo).
 */

const esc = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const money = (n: number) =>
  '$' +
  n.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fecha = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
};

/** Iniciales del negocio para el cuadrado del logo. */
function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return 'GP';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

/** `@font-face` con las Geist embebidas: el PDF no depende de la red. */
function fuentes(ttf: { regular: string; bold: string } | null): string {
  if (!ttf) return '';
  return `
@font-face{font-family:"Geist";font-style:normal;font-weight:400;src:url(data:font/ttf;base64,${ttf.regular}) format("truetype")}
@font-face{font-family:"Geist";font-style:normal;font-weight:500;src:url(data:font/ttf;base64,${ttf.regular}) format("truetype")}
@font-face{font-family:"Geist";font-style:normal;font-weight:600;src:url(data:font/ttf;base64,${ttf.bold}) format("truetype")}
@font-face{font-family:"Geist";font-style:normal;font-weight:700;src:url(data:font/ttf;base64,${ttf.bold}) format("truetype")}`;
}

export function construirHtmlPresupuesto(
  d: PresupuestoPdfDatos,
  ttf: { regular: string; bold: string } | null,
): string {
  // El item muestra su precio FINAL (con impuestos), así que el unitario se
  // deriva del total. Se aclara "IVA incl." para que no haya ambigüedad.
  const items = d.items
    .map((i, idx) => {
      const unit = i.cantidad > 0 ? i.total / i.cantidad : i.total;
      const specs = i.specs
        .map(
          (s) =>
            `<span class="spec"><span class="k">${esc(s.etiqueta)}</span><span class="v">${esc(s.valor)}</span></span>`,
        )
        .join('');
      const opcionales = i.adicionales.length
        ? `<div class="opt-wrap">
        <div class="opt-t">Opcionales incluidos</div>
        <div class="opt-list">${i.adicionales
          .map(
            (a) =>
              `<span class="opt"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M20 6L9 17l-5-5"/></svg>${esc(a)}</span>`,
          )
          .join('')}</div>
      </div>`
        : '';
      return `<div class="item">
      <div class="item-top">
        <div class="item-idx">${idx + 1}</div>
        <div class="item-hd">
          <div class="item-nm">${esc(i.nombre)}</div>
          <div class="item-qty">${esc(i.cantidad.toLocaleString('es-AR'))} ${esc(i.cantidadUnidad)} · ${money(unit)} c/u <span class="iva">IVA incl.</span></div>
        </div>
        <div class="item-price">${money(i.total)}</div>
      </div>
      ${specs ? `<div class="specs">${specs}</div>` : ''}
      ${opcionales}
    </div>`;
    })
    .join('');

  // El diseño rotula "Impuestos (IVA 21%)"; la alícuota sale del dato real.
  const pctIva =
    d.subtotal > 0 ? Math.round((d.impuestos / d.subtotal) * 100) : 0;
  const rotuloImpuestos =
    d.impuestos > 0 && pctIva > 0 ? `Impuestos (IVA ${pctIva}%)` : 'Impuestos';

  // El diseño no contemplaba cargos directos; se muestran sólo si existen,
  // para que la suma le cierre al cliente.
  const filaCargos =
    d.cargosDirectos > 0
      ? `<div class="tot-row"><span>Cargos directos</span><span class="v">${money(d.cargosDirectos)}</span></div>`
      : '';

  const condiciones =
    d.condicionesTexto?.trim() ||
    [
      d.senaSugeridaPct
        ? `Seña del ${d.senaSugeridaPct}% para iniciar el trabajo, saldo contra entrega.`
        : null,
      d.fechaValidez
        ? `Este presupuesto es válido hasta el <b>${esc(fecha(d.fechaValidez))}</b>; pasada esa fecha los precios pueden actualizarse.`
        : null,
    ]
      .filter(Boolean)
      .join(' ');

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>${esc(d.numero)}</title>
<style>
${fuentes(ttf)}
:root{
  --paper:#fbfbf9;--surface:#fff;--surface-2:#f6f5f2;--surface-3:#f1f0ec;
  --border:#e7e5e2;--border-strong:#d9d7d2;--hairline:#eeece8;
  --ink:#14141a;--ink-2:#2c2c33;--muted:#6e6e76;--muted-2:#9a9aa2;
  --accent:#d9642a;--accent-bg:#fdf1ea;--accent-bord:#f2d3c1;
  --green:#16794a;--green-bg:#e9f4ee;--green-bord:#c9e6d6;--green-dot:#28a06a;
  --font-sans:"Geist",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  --font-mono:"Geist Mono",ui-monospace,Menlo,monospace;
}
*{box-sizing:border-box}
html,body{margin:0}
body{background:var(--surface-3);color:var(--ink);font-family:var(--font-sans);font-size:14px;line-height:1.45;letter-spacing:-.005em;-webkit-font-smoothing:antialiased;font-feature-settings:"ss01","cv11";padding:38px 20px 90px}
.mono{font-family:var(--font-mono);font-variant-numeric:tabular-nums}

.sheet{width:794px;min-height:1123px;margin:0 auto;background:var(--paper);border-radius:8px;box-shadow:0 1px 0 rgba(20,20,26,.04),0 30px 70px -28px rgba(20,20,26,.34);overflow:hidden;display:flex;flex-direction:column}

.hd{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;padding:40px 48px 26px}
.hd .tenant{display:flex;align-items:center;gap:15px}
.hd .logo{width:52px;height:52px;border-radius:14px;background:var(--ink);color:#fff;display:grid;place-items:center;font-weight:700;font-size:19px;letter-spacing:-.03em;flex:0 0 auto}
.hd .tn{font-size:21px;font-weight:600;letter-spacing:-.02em;line-height:1.1}
.hd .ts{font-size:12.5px;color:var(--muted);margin-top:3px}
.hd .doc{text-align:right}
.hd .doc .lbl{font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted-2);font-weight:600}
.hd .doc .num{font-family:var(--font-mono);font-size:22px;font-weight:700;letter-spacing:-.02em;margin-top:5px}
.hd .valid{display:inline-flex;align-items:center;gap:7px;margin-top:12px;font-size:12px;font-weight:500;color:var(--green);background:var(--green-bg);border:1px solid var(--green-bord);padding:5px 12px;border-radius:999px}
.hd .valid .d{width:7px;height:7px;border-radius:50%;background:var(--green-dot)}

.meta{display:grid;grid-template-columns:1.3fr 1fr 1fr 1.1fr;gap:0;margin:0 48px;border-top:1px solid var(--hairline);border-bottom:1px solid var(--hairline)}
.meta .m{padding:16px 22px 16px 0}
.meta .m + .m{padding-left:22px;border-left:1px solid var(--hairline)}
.meta .mk{font-size:10px;letter-spacing:.09em;text-transform:uppercase;color:var(--muted-2);font-weight:600}
.meta .mv{font-size:14.5px;font-weight:500;margin-top:6px;color:var(--ink)}
.meta .mv.mono{font-size:14px}

.body{padding:28px 48px 0;flex:1}
.sec-t{font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:600;margin:0 0 14px}

.item{border:1px solid var(--border);border-radius:16px;background:var(--surface);padding:20px 22px;box-shadow:0 1px 0 rgba(20,20,26,.02);break-inside:avoid}
.item + .item{margin-top:12px}
.item-top{display:flex;gap:16px;align-items:flex-start}
.item-idx{width:30px;height:30px;border-radius:9px;background:var(--accent-bg);border:1px solid var(--accent-bord);color:var(--accent);display:grid;place-items:center;font-family:var(--font-mono);font-size:13px;font-weight:700;flex:0 0 auto}
.item-hd{flex:1;min-width:0}
.item-nm{font-size:17px;font-weight:600;letter-spacing:-.01em}
.item-qty{font-family:var(--font-mono);font-size:12.5px;color:var(--muted);margin-top:3px}
.item-qty .iva{font-family:var(--font-sans);font-size:11px;color:var(--muted-2)}
.item-price{font-family:var(--font-mono);font-size:18px;font-weight:700;white-space:nowrap;letter-spacing:-.01em}

.specs{display:flex;flex-wrap:wrap;gap:8px;margin-top:15px;padding-left:46px}
.spec{display:inline-flex;align-items:baseline;gap:7px;font-size:12.5px;background:var(--surface-2);border:1px solid var(--border);border-radius:999px;padding:6px 13px}
.spec .k{color:var(--muted-2);font-weight:500}
.spec .v{color:var(--ink-2);font-weight:500}
.spec.mono .v{font-family:var(--font-mono);font-variant-numeric:tabular-nums}

.opt-wrap{margin-top:16px;padding-left:46px}
.opt-t{font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--green);font-weight:600;margin-bottom:9px}
.opt-list{display:flex;flex-wrap:wrap;gap:8px}
.opt{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:500;color:var(--green);background:var(--green-bg);border:1px solid var(--green-bord);border-radius:999px;padding:5px 13px 5px 9px}
.opt svg{width:14px;height:14px}

.totals{display:flex;justify-content:flex-end;padding:26px 48px 0;break-inside:avoid}
.tot-box{width:340px}
.tot-row{display:flex;justify-content:space-between;padding:9px 4px;font-size:14px;color:var(--muted)}
.tot-row .v{font-family:var(--font-mono);font-variant-numeric:tabular-nums;color:var(--ink-2);font-weight:500}
.tot-grand{display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding:17px 20px;background:var(--ink);color:#fff;border-radius:14px}
.tot-grand .l{font-size:12px;letter-spacing:.08em;text-transform:uppercase;font-weight:600;color:rgba(255,255,255,.68)}
.tot-grand .v{font-family:var(--font-mono);font-variant-numeric:tabular-nums;font-size:25px;font-weight:700;letter-spacing:-.01em}

.foot{padding:28px 48px 40px;break-inside:avoid}
.cond{display:flex;gap:13px;padding:16px 18px;border-radius:14px;background:var(--accent-bg);border:1px solid var(--accent-bord);align-items:flex-start}
.cond .ci{color:var(--accent);flex:0 0 auto;margin-top:1px}
.cond .ci svg{width:19px;height:19px}
.cond .ct{font-size:13px;color:var(--ink-2);line-height:1.5}
.cond .ct b{font-weight:600}
.sign{display:flex;justify-content:space-between;align-items:center;margin-top:22px;padding-top:18px;border-top:1px solid var(--hairline);font-size:11.5px;color:var(--muted-2)}
.sign .g{display:inline-flex;align-items:center;gap:7px}
.sign .g .gm{width:16px;height:16px;border-radius:5px;background:var(--ink);color:#fff;display:grid;place-items:center;font-size:9px;font-weight:700}

@media print{
  @page{size:A4;margin:0}
  body{background:#fff;padding:0}
  .sheet{width:100%;min-height:100vh;box-shadow:none;border-radius:0}
}
</style>
</head>
<body>
<div class="sheet">
  <div class="hd">
    <div class="tenant">
      <div class="logo">${esc(iniciales(d.negocio))}</div>
      <div>
        <div class="tn">${esc(d.negocio)}</div>
        <div class="ts">Presupuesto comercial</div>
      </div>
    </div>
    <div class="doc">
      <div class="lbl">Presupuesto</div>
      <div class="num">${esc(d.numero)}</div>
      ${d.fechaValidez ? `<div class="valid"><span class="d"></span>Válido hasta ${esc(fecha(d.fechaValidez))}</div>` : ''}
    </div>
  </div>

  <div class="meta">
    <div class="m"><div class="mk">Cliente</div><div class="mv">${esc(d.cliente ?? '—')}</div></div>
    <div class="m"><div class="mk">Fecha</div><div class="mv mono">${esc(fecha(d.fechaEmision))}</div></div>
    <div class="m"><div class="mk">Válido hasta</div><div class="mv mono">${esc(fecha(d.fechaValidez))}</div></div>
    <div class="m"><div class="mk">Vendedor</div><div class="mv">${esc(d.vendedor ?? '—')}</div></div>
  </div>

  <div class="body">
    <h3 class="sec-t">Detalle</h3>
    ${items}
  </div>

  <div class="totals">
    <div class="tot-box">
      <div class="tot-row"><span>Subtotal</span><span class="v">${money(d.subtotal)}</span></div>
      ${filaCargos}
      <div class="tot-row"><span>${esc(rotuloImpuestos)}</span><span class="v">${money(d.impuestos)}</span></div>
      <div class="tot-grand"><span class="l">Total</span><span class="v">${money(d.total)}</span></div>
    </div>
  </div>

  <div class="foot">
    ${
      condiciones
        ? `<div class="cond">
      <span class="ci"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></span>
      <div class="ct"><b>Condiciones de pago:</b> ${condiciones}</div>
    </div>`
        : ''
    }
    ${d.observaciones ? `<div class="cond" style="margin-top:12px;background:var(--surface-2);border-color:var(--border)"><div class="ct">${esc(d.observaciones)}</div></div>` : ''}
    <div class="sign">
      <span>Gracias por confiar en ${esc(d.negocio)}.</span>
      <span class="g"><span class="gm">G</span>Generado con Grafoprint</span>
    </div>
  </div>
</div>
</body>
</html>`;
}
