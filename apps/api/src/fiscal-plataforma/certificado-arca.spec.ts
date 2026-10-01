import { parFicticio } from '../../test/fixtures/par-arca';
import { generateKeyPairSync } from 'node:crypto';
import { SecretosService } from '../integraciones/cripto/secretos.service';
import { validarCertificadoArca } from './certificado-arca';

describe('Certificado ARCA — par, titular y cifrado', () => {
  let par: ReturnType<typeof parFicticio>;
  beforeAll(() => {
    par = parFicticio();
  });
  afterEach(() => jest.restoreAllMocks());

  it('extrae el CUIT del titular y verifica el par de claves', () => {
    expect(validarCertificadoArca(par.cert, par.key)).toMatchObject({
      cuit: '30000000007',
    });
  });
  it('rechaza una clave privada que pertenece a otro certificado', () => {
    const otra = generateKeyPairSync('rsa', { modulusLength: 2048 })
      .privateKey.export({ format: 'pem', type: 'pkcs8' })
      .toString();
    expect(() => validarCertificadoArca(par.cert, otra)).toThrow(
      /no forman un par/,
    );
  });
  it.each(['', 'contenido que no es PEM', 'a'.repeat(16385)])(
    'rechaza archivos vacíos, inválidos o demasiado grandes',
    (cert) => {
      expect(() => validarCertificadoArca(cert, par.key)).toThrow();
    },
  );
  it('rechaza certificados vencidos', () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 10 * 86400_000);
    expect(() => validarCertificadoArca(par.cert, par.key)).toThrow(/venció/);
  });
  it('rechaza certificados que todavía no están vigentes', () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() - 10 * 86400_000);
    expect(() => validarCertificadoArca(par.cert, par.key)).toThrow(/vigente/);
  });
  it('rechaza un titular sin CUIT válido', () => {
    const invalido = parFicticio('30000000000');
    expect(() => validarCertificadoArca(invalido.cert, invalido.key)).toThrow(
      /CUIT válido/,
    );
  });
  it('el cifrado no puede moverse entre ambientes o revisiones', () => {
    const anterior = process.env.INTEGRACIONES_ENCRYPTION_KEY;
    process.env.INTEGRACIONES_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString(
      'base64',
    );
    try {
      const secretos = new SecretosService();
      secretos.onModuleInit();
      const sobre = secretos.cifrar(par.key, 'arca:dev:revision-1');
      expect(secretos.descifrar(sobre, 'arca:dev:revision-1')).toBe(par.key);
      expect(() => secretos.descifrar(sobre, 'arca:prod:revision-1')).toThrow();
      expect(() => secretos.descifrar(sobre, 'arca:dev:revision-2')).toThrow();
      expect(() => secretos.descifrar(sobre)).toThrow();
    } finally {
      if (anterior === undefined)
        delete process.env.INTEGRACIONES_ENCRYPTION_KEY;
      else process.env.INTEGRACIONES_ENCRYPTION_KEY = anterior;
    }
  });
});
