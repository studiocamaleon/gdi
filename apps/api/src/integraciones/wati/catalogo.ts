/**
 * Catálogo canónico de plantillas de Grafo.
 *
 * Los textos los define Grafo, no el tenant (decisión D1). Acá viven en
 * código y no en la base a propósito: son parte del producto, se revisan por
 * pull request y no puede haber dos tenants con textos distintos para el
 * mismo evento sin que quede registrado.
 *
 * El código lleva versión (`_v1`) porque una plantilla aprobada por Meta es
 * prácticamente inmutable: si cambia el texto, se somete una nueva y conviven
 * (decisión D2). Nunca se edita el `cuerpo` de un código ya sometido.
 *
 * Textos y fundamentos: docs/notificaciones-whatsapp-textos.md
 */

export type EventoNotificacion =
  | 'presupuesto_enviado'
  | 'presupuesto_por_vencer'
  | 'presupuesto_aprobado'
  | 'orden_recibida'
  | 'orden_en_produccion'
  | 'orden_demorada'
  | 'orden_lista'
  | 'orden_lista_con_saldo'
  | 'orden_entregada'
  | 'pago_recibido'
  | 'saldo_vencido'
  | 'comprobante_emitido'
  | 'resena';

export type CategoriaPlantilla = 'UTILITY' | 'MARKETING';

export type PlantillaCanonica = {
  evento: EventoNotificacion;
  /** `elementName` en Wati. Con versión: ver D2. */
  codigo: string;
  titulo: string;
  /** Cuándo se dispara, en una línea, para la UI. */
  cuando: string;
  /** La que le PEDIMOS a Meta. La que asigna puede ser otra. */
  categoria: CategoriaPlantilla;
  idioma: string;
  activoPorDefecto: boolean;
  /** Cuerpo posicional, tal como lo ve Meta. */
  cuerpo: string;
  footer: string;
  /** En orden: el primero es {{1}}. `ejemplo` va en el alta. */
  parametros: Array<{ nombre: string; ejemplo: string }>;
};

/**
 * Idéntico en todos los tenants, que es justamente lo que se busca: el
 * footer de Meta no admite variables. Máximo 60 caracteres.
 *
 * No afecta la categoría — verificado contra la cuenta real, donde
 * `recibo_pago_v2` es UTILITY con un footer de esta misma forma.
 */
export const FOOTER = 'Tecnología desarrollada por Grafoprint';

const IDIOMA = 'es_AR';

