import {
  esIpOrangoValido,
  ipDeRequest,
  ipPermitida,
  normalizarIp,
} from '../ip';

/**
 * La restricción por IP decide si alguien puede trabajar o no, así que los
 * bordes importan más que el caso feliz: un falso negativo deja a una persona
 * afuera de su trabajo y un falso positivo abre la puerta que se quiso cerrar.
 */

describe('normalizar la IP', () => {
  /** La misma máquina llega de las dos formas según cómo se abrió el socket. */
  it('IPv4 mapeada en IPv6 es la misma IP', () => {
    expect(normalizarIp('::ffff:190.1.2.3')).toBe('190.1.2.3');
  });

  it('los dos loopback son la misma máquina', () => {
    expect(normalizarIp('::1')).toBe('127.0.0.1');
  });

  it('no toca una IPv4 común', () => {
    expect(normalizarIp(' 190.1.2.3 ')).toBe('190.1.2.3');
  });
});

describe('de dónde viene la request', () => {
  /**
   * `req.ip` lo resuelve Express con el trust proxy de main.ts. Acá NO se lee
   * el X-Forwarded-For a mano: sería confiar en un header que cualquiera puede
   * escribir, y la restricción se saltaría con una línea de curl.
   */
  it('usa lo que resolvió Express', () => {
    expect(ipDeRequest({ ip: '190.1.2.3' })).toBe('190.1.2.3');
  });

  it('ignora un X-Forwarded-For puesto a mano', () => {
    const req = {
      ip: '190.1.2.3',
      headers: { 'x-forwarded-for': '1.1.1.1' },
    } as unknown as { ip: string };
    expect(ipDeRequest(req)).toBe('190.1.2.3');
  });

  it('cae al socket si Express no resolvió nada', () => {
    expect(ipDeRequest({ socket: { remoteAddress: '::ffff:10.0.0.5' } })).toBe(
      '10.0.0.5',
    );
  });
});

describe('¿puede entrar?', () => {
  /**
   * El default del sistema y el caso de casi todos. Si "vacío" significara
   * "ninguna", la migración que agregó la columna habría dejado a todo el
   * mundo sin poder entrar.
   */
  it('sin lista, entra desde cualquier lado', () => {
    expect(ipPermitida('190.1.2.3', [])).toBe(true);
    expect(ipPermitida('', [])).toBe(true);
  });

  it('con lista, sólo las de la lista', () => {
    expect(ipPermitida('190.1.2.3', ['190.1.2.3'])).toBe(true);
    expect(ipPermitida('190.1.2.4', ['190.1.2.3'])).toBe(false);
  });

  it('acepta varias', () => {
    const permitidas = ['190.1.2.3', '200.5.5.5'];
    expect(ipPermitida('200.5.5.5', permitidas)).toBe(true);
  });

  /** Sin origen conocido no se entra: con restricción puesta, la duda cierra. */
  it('sin IP, con restricción, NO entra', () => {
    expect(ipPermitida('', ['190.1.2.3'])).toBe(false);
  });

  it('compara normalizando las dos puntas', () => {
    expect(ipPermitida('::ffff:190.1.2.3', ['190.1.2.3'])).toBe(true);
    expect(ipPermitida('190.1.2.3', ['::ffff:190.1.2.3'])).toBe(true);
  });

  describe('rangos', () => {
    it('una oficina entera con /24', () => {
      expect(ipPermitida('190.1.2.77', ['190.1.2.0/24'])).toBe(true);
      expect(ipPermitida('190.1.3.77', ['190.1.2.0/24'])).toBe(false);
    });

    it('/32 es una sola IP', () => {
      expect(ipPermitida('190.1.2.3', ['190.1.2.3/32'])).toBe(true);
      expect(ipPermitida('190.1.2.4', ['190.1.2.3/32'])).toBe(false);
    });

    it('/28 corta donde tiene que cortar', () => {
      expect(ipPermitida('190.1.2.15', ['190.1.2.0/28'])).toBe(true);
      expect(ipPermitida('190.1.2.16', ['190.1.2.0/28'])).toBe(false);
    });

    /** Un /24 no puede dejar pasar a media internet por un error de máscara. */
    it('no se pasa de largo con IPs altas', () => {
      expect(ipPermitida('200.200.200.200', ['190.1.2.0/24'])).toBe(false);
      expect(ipPermitida('255.255.255.255', ['128.0.0.0/1'])).toBe(true);
      expect(ipPermitida('127.255.255.255', ['128.0.0.0/1'])).toBe(false);
    });
  });
});

describe('qué se puede guardar', () => {
  it('IPs y rangos válidos', () => {
    for (const v of ['190.1.2.3', '10.0.0.0/8', '::1', '2001:db8::1']) {
      expect(esIpOrangoValido(v)).toBe(true);
    }
  });

  it('rechaza lo que no sirve', () => {
    for (const v of [
      '',
      'oficina',
      '190.1.2',
      '190.1.2.300',
      '190.1.2.0/33',
      '190.1.2.0/abc',
    ]) {
      expect(esIpOrangoValido(v)).toBe(false);
    }
  });
});
