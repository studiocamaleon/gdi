/** Los enlaces públicos son credenciales. Tampoco registrar valores de query. */
export function rutaLog(url: string): string {
  return url
    .split(/[?#]/, 1)[0]
    .replace(
      /\/(track|invitations|publico|verificar)\/[^/]+/gi,
      '/$1/[privado]',
    )
    .replace(/\p{Cc}/gu, '')
    .slice(0, 512);
}
