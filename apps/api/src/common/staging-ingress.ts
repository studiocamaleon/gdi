import { createHash, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import type { Express, RequestHandler } from 'express';

/** Canal autenticado Next → API en Fly. No reemplaza los guards de sesión. */
export function configurarEntradaStaging(express: Express): boolean {
  const staging = process.env.STAGING_PRIVATE === 'true';
  const production = process.env.GRAFO_DEPLOY_ENV === 'production';
  if (staging && production)
    throw new Error('Producción no puede usar la configuración de staging.');
  if (!staging && !production) return false;
  const tokenName = production ? 'WEB_API_TOKEN' : 'STAGING_WEB_API_TOKEN';
  const token = process.env[tokenName];
  if (!token || token.length < 32) {
    throw new Error(`${tokenName} debe tener al menos 32 caracteres.`);
  }
  const digest = (value: string) => createHash('sha256').update(value).digest();
  const expected = digest(token);
  // El primer lanzamiento de producción no habilita Inbox ni cobros Paddle.
  const metaHabilitado =
    staging && process.env.STAGING_META_WEBHOOK_ENABLED === 'true';
  if (
    metaHabilitado &&
    (!process.env.META_APP_SECRET || !process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN)
  ) {
    throw new Error(
      'El webhook de Meta exige META_APP_SECRET y WHATSAPP_WEBHOOK_VERIFY_TOKEN.',
    );
  }
  // Sólo se conserva UN salto, creado abajo después de autenticar la web.
  // Nunca se entrega a Express una cadena X-Forwarded-For recibida del público.
  express.set('trust proxy', 1);
  const ingress: RequestHandler = (req, res, next) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    res.setHeader('Cache-Control', 'private, no-store');
    for (const name of [
      'x-forwarded-for',
      'x-forwarded-host',
      'x-forwarded-proto',
      'x-real-ip',
      'fly-client-ip',
    ]) {
      delete req.headers[name];
    }
    const supplied = req.get('x-grafoprint-web-token') ?? '';
    const ip = req.get('x-grafoprint-client-ip')?.trim() ?? '';
    delete req.headers['x-grafoprint-web-token'];
    delete req.headers['x-grafoprint-client-ip'];
    if (['GET', 'HEAD'].includes(req.method) && req.path === '/api') {
      next();
      return;
    }
    // Excepción exacta y opt-in. El controller verifica challenge/firma sobre
    // rawBody. No se abren otros webhooks ni se confía en cabeceras del cliente.
    if (
      metaHabilitado &&
      ['GET', 'POST'].includes(req.method) &&
      req.path === '/api/webhooks/whatsapp'
    ) {
      next();
      return;
    }
    if (!timingSafeEqual(expected, digest(supplied))) {
      res.status(403).json({ message: 'Acceso directo a la API restringido.' });
      return;
    }
    if (!isIP(ip)) {
      res.status(400).json({ message: 'Origen del pedido no válido.' });
      return;
    }
    req.headers['x-forwarded-for'] = ip;
    next();
  };
  express.use(ingress);
  return true;
}