export const CATALOGO: PlantillaCanonica[] = [
  {
    evento: 'presupuesto_enviado',
    codigo: 'grafo_presupuesto_enviado_v1',
    titulo: 'Presupuesto enviado',
    cuando: 'Cuando el presupuesto pasa a enviado',
    categoria: 'UTILITY',
    idioma: IDIOMA,
    activoPorDefecto: true,
    cuerpo: `Hola {{1}}, acá va el presupuesto {{2}} que nos pediste. 📄

Importe total: \${{3}}
Válido hasta: {{4}}

Para verlo en detalle y aprobarlo: {{5}}

Si no lo pediste, ignorá este mensaje.`,
    footer: FOOTER,
    parametros: [
      { nombre: 'nombre_cliente', ejemplo: 'Marcela' },
      { nombre: 'numero_presupuesto', ejemplo: 'P-00142' },
      { nombre: 'total', ejemplo: '185.400,00' },
      { nombre: 'fecha_vencimiento', ejemplo: '05/08/2026' },
      { nombre: 'url_presupuesto', ejemplo: 'https://app.grafo.ar/p/a1b2c3' },
    ],
  },
  {
    evento: 'presupuesto_por_vencer',
    codigo: 'grafo_presupuesto_por_vencer_v1',
    titulo: 'Presupuesto por vencer',
    cuando: 'Unos días antes de que venza',
    categoria: 'MARKETING',
    idioma: IDIOMA,
    activoPorDefecto: false,
    cuerpo: `Hola {{1}}, te recordamos que el presupuesto {{2}} vence el {{3}}.

Si querés avanzar, podés aprobarlo acá: {{4}}

Si ya no te interesa, no hace falta que hagas nada.`,
    footer: FOOTER,
    parametros: [
      { nombre: 'nombre_cliente', ejemplo: 'Marcela' },
      { nombre: 'numero_presupuesto', ejemplo: 'P-00142' },
      { nombre: 'fecha_vencimiento', ejemplo: '05/08/2026' },
      { nombre: 'url_presupuesto', ejemplo: 'https://app.grafo.ar/p/a1b2c3' },
    ],
  },
  {
    evento: 'presupuesto_aprobado',
    codigo: 'grafo_presupuesto_aprobado_v1',
    titulo: 'Presupuesto aprobado',
    cuando: 'Cuando el cliente aprueba desde el link público',
    categoria: 'UTILITY',
    idioma: IDIOMA,
    activoPorDefecto: true,
    cuerpo: `Hola {{1}}, recibimos tu aprobación del presupuesto {{2}} por \${{3}}. ✅

Copia del presupuesto aprobado: {{4}}

Ya preparamos la orden de trabajo y te avisamos cuando entre en producción.`,
    footer: FOOTER,
    parametros: [
      { nombre: 'nombre_cliente', ejemplo: 'Marcela' },
      { nombre: 'numero_presupuesto', ejemplo: 'P-00142' },
      { nombre: 'total', ejemplo: '185.400,00' },
      { nombre: 'url_presupuesto', ejemplo: 'https://app.grafo.ar/p/a1b2c3' },
    ],
  },
  {
    evento: 'orden_recibida',
    codigo: 'grafo_orden_recibida_v1',
    titulo: 'Orden recibida',
    cuando: 'Cuando la orden pasa a pendiente',
    categoria: 'UTILITY',
    idioma: IDIOMA,
    activoPorDefecto: true,
    cuerpo: `Hola {{1}}, recibimos tu orden {{2}}. 🧾

📅 Entrega estimada: {{3}}

Podés seguir el avance acá: {{4}}

Si la fecha cambia, te avisamos por este medio.`,
    footer: FOOTER,
    parametros: [
      { nombre: 'nombre_cliente', ejemplo: 'Marcela' },
      { nombre: 'numero_orden', ejemplo: 'OT-01285' },
      { nombre: 'fecha_estimada', ejemplo: '29/07/2026' },
      { nombre: 'url_seguimiento', ejemplo: 'https://app.grafo.ar/s/x7y8z9' },
    ],
  },
  {
    evento: 'orden_en_produccion',
    codigo: 'grafo_orden_en_produccion_v1',
    titulo: 'Orden en producción',
    cuando: 'Cuando arranca el primer paso',
    categoria: 'UTILITY',
    idioma: IDIOMA,
    activoPorDefecto: false,
    cuerpo: `Hola {{1}}, ya empezamos a producir tu orden {{2}}. 🖨️

📅 Entrega estimada: {{3}}

Seguimiento: {{4}}

No necesitás hacer nada por ahora.`,
    footer: FOOTER,
    parametros: [
      { nombre: 'nombre_cliente', ejemplo: 'Marcela' },
      { nombre: 'numero_orden', ejemplo: 'OT-01285' },
      { nombre: 'fecha_estimada', ejemplo: '29/07/2026' },
      { nombre: 'url_seguimiento', ejemplo: 'https://app.grafo.ar/s/x7y8z9' },
    ],
  },
  {
    evento: 'orden_demorada',
    codigo: 'grafo_orden_demorada_v1',
    titulo: 'Entrega demorada',
    cuando: 'Cuando el ETA se corre más de lo tolerado',
    categoria: 'UTILITY',
    idioma: IDIOMA,
    activoPorDefecto: true,
    cuerpo: `Hola {{1}}, te avisamos de un cambio en la fecha de tu orden {{2}}.

📅 Entrega estimada: pasó del {{3}} al {{4}}.

Detalle actualizado: {{5}}

Si necesitás coordinar algo, respondenos por acá.`,
    footer: FOOTER,
    parametros: [
      { nombre: 'nombre_cliente', ejemplo: 'Marcela' },
      { nombre: 'numero_orden', ejemplo: 'OT-01285' },
      { nombre: 'fecha_anterior', ejemplo: '29/07/2026' },
      { nombre: 'fecha_nueva', ejemplo: '04/08/2026' },
      { nombre: 'url_seguimiento', ejemplo: 'https://app.grafo.ar/s/x7y8z9' },
    ],
  },
  {
    evento: 'orden_lista',
    codigo: 'grafo_orden_lista_v1',
    titulo: 'Orden lista',
    cuando: 'Cuando la orden se finaliza y no quedó saldo',
    categoria: 'UTILITY',
    idioma: IDIOMA,
    activoPorDefecto: true,
    cuerpo: `Hola {{1}}, tu orden {{2}} ya está lista. 📦

Podés pasar a retirarla por nuestro local o, si pediste envío, te avisamos cuando salga.

Detalle: {{3}}

No tenés saldo pendiente por este trabajo.`,
    footer: FOOTER,
    parametros: [
      { nombre: 'nombre_cliente', ejemplo: 'Marcela' },
      { nombre: 'numero_orden', ejemplo: 'OT-01285' },
      { nombre: 'url_seguimiento', ejemplo: 'https://app.grafo.ar/s/x7y8z9' },
    ],
  },
  {
    evento: 'orden_lista_con_saldo',
    codigo: 'grafo_orden_lista_con_saldo_v1',
    titulo: 'Orden lista (con saldo)',
    cuando: 'Cuando la orden se finaliza y queda saldo pendiente',
    categoria: 'UTILITY',
    idioma: IDIOMA,
    activoPorDefecto: true,
    cuerpo: `Hola {{1}}, tu orden {{2}} ya está lista. 📦

💰 Saldo pendiente: \${{3}}

Podés pasar a retirarla por nuestro local o, si pediste envío, te avisamos cuando salga.

Detalle: {{4}}

Si ya lo abonaste, puede que todavía no lo hayamos registrado.`,
    footer: FOOTER,
    parametros: [
      { nombre: 'nombre_cliente', ejemplo: 'Marcela' },
      { nombre: 'numero_orden', ejemplo: 'OT-01285' },
      { nombre: 'saldo_pendiente', ejemplo: '92.700,00' },
      { nombre: 'url_seguimiento', ejemplo: 'https://app.grafo.ar/s/x7y8z9' },
    ],
  },
  {
    evento: 'orden_entregada',
    codigo: 'grafo_orden_entregada_v1',
    titulo: 'Orden entregada',
    cuando: 'Cuando se marca la entrega',
    categoria: 'UTILITY',
    idioma: IDIOMA,
    activoPorDefecto: false,
    cuerpo: `Hola {{1}}, confirmamos la entrega de tu orden {{2}} el {{3}}. ✅

Guardá este mensaje como constancia.`,
    footer: FOOTER,
    parametros: [
      { nombre: 'nombre_cliente', ejemplo: 'Marcela' },
      { nombre: 'numero_orden', ejemplo: 'OT-01285' },
      { nombre: 'fecha_entrega', ejemplo: '29/07/2026' },
    ],
  },
  {
    evento: 'pago_recibido',
    codigo: 'grafo_pago_recibido_v1',
    titulo: 'Pago recibido',
    cuando: 'Cuando el cobro se acredita',
    categoria: 'UTILITY',
    idioma: IDIOMA,
    activoPorDefecto: true,
    cuerpo: `Hola {{1}}, registramos tu pago de \${{2}} para la orden {{3}}. 💳

Saldo restante: \${{4}}

*Ver recibo:* {{5}}

Este mensaje es la constancia de que registramos el pago.`,
    footer: FOOTER,
    parametros: [
      { nombre: 'nombre_cliente', ejemplo: 'Marcela' },
      { nombre: 'monto_pagado', ejemplo: '92.700,00' },
      { nombre: 'numero_orden', ejemplo: 'OT-01285' },
      { nombre: 'saldo_restante', ejemplo: '0,00' },
      { nombre: 'url_recibo', ejemplo: 'https://app.grafo.ar/r/k4m5n6' },
    ],
  },
  {
    evento: 'saldo_vencido',
    codigo: 'grafo_saldo_vencido_v1',
    titulo: 'Saldo vencido',
    cuando: 'Cuando queda deuda vencida en la cuenta corriente',
    categoria: 'UTILITY',
    idioma: IDIOMA,
    activoPorDefecto: false,
    cuerpo: `Hola {{1}}, nos figura un saldo vencido en tu cuenta.

💰 Importe: \${{2}}
📅 Venció el: {{3}}

Detalle de la cuenta: {{4}}

Si ya lo abonaste, avisanos y lo regularizamos.`,
    footer: FOOTER,
    parametros: [
      { nombre: 'nombre_cliente', ejemplo: 'Marcela' },
      { nombre: 'monto_vencido', ejemplo: '92.700,00' },
      { nombre: 'fecha_vencimiento', ejemplo: '15/07/2026' },
      { nombre: 'url_cuenta', ejemplo: 'https://app.grafo.ar/c/p9q8r7' },
    ],
  },
  {
    evento: 'comprobante_emitido',
    codigo: 'grafo_comprobante_emitido_v1',
    titulo: 'Comprobante emitido',
    cuando: 'Cuando se emite la factura con CAE',
    categoria: 'UTILITY',
    idioma: IDIOMA,
    activoPorDefecto: false,
    cuerpo: `Hola {{1}}, emitimos tu {{2}} N° {{3}} por \${{4}}. 🧾

Podés descargarla acá: {{5}}

También te queda disponible en el seguimiento de tu orden.`,
    footer: FOOTER,
    parametros: [
      { nombre: 'nombre_cliente', ejemplo: 'Marcela' },
      { nombre: 'tipo_comprobante', ejemplo: 'Factura B' },
      { nombre: 'numero_comprobante', ejemplo: '0003-00001285' },
      { nombre: 'total', ejemplo: '224.334,00' },
      { nombre: 'url_comprobante', ejemplo: 'https://app.grafo.ar/f/t3u4v5' },
    ],
  },
  {
    evento: 'resena',
    codigo: 'grafo_resena_v1',
    titulo: 'Pedido de reseña',
    cuando: 'Unos días después de la entrega',
    categoria: 'MARKETING',
    idioma: IDIOMA,
    activoPorDefecto: false,
    cuerpo: `Hola {{1}}, ¿cómo te fue con tu orden {{2}}? 🙂

Nos ayuda mucho saber tu opinión. Si tenés un minuto, podés dejarnos una reseña acá: {{3}}

Si preferís no hacerlo, no hay problema.`,
    footer: FOOTER,
    parametros: [
      { nombre: 'nombre_cliente', ejemplo: 'Marcela' },
      { nombre: 'numero_orden', ejemplo: 'OT-01285' },
      { nombre: 'url_resena', ejemplo: 'https://g.page/r/ejemplo/review' },
    ],
  },
];

