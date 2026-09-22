import { crearCorreoBase, escaparHtml as esc } from './correo-base';

export type DatosInvitacionEmpresa = {
  empresa: string;
  plan: string;
  url: string;
  venceEl: Date;
  trialHasta: Date | null;
  moneda: string;
  mensual: number | null;
  implementacion: number | null;
};

export function crearCorreoInvitacionEmpresa(
  args: DatosInvitacionEmpresa,
  opciones: { prueba?: boolean } = {},
) {
  const url = new URL(args.url);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new Error('El enlace de invitación debe ser HTTP o HTTPS.');
  }
  const fecha = (d: Date) =>
    new Intl.DateTimeFormat('es-AR', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'UTC',
    }).format(d) + ' UTC';
  const importe = (n: number) =>
    `${args.moneda} ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(n)}`;
  const filas = [
    ['Empresa', args.empresa],
    ['Plan', args.plan],
    ...(args.trialHasta
      ? [['Prueba disponible hasta', fecha(args.trialHasta)]]
      : []),
    ...(args.mensual !== null
      ? [['Abono mensual al contratar', importe(args.mensual)]]
      : []),
    ...(args.implementacion !== null
      ? [
          [
            'Implementación',
            args.implementacion === 0
              ? 'Sin cargo'
              : `${importe(args.implementacion)} · por única vez`,
          ],
        ]
      : []),
  ];
  const aviso =
    'Aceptar la invitación no realiza un cobro. La contratación se confirma por separado desde Suscripción; los impuestos aplicables se muestran en el checkout.';
  const subject = `${opciones.prueba ? '[PRUEBA] ' : ''}Tu invitación a ${args.plan} · Grafo`;
  const text = [
    ...(opciones.prueba
      ? [
          'VISTA DE PRUEBA. El enlace abre la web de Grafo y no activa ninguna cuenta.',
          '',
        ]
      : []),
    `Te invitamos a administrar ${args.empresa} en Grafo.`,
    ...filas.map(([k, v]) => `${k}: ${v}`),
    aviso,
    `Activar mi acceso: ${args.url}`,
    `El enlace es personal, de un solo uso, y vence el ${fecha(args.venceEl)}.`,
    'Si ya tenés cuenta, se suma el acceso a esta empresa. Tu contraseña no cambia.',
    'Si no esperabas esta invitación, podés ignorar el mensaje.',
    'Grafoprint · GRUPO IDEA SAS',
  ].join('\n');
  const html = crearCorreoBase({
    titulo: subject,
    preheader: `Tu invitación a ${args.plan} para ${args.empresa}. Activá tu acceso a Grafo.`,
    prueba: opciones.prueba,
    contenido: `
      <p style="margin:0 0 20px;font:11px/16px 'Courier New',monospace;letter-spacing:1.6px;color:#b8421d;">UNA INVITACIÓN PARA TU EMPRESA</p>
      <h1 class="titulo" style="margin:0 0 20px;font-size:36px;line-height:40px;letter-spacing:-1.3px;color:#17191b;">Tu lugar en Grafo<span style="color:#b8421d;">.</span></h1>
      <p style="margin:0 0 26px;font-size:15px;line-height:24px;color:#646668;">Te invitamos a administrar <strong style="color:#17191b;">${esc(args.empresa)}</strong>. Tu espacio ya está preparado con <strong style="color:#17191b;">${esc(args.plan)}</strong>.</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-top:1px solid #deded7;table-layout:fixed;">
      ${filas.map(([k, v]) => `<tr><td class="dato" width="48%" style="padding:12px 12px 12px 0;border-bottom:1px solid #deded7;vertical-align:top;font-size:12px;line-height:20px;color:#646668;">${esc(k)}</td><td class="dato" width="52%" style="padding:12px 0;border-bottom:1px solid #deded7;vertical-align:top;font-size:13px;line-height:20px;font-weight:700;color:#17191b;overflow-wrap:anywhere;">${esc(v)}</td></tr>`).join('')}
      </table>
      <p style="margin:20px 0 0;font-size:12px;line-height:19px;color:#646668;">${aviso}</p>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:26px;"><tr><td align="center" bgcolor="#ff7546" style="border-radius:6px;mso-padding-alt:15px 24px;"><a href="${esc(args.url)}" style="display:inline-block;padding:15px 24px;border:1px solid #ff7546;border-radius:6px;font-size:14px;line-height:20px;font-weight:700;color:#101214;text-decoration:none;mso-padding-alt:0;">Activar mi acceso&nbsp; →</a></td></tr></table>
      <p style="margin:18px 0 0;font-size:12px;line-height:19px;color:#646668;">Si ya tenés cuenta, se suma el acceso a esta empresa.<br>Tu contraseña no cambia.</p>`,
    pie: `<p style="margin:0 0 12px;">Este enlace es personal, de un solo uso, y vence el <strong>${esc(fecha(args.venceEl))}</strong>. Si no esperabas esta invitación, podés ignorar el mensaje.</p><p style="margin:0;">Si el botón no funciona, copiá el enlace:<br><a href="${esc(args.url)}" style="color:#646668;word-break:break-all;overflow-wrap:anywhere;">${esc(args.url)}</a></p>`,
  });
  return { subject, text, html };
}
