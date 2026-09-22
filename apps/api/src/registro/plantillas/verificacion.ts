import { crearCorreoBase, escaparHtml as esc } from './correo-base';

export type DatosVerificacion = {
  nombre: string;
  empresa: string;
  plan: string;
  trialDias: number | null;
  url: string;
};

export function crearCorreoVerificacion(
  args: DatosVerificacion,
  opciones: { prueba?: boolean } = {},
) {
  const enlace = new URL(args.url);
  if (
    !['https:', 'http:'].includes(enlace.protocol) ||
    enlace.username ||
    enlace.password
  ) {
    throw new Error('El enlace de verificación debe ser una URL HTTP o HTTPS.');
  }
  const url = esc(args.url);
  const dias = args.trialDias;
  const tieneTrial = dias !== null && Number.isInteger(dias) && dias > 0;
  const trial = tieneTrial
    ? `${dias} ${dias === 1 ? 'día' : 'días'} de prueba`
    : null;
  const subject = `${opciones.prueba ? '[PRUEBA] ' : ''}Confirmá tu correo · Grafo`;
  const text = [
    ...(opciones.prueba
      ? [
          'VISTA DE PRUEBA. Datos de ejemplo; el enlace abre la web de Grafo y no crea ni confirma una cuenta.',
          '',
        ]
      : []),
    `Hola ${args.nombre}.`,
    `Confirmá tu correo para crear el espacio de ${args.empresa} en Grafo.`,
    `Empresa: ${args.empresa}`,
    `Plan: ${args.plan}`,
    ...(trial
      ? [
          `${trial}, sin tarjeta. El período comienza cuando confirmás tu cuenta.`,
        ]
      : []),
    '',
    `Confirmar mi correo: ${args.url}`,
    '',
    'El enlace vence en 2 horas. Si no solicitaste esta cuenta, podés ignorar este mensaje.',
    'Grafoprint · GRUPO IDEA SAS',
  ].join('\n');
  const html = crearCorreoBase({
    titulo: subject,
    preheader: `Confirmá tu correo para empezar a trabajar con ${args.empresa}. El enlace vence en 2 horas.`,
    prueba: opciones.prueba,
    contenido: `
      <p style="margin:0 0 20px;font-family:'Courier New',monospace;font-size:11px;line-height:16px;letter-spacing:1.6px;color:#b8421d;">TU CUENTA EN GRAFO</p>
      <h1 class="titulo" style="margin:0 0 20px;font-size:36px;line-height:40px;letter-spacing:-1.3px;font-weight:700;color:#17191b;">Confirmá tu correo<span style="color:#b8421d;">.</span></h1>
      <p style="margin:0 0 26px;font-size:15px;line-height:24px;color:#646668;">Hola <strong style="color:#17191b;">${esc(args.nombre)}</strong>. Ya falta poco para empezar.<br>Confirmá tu correo para crear el espacio de tu empresa.</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-top:1px solid #deded7;border-bottom:1px solid #deded7;">
        <tr><td style="padding:16px 0;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;table-layout:fixed;">
            <tr>
              <td class="dato" width="55%" style="width:55%;vertical-align:top;padding-right:16px;word-wrap:break-word;overflow-wrap:anywhere;">
                <p style="margin:0 0 5px;font-family:'Courier New',monospace;font-size:10px;line-height:15px;letter-spacing:1px;color:#646668;">EMPRESA</p>
                <p style="margin:0;font-size:14px;line-height:21px;font-weight:700;color:#17191b;">${esc(args.empresa)}</p>
              </td>
              <td class="dato" width="45%" style="width:45%;vertical-align:top;word-wrap:break-word;overflow-wrap:anywhere;">
                <p style="margin:0 0 5px;font-family:'Courier New',monospace;font-size:10px;line-height:15px;letter-spacing:1px;color:#646668;">PLAN ELEGIDO</p>
                <p style="margin:0;font-size:14px;line-height:21px;font-weight:700;color:#17191b;">${esc(args.plan)}</p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
      ${trial ? `<p style="margin:20px 0 0;font-size:14px;line-height:22px;color:#17191b;"><strong>${trial}.</strong> Sin tarjeta.<br><span style="font-size:12px;color:#646668;">El período comienza cuando confirmás tu cuenta.</span></p>` : ''}
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:28px;"><tr>
        <td align="center" bgcolor="#ff7546" style="border-radius:6px;background-color:#ff7546;mso-padding-alt:15px 24px;">
          <a href="${url}" style="display:inline-block;border:1px solid #ff7546;border-radius:6px;padding:15px 24px;font-size:14px;line-height:20px;font-weight:700;color:#101214;text-decoration:none;mso-padding-alt:0;">Confirmar mi correo&nbsp; →</a>
        </td>
      </tr></table>
      <p style="margin:18px 0 0;font-size:12px;line-height:18px;color:#646668;">Por seguridad, este enlace vence en <strong>2 horas</strong>.</p>`,
    pie: `<p style="margin:0 0 12px;">Si no solicitaste esta cuenta, podés ignorar este mensaje.</p>
      <p style="margin:0;">¿No funciona el botón? Copiá este enlace en tu navegador:<br><a href="${url}" style="color:#646668;text-decoration:underline;word-break:break-all;overflow-wrap:anywhere;">${url}</a></p>`,
  });
  return { subject, text, html };
}
