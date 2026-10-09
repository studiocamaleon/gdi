import { BadRequestException } from '@nestjs/common';
import { createPrivateKey, X509Certificate } from 'node:crypto';
import { cuitValido, normalizarCuit } from '../common/cuit';

export const MAX_PEM_BYTES = 16 * 1024;

/** Valida el par y su vigencia. La autorización WSFE se consulta aparte. */
export function validarCertificadoArca(cert: string, key: string) {
  if (
    [cert, key].some(
      (v) =>
        typeof v !== 'string' || Buffer.byteLength(v, 'utf8') > MAX_PEM_BYTES,
    )
  ) {
    throw new BadRequestException(
      'Cada archivo debe ocupar como máximo 16 KB.',
    );
  }
  if (
    !/^\s*-----BEGIN CERTIFICATE-----[A-Za-z0-9+/=\s]+-----END CERTIFICATE-----\s*$/.test(
      cert,
    ) ||
    !/^\s*-----BEGIN (RSA )?PRIVATE KEY-----[A-Za-z0-9+/=\s]+-----END (RSA )?PRIVATE KEY-----\s*$/.test(
      key,
    )
  ) {
    throw new BadRequestException(
      'Seleccioná un certificado PEM y su clave privada PEM sin contraseña.',
    );
  }
  let certificado: X509Certificate;
  try {
    certificado = new X509Certificate(cert);
    const privada = createPrivateKey(key);
    if (
      privada.asymmetricKeyType !== 'rsa' ||
      (privada.asymmetricKeyDetails?.modulusLength ?? 0) < 2048 ||
      !certificado.checkPrivateKey(privada) ||
      certificado.ca
    )
      throw new Error('Par inválido');
  } catch {
    throw new BadRequestException(
      'El certificado y la clave no forman un par RSA válido de al menos 2048 bits.',
    );
  }
  const desde = new Date(certificado.validFrom);
  const hasta = new Date(certificado.validTo);
  if (!(desde.getTime() <= Date.now() && hasta.getTime() > Date.now())) {
    throw new BadRequestException(
      'El certificado todavía no está vigente o ya venció.',
    );
  }
  // ARCA identifica al titular en serialNumber. No usar CN ni issuer.
  const identificador = certificado.subject
    .split('\n')
    .find((linea) => linea.startsWith('serialNumber='));
  const coincidencia = identificador?.match(
    /^serialNumber=(?:CUIT\s*)?(\d{2}-?\d{8}-?\d)$/i,
  );
  const cuit = coincidencia ? normalizarCuit(coincidencia[1]) : '';
  if (!cuitValido(cuit))
    throw new BadRequestException(
      'El certificado no identifica un CUIT válido en su titular.',
    );
  return { cuit, desde, hasta, huella: certificado.fingerprint256 };
}
