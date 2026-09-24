import {
  crearCorreoBase,
  escaparHtml,
} from '../registro/plantillas/correo-base';

export const ASUNTO_PRESUPUESTO = 'Tu presupuesto de {empresa} · {presupuesto}';
export const MENSAJE_PRESUPUESTO =
  'Hola, {cliente}:\n\nTe adjuntamos el presupuesto {presupuesto} en PDF. Podés revisarlo y aprobarlo desde el botón que encontrarás a continuación.\n\nSi tenés alguna consulta, respondé a este correo.\n\nSaludos,\n{empresa}';

export function completarPlantilla(
  texto: string,
  valores: Record<string, string>,
) {
  return texto.replace(
    /\{(empresa|presupuesto|cliente)\}/g,
    (_, clave: string) => valores[clave] ?? '',
  );
}

export function crearCorreoPresupuesto(datos: {
  empresa: string;
  numero: string;
  asunto: string;
  mensaje: string;
  url: string;
  responderA: string;
}) {
  const e = escaparHtml;
  return {
    subject: datos.asunto,
    text: `${datos.mensaje}\n\nVer y aprobar presupuesto: ${datos.url}\n\nAdjunto: ${datos.numero}.pdf\nRespuestas: ${datos.responderA}\nEnviado por ${datos.empresa} a través de Grafo.`,
    html: crearCorreoBase({
      empresa: datos.empresa,
      titulo: datos.asunto,
      preheader: `Presupuesto ${datos.numero} · PDF adjunto y aprobación en línea.`,
      contenido: `<p style="margin:0 0 14px;font-size:12px;letter-spacing:1px;color:#646668;">PRESUPUESTO ${e(datos.numero)}</p>
        <h1 class="titulo" style="margin:0 0 26px;font-size:30px;line-height:36px;letter-spacing:-1px;">Tu próximo trabajo<span style="color:#ff7546;">.</span></h1>
        <div style="font-size:15px;line-height:25px;word-break:break-word;">${e(datos.mensaje).replace(/\r?\n/g, '<br>')}</div>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0;"><tr><td bgcolor="#ff7546" style="border-radius:6px;background:#ff7546;">
          <a href="${e(datos.url)}" style="display:inline-block;padding:15px 22px;font-size:14px;font-weight:700;color:#17191b;text-decoration:none;">Ver y aprobar presupuesto →</a>
        </td></tr></table>
        <p style="margin:0;padding:16px;border:1px solid #deded7;border-radius:6px;font-size:13px;line-height:20px;">PDF adjunto · <strong>${e(datos.numero)}.pdf</strong><br>Guardá una copia del presupuesto o revisalo en línea para aprobarlo o rechazarlo.</p>`,
      pie: `<p style="margin:0;">Enviado por ${e(datos.empresa)} a través de Grafo.<br>Al responder este correo, tu mensaje llegará a ${e(datos.responderA)}.</p>`,
    }),
  };
}
