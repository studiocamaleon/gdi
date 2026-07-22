import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

/**
 * Cifrado de credenciales de terceros en reposo.
 *
 * El token de Wati permite mandarle WhatsApps a los clientes de una imprenta
 * desde SU número oficial; el de Mercado Pago, mover plata. Guardados en
 * claro, un volcado de la base es todo lo que hace falta para usarlos. Hasta
 * ahora no había ningún cifrado en reposo en el API — esto es el primero, y
 * está pensado para que lo usen las tres integraciones.
 *
 * AES-256-GCM: además de cifrar, AUTENTICA. Con AES-CBC alguien con acceso de
 * escritura a la base podría modificar el ciphertext y el descifrado
 * devolvería basura sin avisar; con GCM el tag no valida y falla.
 *
 * La clave vive en el entorno, NUNCA en la base. Si viven juntas, cifrar no
 * protege de lo único de lo que tiene que protegerte: que se lleven la base.
 */

/** Sobre guardado en la columna Json. `v` deja la puerta abierta a rotar. */
export type SecretoCifrado = {
  /** Versión del esquema/clave. Permite rotar sin migrar todo de una. */
  v: number;
  /** Vector de inicialización, base64. Único por cifrado. */
  iv: string;
  /** Tag de autenticación de GCM, base64. */
  tag: string;
  /** Texto cifrado, base64. */
  ct: string;
};

const VERSION_ACTUAL = 1;
const ALGORITMO = 'aes-256-gcm';
/** 96 bits es el largo recomendado para el IV en GCM. */
const IV_BYTES = 12;
const CLAVE_BYTES = 32;

@Injectable()
export class SecretosService implements OnModuleInit {
  private readonly logger = new Logger(SecretosService.name);
  private clave: Buffer | null = null;

  onModuleInit() {
    const { clave, error } = this.leerClave();
    this.clave = clave;
    if (clave) return;

    if (process.env.NODE_ENV === 'production') {
      // En producción no hay degradación posible: sin clave no se pueden
      // guardar ni leer credenciales, y arrancar igual sólo posterga el
      // problema hasta que alguien intente conectar una integración.
      throw new Error(
        `INTEGRACIONES_ENCRYPTION_KEY inválida o ausente: ${error}. ` +
          'Generar con: openssl rand -base64 32',
      );
    }
    // En dev se deja arrancar: el resto del sistema no depende de esto y
    // obligar a cada dev a generar una clave para tocar cualquier cosa sería
    // fricción sin beneficio. El primer uso falla con el mismo mensaje.
    this.logger.warn(
      `Integraciones sin cifrado disponible (${error}). ` +
        'Generar con: openssl rand -base64 32',
    );
  }

  /** ¿Se pueden guardar credenciales? Para que la UI lo diga antes de pedirlas. */
  get disponible(): boolean {
    return this.clave !== null;
  }

  cifrar(texto: string): SecretoCifrado {
    const clave = this.exigirClave();
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITMO, clave, iv);
    const ct = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
    return {
      v: VERSION_ACTUAL,
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      ct: ct.toString('base64'),
    };
  }

  /**
   * Descifra. Lanza si el sobre fue manipulado (el tag de GCM no valida) o si
   * la clave cambió — las dos cosas son fallas que hay que ver, no tragar.
   */
  descifrar(sobre: SecretoCifrado): string {
    const clave = this.exigirClave();
    if (sobre.v !== VERSION_ACTUAL) {
      throw new Error(
        `Secreto cifrado con una versión desconocida (v${sobre.v}).`,
      );
    }
    const decipher = createDecipheriv(
      ALGORITMO,
      clave,
      Buffer.from(sobre.iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(sobre.tag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(sobre.ct, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  /**
   * Los últimos caracteres, para que la UI pueda mostrar cuál token está
   * cargado sin devolverlo. El token completo NUNCA vuelve por la API: uno
   * que se puede releer desde la pantalla es uno que se filtra en una captura.
   */
  pista(texto: string, visibles = 4): string {
    if (texto.length <= visibles) return '·'.repeat(texto.length);
    return '·'.repeat(8) + texto.slice(-visibles);
  }

  /** Comparación en tiempo constante, para verificar firmas de webhooks. */
  igualSeguro(a: string, b: string): boolean {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  }

  private exigirClave(): Buffer {
    if (!this.clave) {
      throw new Error(
        'No hay clave de cifrado para integraciones. ' +
          'Definir INTEGRACIONES_ENCRYPTION_KEY (openssl rand -base64 32).',
      );
    }
    return this.clave;
  }

  private leerClave(): { clave: Buffer | null; error?: string } {
    const crudo = process.env.INTEGRACIONES_ENCRYPTION_KEY?.trim();
    if (!crudo) return { clave: null, error: 'no está definida' };

    // Se acepta base64 (lo que escupe `openssl rand -base64 32`) o hex.
    const clave = /^[0-9a-f]{64}$/i.test(crudo)
      ? Buffer.from(crudo, 'hex')
      : Buffer.from(crudo, 'base64');

    if (clave.length !== CLAVE_BYTES) {
      return {
        clave: null,
        error: `tiene ${clave.length} bytes y AES-256 necesita ${CLAVE_BYTES}`,
      };
    }
    return { clave };
  }
}
