/** El GET de verificación de Meta incluye un secreto en la query string. */
export function rutaLog(url: string): string {
  return url.split('?')[0] === '/api/webhooks/whatsapp'
    ? '/api/webhooks/whatsapp'
    : url;
}
