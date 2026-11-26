import sharp from 'sharp';
import type { DespachoOrden } from '../ordenes-trabajo/despacho';

export type DatosEtiquetaEnvio = DespachoOrden & {
  numero: string;
  cliente: string;
  telefonoCliente: string;
  empresa: string;
  domicilioEmpresa: string;
  telefonoEmpresa: string;
};

/** Ajusta el texto completo al bloque disponible. Dirección y localidad pueden
 * ocupar varias líneas, también en etiquetas térmicas de ocho puntos por mm. */
async function bloque(
  valor: string,
  left: number,
  top: number,
  width: number,
  height: number,
  size: number,
  negrita = false,
) {
  const text = valor
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const imagen = await sharp({
    text: {
      text: text || '—',
      font: `DejaVu Sans ${negrita ? 'Bold ' : ''}${size}`,
      width,
      wrap: 'word-char',
      rgba: true,
      dpi: 72,
    },
  })
    .png()
    .toBuffer();
  const input = await sharp(imagen)
    .resize({ width, height, fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();
  return { input, left, top };
}

export async function renderizarEtiquetaEnvio(
  d: DatosEtiquetaEnvio,
): Promise<Buffer> {
  const fondo =
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
  <rect width="1200" height="800" fill="white"/>
  <g font-family="DejaVu Sans, sans-serif" fill="black">
    <rect x="32" y="32" width="215" height="76" fill="black"/>
    <text x="57" y="86" fill="white" font-size="49" font-weight="bold">ENVÍO</text>
    <g font-size="21" font-weight="bold" letter-spacing="2">
      <text x="280" y="60">ORDEN DE TRABAJO</text>
      <text x="48" y="169">LOCALIDAD DE DESTINO</text>
      <text x="48" y="293">DESTINATARIO</text>
      <text x="48" y="396">DOMICILIO O SUCURSAL</text>
      <text x="48" y="544">TRANSPORTE</text>
      <text x="795" y="169">REMITENTE</text>
      ${d.telefonoEmpresa ? '<text x="795" y="448">TEL. REMITENTE</text>' : ''}
      ${d.telefonoCliente ? '<text x="795" y="544">TEL. DESTINATARIO</text>' : ''}
    </g>
    <path d="M32 129H1168 M765 151V613 M32 636H1168" fill="none" stroke="black" stroke-width="3"/>
    <text x="48" y="725" font-size="40" font-weight="bold">BULTO N°</text>
    <text x="703" y="725" font-size="36">de</text>
    <path d="M295 733H654 M801 733H1148" fill="none" stroke="black" stroke-width="3"/>
  </g></svg>`);
  const bloques = await Promise.all([
    bloque(d.numero, 280, 72, 850, 42, 36, true),
    bloque(d.localidad, 48, 185, 688, 86, 55, true),
    bloque(d.cliente, 48, 307, 688, 63, 39, true),
    bloque(d.direccion, 48, 411, 688, 106, 32),
    bloque(d.transporte || 'A definir', 48, 559, 688, 57, 30),
    bloque(d.empresa, 795, 189, 365, 96, 34, true),
    ...(d.domicilioEmpresa
      ? [bloque(d.domicilioEmpresa, 795, 302, 365, 115, 25)]
      : []),
    ...(d.telefonoEmpresa
      ? [bloque(d.telefonoEmpresa, 795, 462, 365, 57, 27)]
      : []),
    ...(d.telefonoCliente
      ? [bloque(d.telefonoCliente, 795, 559, 365, 57, 27)]
      : []),
  ]);
  return sharp(fondo).composite(bloques).png().toBuffer();
}
