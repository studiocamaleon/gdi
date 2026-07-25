/**
 * De dónde viene una request, y si esa IP está permitida.
 *
 * Todo lo delicado de la restricción por IP vive acá: cómo se lee la IP, cómo
 * se normaliza y cómo se compara. Ver docs/usuarios-roles-permisos-diseno.md
 */

/**
 * La IP del cliente, normalizada.
 *
 * Express ya resuelve `req.ip` mirando `X-Forwarded-For` **sólo si** hay
 * `trust proxy` configurado (main.ts). Sin eso devuelve la del socket, que
 * detrás de un proxy es la del proxy — por eso no se lee el header a mano acá:
 * hacerlo sería confiar en un dato que cualquiera puede escribir.
 *
 * La normalización importa: la misma máquina puede aparecer como `1.2.3.4` o
 * como `::ffff:1.2.3.4` según cómo se abrió el socket, y son la misma IP.
 */
export function ipDeRequest(req: {
  ip?: string;
  socket?: { remoteAddress?: string };
}): string {
  return normalizarIp(req.ip ?? req.socket?.remoteAddress ?? '');
}

export function normalizarIp(ip: string): string {
  const limpia = ip.trim().toLowerCase();
  // IPv4 mapeada en IPv6: ::ffff:190.1.2.3 es 190.1.2.3.
  const mapeada = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(limpia);
  if (mapeada) return mapeada[1];
  // El loopback de IPv6 y el de IPv4 son la misma máquina.
  if (limpia === '::1') return '127.0.0.1';
  return limpia;
}

/** ¿Es una IP o un rango que podamos usar? Lo usa el DTO y la UI. */
export function esIpOrangoValido(valor: string): boolean {
  const v = valor.trim();
  if (!v) return false;
  const [direccion, prefijo] = v.split('/');
  if (prefijo !== undefined) {
    // Rango: sólo IPv4. Una oficina se describe con /24 o /28; los rangos IPv6
    // no aparecen en este caso de uso y soportarlos a medias es peor.
    if (!esIpv4(direccion)) return false;
    const n = Number(prefijo);
    return Number.isInteger(n) && n >= 0 && n <= 32;
  }
  return esIpv4(direccion) || esIpv6(direccion);
}

function esIpv4(v: string): boolean {
  const partes = v.split('.');
  if (partes.length !== 4) return false;
  return partes.every((p) => {
    if (!/^\d{1,3}$/.test(p)) return false;
    const n = Number(p);
    return n >= 0 && n <= 255;
  });
}

function esIpv6(v: string): boolean {
  // Suficiente para lo que hay que aceptar: hexadecimales y dos puntos, con
  // al menos uno. La validación fina la hace la comparación exacta.
  return /^[0-9a-f:]+$/i.test(v) && v.includes(':');
}

/**
 * ¿Esta IP puede entrar?
 *
 * Lista vacía = sin restricción, que es el default y el caso de casi todos.
 * Es importante que "vacío" signifique "cualquiera" y no "ninguno": si algún
 * día una migración deja el campo vacío, nadie queda encerrado afuera.
 */
export function ipPermitida(ip: string, permitidas: string[]): boolean {
  if (permitidas.length === 0) return true;
  const cliente = normalizarIp(ip);
  if (!cliente) return false;
  return permitidas.some((permitida) => coincide(cliente, permitida.trim()));
}

function coincide(cliente: string, regla: string): boolean {
  if (!regla) return false;
  const [direccion, prefijo] = regla.split('/');
  if (prefijo === undefined) {
    return cliente === normalizarIp(direccion);
  }
  return enRango(cliente, direccion, Number(prefijo));
}

/** IPv4 dentro de un CIDR, comparando los bits del prefijo. */
function enRango(cliente: string, red: string, bits: number): boolean {
  if (!esIpv4(cliente) || !esIpv4(red)) return false;
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  if (bits === 0) return true;
  const mascara = (0xffffffff << (32 - bits)) >>> 0;
  return (aEntero(cliente) & mascara) === (aEntero(red) & mascara);
}

function aEntero(ip: string): number {
  return (
    ip.split('.').reduce((acc, parte) => (acc << 8) + Number(parte), 0) >>> 0
  );
}
