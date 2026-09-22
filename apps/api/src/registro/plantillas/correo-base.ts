import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const MARCA_CORREO_CID = 'marca-grafoprint';
const marca = readFileSync(join(__dirname, 'assets', 'marca-grafoprint.png'));

export function adjuntosMarcaCorreo() {
  return [
    {
      filename: 'marca-grafoprint.png',
      content: marca,
      contentType: 'image/png',
      contentId: MARCA_CORREO_CID,
    },
  ];
}

export function escaparHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char] ?? char,
  );
}

/** Sólo contenido HTML construido por las plantillas; los datos se escapan allí.
 * Tablas y estilos inline mantienen el contenido legible sin CSS externo. */
export function crearCorreoBase(args: {
  titulo: string;
  preheader: string;
  contenido: string;
  pie: string;
  prueba?: boolean;
}) {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escaparHtml(args.titulo)}</title>
  <style>
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
    table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
    img{border:0;outline:none;text-decoration:none}
    @media only screen and (max-width:620px){
      .exterior{padding:20px 12px!important}
      .interior{padding:30px 24px!important}
      .cabecera{padding:25px 24px!important}
      .titulo{font-size:30px!important;line-height:35px!important}
      .dato{display:block!important;width:auto!important;padding:6px 0!important}
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f3f2ee;color:#17191b;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;mso-hide:all;">${escaparHtml(args.preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f3f2ee" style="width:100%;background-color:#f3f2ee;">
    <tr><td class="exterior" align="center" style="padding:40px 16px;">
      <!--[if mso]><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;">
        <tr><td class="cabecera" bgcolor="#101214" style="padding:30px 40px;background-color:#101214;border-radius:10px 10px 0 0;border-bottom:3px solid #ff7546;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
            <td width="46" style="width:46px;vertical-align:middle;"><img src="cid:${MARCA_CORREO_CID}" width="34" height="34" alt="" style="display:block;width:34px;height:34px;"></td>
            <td style="vertical-align:middle;font-size:25px;line-height:30px;font-weight:700;letter-spacing:-1px;color:#fbfaf7;">grafoprint<span style="color:#ff7546;">.</span></td>
          </tr></table>
        </td></tr>
        <tr><td class="interior" bgcolor="#fbfaf7" style="padding:40px;background-color:#fbfaf7;border:1px solid #deded7;border-top:0;border-radius:0 0 10px 10px;">
          ${args.prueba ? '<p style="margin:0 0 24px;padding:12px 14px;border-left:3px solid #ff7546;background-color:#f3f2ee;font-size:12px;line-height:18px;color:#646668;"><strong style="color:#17191b;">Vista de prueba</strong><br>Datos de ejemplo. El botón abre la web de Grafo; no confirma ni crea una cuenta.</p>' : ''}
          ${args.contenido}
        </td></tr>
        <tr><td style="padding:24px 16px 0;font-size:12px;line-height:19px;color:#646668;word-break:break-word;">
          ${args.pie}
          <p style="margin:22px 0 0;padding-top:18px;border-top:1px solid #deded7;font-size:11px;line-height:17px;">Grafoprint · GRUPO IDEA SAS<br>Gestión para la industria gráfica.</p>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>`;
}
