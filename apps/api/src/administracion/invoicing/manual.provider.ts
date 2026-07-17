import { Injectable } from '@nestjs/common';
import type {
  EmitirInput,
  EmitirResultado,
  InvoicingProvider,
  LetraProvider,
  PadronResultado,
} from './invoicing-provider';

/**
 * Provider por defecto: NO habla con ARCA.
 *
 * Modela al usuario que factura por el portal de ARCA y después carga el
 * CAE a mano en Grafo. La emisión asigna el número con nuestro contador y
 * deja el comprobante emitido SIN CAE; el CAE se completa después desde la
 * pantalla del comprobante.
 *
 * Existe para que todo el módulo (numeración, imputaciones, cuenta
 * corriente, aging) funcione sin depender de ninguna integración, y para
 * que enchufar AfipSdkProvider no cambie ni las vistas ni el modelo.
 */
@Injectable()
export class ManualProvider implements InvoicingProvider {
  readonly codigo = 'manual';

  /**
   * No pide CAE: confirma la emisión con el número que ya asignó nuestro
   * contador. `numero` viene resuelto por el servicio — con provider
   * manual nunca es null.
   */
  emitir(input: EmitirInput): Promise<EmitirResultado> {
    return Promise.resolve({
      estado: 'emitido',
      numero: input.numero ?? 0,
      // Sin CAE: lo carga el usuario desde el detalle del comprobante.
      cae: '',
      caeVencimiento: '',
      raw: {
        provider: 'manual',
        nota: 'Emitido sin CAE: se carga a mano desde el portal de ARCA.',
        idempotencyKey: input.idempotencyKey,
      },
    });
  }

  /**
   * Sin servicio externo no hay nada que reconciliar: lo que sabemos del
   * comprobante ya está en nuestra base.
   */
  consultarEmitido(): Promise<EmitirResultado | null> {
    return Promise.resolve(null);
  }

  /** La numeración la lleva nuestro contador, no ARCA. */
  ultimoNumero(): Promise<number | null> {
    return Promise.resolve(null);
  }

  /** Sin integración no hay padrón: la condición fiscal se carga a mano. */
  consultarPadron(): Promise<PadronResultado> {
    return Promise.resolve(null);
  }
}

/** Letras que este provider puede emitir (todas: no valida contra ARCA). */
export const LETRAS_MANUAL: LetraProvider[] = ['A', 'B', 'C', 'E'];
