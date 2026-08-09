import { createHash, randomBytes } from 'crypto';

/**
 * Token de credencial MCP: `grafo_mcp_` + 32 bytes base64url (43 chars).
 *
 * Es un token OPACO, no un JWT: no lleva claims, no expira por firma, y en la
 * base vive sólo su SHA-256 (patrón Invitation.tokenHash — nunca en claro como
 * EnlacePublico). El prefijo permite que el AuthGuard lo distinga de un JWT
 * sin intentar verificarlo, y que un secret-scanner lo reconozca si se filtra.
 */
export const PREFIJO_TOKEN_MCP = 'grafo_mcp_';

export function generarTokenMcp(): string {
  return PREFIJO_TOKEN_MCP + randomBytes(32).toString('base64url');
}

export function hashTokenMcp(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Últimos 4 chars: identificable en el listado sin ser usable. */
export function pistaDeToken(token: string): string {
  return token.slice(-4);
}

/**
 * Permisos efectivos de una credencial MCP.
 *
 * Intersección permisos-del-rol ∩ scopes (scopes vacío = todo el rol), y
 * SIEMPRE sin `finanzas.ver_margenes`: la IA del tenant ve precios, jamás
 * costos ni márgenes. Es la regla dura del diseño (docs/mcp-cotizador-diseno.md
 * §7.4) y se aplica acá, en un solo lugar, para que ninguna credencial pueda
 * nacer con ese permiso por error de configuración.
 *
 * Ambos lados llegan YA expandidos (gestionar ⇒ ver) — expandir después de
 * intersecar podría resucitar un `ver` que la intersección había sacado.
 */
export function permisosEfectivosMcp(
  permisosDelRol: Set<string>,
  scopesExpandidos: Set<string>,
): Set<string> {
  const efectivos = new Set<string>();
  for (const p of permisosDelRol) {
    if (scopesExpandidos.size === 0 || scopesExpandidos.has(p)) {
      efectivos.add(p);
    }
  }
  efectivos.delete('finanzas.ver_margenes');
  return efectivos;
}
