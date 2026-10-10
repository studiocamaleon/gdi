import { crearCorreoBase, escaparHtml } from './correo-base';
export type DatosCorreoAcceso = { tipo: string; para: string; url?: string };
export function crearCorreoAcceso(datos: DatosCorreoAcceso) {
  const aviso = datos.tipo === 'aviso';
  const verificar = datos.tipo === 'verificar';
  const titulo = aviso
    ? 'Tu contraseña fue actualizada'
    : verificar
      ? 'Confirmá tu correo'
      : 'Recuperá tu acceso a Grafo';
  const explicacion = aviso
    ? 'Se cambió la contraseña de tu cuenta de Grafo y se cerraron las sesiones anteriores. La configuración de tu segundo factor no cambió. Si no reconocés este cambio, contactá al equipo de Grafo.'
    : verificar
      ? 'Confirmá que este correo te pertenece para poder recuperar tu contraseña cuando lo necesites.'
      : 'Elegí una contraseña nueva. Si tenés segundo factor, seguirás necesitándolo para ingresar.';
  const accion = verificar ? 'Confirmar mi correo' : 'Elegir nueva contraseña';
  const pie =
    'Si no solicitaste este correo, no abras el enlace. Nunca te pediremos que nos envíes tu contraseña o tus códigos de recuperación.';
  if (!aviso && !datos.url) throw new Error('Falta enlace de acceso');
  const enlace = datos.url ? escaparHtml(datos.url) : '';
  return {
    subject: `${titulo} · Grafoprint`,
    text: `${titulo}\n\n${explicacion}\n\n${aviso ? '' : `${accion}: ${datos.url}\nEl enlace es de un solo uso y vence en 15 minutos.\n\n`}${pie}`,
    html: crearCorreoBase({
      titulo,
      preheader: explicacion,
      contenido: `<h1 class="titulo" style="margin:0 0 20px;font-size:30px;color:#17191b;">${titulo}<span style="color:#ff7546;">.</span></h1><p>${explicacion}</p>${aviso ? '' : `<p style="margin:28px 0;"><a href="${enlace}" style="display:inline-block;padding:14px 20px;background:#ff7546;border-radius:6px;color:#101214;text-decoration:none;font-weight:700;">${accion}</a></p><p>Este enlace vence en 15 minutos y sirve una sola vez.</p>`}`,
      pie: `<p>${pie}</p>`,
    }),
  };
}
