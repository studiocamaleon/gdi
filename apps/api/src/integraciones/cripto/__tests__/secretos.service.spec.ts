import { randomBytes } from 'node:crypto';
import { SecretosService } from '../secretos.service';

/**
 * El cifrado de credenciales de terceros. Los tests importan más que de
 * costumbre porque una falla acá es silenciosa: un token que se guarda mal no
 * avisa hasta que alguien intenta usarlo, y uno que se descifra mal tampoco.
 */
describe('SecretosService', () => {
  const claveOriginal = process.env.INTEGRACIONES_ENCRYPTION_KEY;

  const conClave = (clave?: string) => {
    if (clave === undefined) delete process.env.INTEGRACIONES_ENCRYPTION_KEY;
    else process.env.INTEGRACIONES_ENCRYPTION_KEY = clave;
    const svc = new SecretosService();
    svc.onModuleInit();
    return svc;
  };

  const CLAVE_OK = randomBytes(32).toString('base64');

  afterAll(() => {
    if (claveOriginal === undefined) {
      delete process.env.INTEGRACIONES_ENCRYPTION_KEY;
    } else {
      process.env.INTEGRACIONES_ENCRYPTION_KEY = claveOriginal;
    }
  });

  describe('ida y vuelta', () => {
    it('descifra lo que cifró', () => {
      const svc = conClave(CLAVE_OK);
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc123';
      expect(svc.descifrar(svc.cifrar(token))).toBe(token);
    });

    it('soporta acentos y emojis sin romper el largo', () => {
      const svc = conClave(CLAVE_OK);
      const texto = 'contraseña con ñ, tildes áéí y 🔐';
      expect(svc.descifrar(svc.cifrar(texto))).toBe(texto);
    });

    it('acepta la clave en hex además de base64', () => {
      const svc = conClave(randomBytes(32).toString('hex'));
      expect(svc.disponible).toBe(true);
      expect(svc.descifrar(svc.cifrar('hola'))).toBe('hola');
    });

    it('cifrar dos veces lo mismo da resultados distintos', () => {
      // El IV es aleatorio por cifrado. Si dos cifrados del mismo texto dieran
      // igual, se podría inferir qué tenants comparten credencial.
      const svc = conClave(CLAVE_OK);
      const a = svc.cifrar('mismo-token');
      const b = svc.cifrar('mismo-token');
      expect(a.ct).not.toBe(b.ct);
      expect(a.iv).not.toBe(b.iv);
      expect(svc.descifrar(a)).toBe(svc.descifrar(b));
    });
  });

  describe('integridad', () => {
    it('rechaza un ciphertext manipulado', () => {
      // Lo que aporta GCM sobre CBC: con CBC esto devolvería basura en
      // silencio. Alguien con escritura en la base no puede alterar el token.
      const svc = conClave(CLAVE_OK);
      const sobre = svc.cifrar('token-real');
      const ct = Buffer.from(sobre.ct, 'base64');
      ct[0] ^= 0xff;
      expect(() =>
        svc.descifrar({ ...sobre, ct: ct.toString('base64') }),
      ).toThrow();
    });

    it('rechaza un tag manipulado', () => {
      const svc = conClave(CLAVE_OK);
      const sobre = svc.cifrar('token-real');
      const tag = Buffer.from(sobre.tag, 'base64');
      tag[0] ^= 0xff;
      expect(() =>
        svc.descifrar({ ...sobre, tag: tag.toString('base64') }),
      ).toThrow();
    });

    it('no descifra con otra clave', () => {
      const sobre = conClave(CLAVE_OK).cifrar('token-real');
      const otro = conClave(randomBytes(32).toString('base64'));
      expect(() => otro.descifrar(sobre)).toThrow();
    });

    it('rechaza una versión de sobre desconocida', () => {
      const svc = conClave(CLAVE_OK);
      const sobre = svc.cifrar('token');
      expect(() => svc.descifrar({ ...sobre, v: 99 })).toThrow(/versión/i);
    });
  });

  describe('clave ausente o inválida', () => {
    it('sin clave queda no disponible y falla al usarse', () => {
      const svc = conClave(undefined);
      expect(svc.disponible).toBe(false);
      expect(() => svc.cifrar('x')).toThrow(/INTEGRACIONES_ENCRYPTION_KEY/);
    });

    it('con una clave de largo incorrecto no queda disponible', () => {
      const svc = conClave(randomBytes(16).toString('base64'));
      expect(svc.disponible).toBe(false);
    });

    it('en producción sin clave el arranque falla', () => {
      // Arrancar igual sólo postergaría el problema hasta que alguien
      // intente conectar una integración, en producción.
      const antes = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      delete process.env.INTEGRACIONES_ENCRYPTION_KEY;
      try {
        expect(() => new SecretosService().onModuleInit()).toThrow(
          /INTEGRACIONES_ENCRYPTION_KEY/,
        );
      } finally {
        process.env.NODE_ENV = antes;
      }
    });
  });

  describe('pista', () => {
    it('muestra sólo los últimos caracteres', () => {
      const svc = conClave(CLAVE_OK);
      const pista = svc.pista('abcdefghijklmnop');
      expect(pista).toBe('········mnop');
      expect(pista).not.toContain('abcdefghijkl');
    });

    it('un secreto muy corto se enmascara entero', () => {
      const svc = conClave(CLAVE_OK);
      expect(svc.pista('abc')).toBe('···');
    });
  });

  describe('igualSeguro', () => {
    it('compara correctamente', () => {
      const svc = conClave(CLAVE_OK);
      expect(svc.igualSeguro('firma-abc', 'firma-abc')).toBe(true);
      expect(svc.igualSeguro('firma-abc', 'firma-abd')).toBe(false);
      expect(svc.igualSeguro('corta', 'mucho mas larga')).toBe(false);
    });
  });
});