export const POR_CODIGO = new Map(CATALOGO.map((p) => [p.codigo, p]));

/**
 * Valida un texto contra las reglas de Meta ANTES de someterlo.
 *
 * Existe porque el ciclo de error del otro lado es carísimo: Meta tarda
 * 24-48 h en rechazar y el motivo que devuelve suele ser genérico. Estas
 * cinco reglas son las que se pueden verificar sin salir de casa, y las
 * ejercita un test sobre las 13 plantillas del catálogo.
 */
export function validar(p: PlantillaCanonica): string[] {
  const errores: string[] = [];
  const cuerpo = p.cuerpo.trim();

  if (cuerpo.length > 1024) {
    errores.push(
      `El cuerpo tiene ${cuerpo.length} caracteres; el máximo es 1024.`,
    );
  }
  if (p.footer.length > 60) {
    errores.push(
      `El footer tiene ${p.footer.length} caracteres; el máximo es 60.`,
    );
  }
  // Meta rechaza cuerpos que arrancan o terminan en variable.
  if (/^\s*\{\{/.test(cuerpo)) {
    errores.push('El cuerpo no puede empezar con una variable.');
  }
  if (/\}\}\s*$/.test(cuerpo)) {
    errores.push('El cuerpo no puede terminar con una variable.');
  }
  // Ni dos variables pegadas, con o sin espacio en el medio.
  if (/\}\}\s*\{\{/.test(cuerpo)) {
    errores.push(
      'No puede haber dos variables seguidas sin texto en el medio.',
    );
  }

  // Las posiciones tienen que ser 1..n exactas: ni salteadas ni de más.
  const usadas = [...cuerpo.matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map((m) =>
    Number(m[1]),
  );
  const esperadas = p.parametros.map((_, i) => i + 1);
  const faltan = esperadas.filter((n) => !usadas.includes(n));
  const sobran = [...new Set(usadas)].filter((n) => !esperadas.includes(n));
  if (faltan.length) {
    errores.push(
      `Declara parámetros que el cuerpo no usa: {{${faltan.join('}}, {{')}}}.`,
    );
  }
  if (sobran.length) {
    errores.push(
      `El cuerpo usa variables no declaradas: {{${sobran.join('}}, {{')}}}.`,
    );
  }
  if (p.parametros.some((x) => !x.ejemplo.trim())) {
    errores.push(
      'Todos los parámetros necesitan un valor de ejemplo para el alta.',
    );
  }

  return errores;
}
