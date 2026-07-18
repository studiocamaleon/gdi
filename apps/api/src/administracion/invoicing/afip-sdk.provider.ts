import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  CBTE_TIPO,
  CBTE_TIPO_CON_RETENCION,
  CONDICION_IVA_RECEPTOR,
  DOC_TIPO_CUIT,
  DOC_TIPO_SIN_IDENTIFICAR,
  IVA_ID,
} from './codigos-arca';
import type {
  EmitirInput,
  EmitirResultado,
  InvoicingProvider,
  LetraProvider,
  PadronResultado,
} from './invoicing-provider';

/**
 * Provider contra AFIP SDK (https://afipsdk.com), que a su vez habla el
 * webservice WSFEv1 de ARCA.
 *
 * Todas las tablas de códigos de acá salieron de consultarle a ARCA sus
 * propios FEParamGet* el 2026-07-16, no de documentación de terceros.
 *
 * MODELO: un solo certificado de Grafo representa a N CUITs (delegación de
 * webservices). El CUIT del tenant viaja en `Auth.Cuit` en cada request.
 * Por eso el token es config global y no un dato por tenant.
 */

const BASE = 'https://app.afipsdk.com/api/v1/afip';

type TicketAcceso = { token: string; sign: string; expira: number };

@Injectable()
export class AfipSdkProvider implements InvoicingProvider {
  readonly codigo = 'afipsdk';
  private readonly log = new Logger(AfipSdkProvider.name);

  /**
   * ARCA da un ticket de 12hs por certificado y NO deja pedir otro
   * mientras el anterior siga vivo. Con varias instancias esto tiene que
   * salir a Redis; en una sola alcanza memoria.
   * TODO(producción): mover a storage compartido con lock antes de escalar.
   */
  private readonly tickets = new Map<string, TicketAcceso>();

  get environment(): 'dev' | 'prod' {
    // Default seguro: sandbox. Producción sólo si se pide explícitamente.
    return process.env.AFIPSDK_ENVIRONMENT === 'prod' ? 'prod' : 'dev';
  }

  get disponible(): boolean {
    return !!process.env.AFIPSDK_ACCESS_TOKEN;
  }

  /**
   * En homologación el único CUIT que se puede usar es el de demo de AFIP
   * SDK, porque es el único para el que ellos tienen certificado. El CUIT
   * real del tenant no serviría: ARCA lo rechazaría por falta de
   * autorización — que es exactamente la barrera que impide facturar en
   * nombre de alguien sin su permiso.
   *
   * En producción esto NO aplica nunca: se emite con el CUIT del tenant,
   * que es quien delegó en ARCA.
   */
  private cuitAUsar(cuitTenant: string): string {
    if (this.environment !== 'dev') return cuitTenant;
    const demo = process.env.AFIPSDK_DEV_CUIT;
    if (!demo || demo === cuitTenant) return cuitTenant;
    this.log.warn(
      `HOMOLOGACIÓN: se emite con el CUIT de prueba ${demo} en lugar del ` +
        `real ${cuitTenant}. El comprobante NO tiene validez fiscal.`,
    );
    return demo;
  }

  private async post(path: string, body: unknown): Promise<unknown> {
    const token = process.env.AFIPSDK_ACCESS_TOKEN;
    if (!token) {
      throw new ServiceUnavailableException(
        'Falta AFIPSDK_ACCESS_TOKEN: no se puede emitir con este proveedor.',
      );
    }
    const r = await fetch(BASE + path, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const txt = await r.text();
    let json: unknown;
    try {
      json = JSON.parse(txt);
    } catch {
      json = txt;
    }
    if (!r.ok) {
      throw new ServiceUnavailableException(
        `AFIP SDK respondió ${r.status}: ${txt.slice(0, 300)}`,
      );
    }
    return json;
  }

  /** Ticket de acceso, cacheado. Cubre a TODOS los CUITs representados. */
  private async ticket(cuitEmisor: string): Promise<TicketAcceso> {
    const clave = `${this.environment}:${cuitEmisor}`;
    const guardado = this.tickets.get(clave);
    // Margen de 5 min: no queremos usar uno que expire en pleno request.
    if (guardado && guardado.expira > Date.now() + 5 * 60_000) {
      return guardado;
    }
    const r = (await this.post('/auth', {
      environment: this.environment,
      tax_id: cuitEmisor,
      wsid: 'wsfe',
    })) as { token: string; sign: string; expiration: string };

    const ta: TicketAcceso = {
      token: r.token,
      sign: r.sign,
      expira: new Date(r.expiration).getTime(),
    };
    this.tickets.set(clave, ta);
    return ta;
  }

  private async wsfe(
    cuitEmisor: string,
    method: string,
    params: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const ta = await this.ticket(cuitEmisor);
    const r = (await this.post('/requests', {
      environment: this.environment,
      method,
      wsid: 'wsfe',
      params: {
        Auth: { Token: ta.token, Sign: ta.sign, Cuit: cuitEmisor },
        ...params,
      },
    })) as Record<string, unknown>;
    return r;
  }

  private cbteTipo(input: EmitirInput, conRetencion: boolean): number {
    const clave = `${input.tipo}:${input.letra}`;
    if (conRetencion && CBTE_TIPO_CON_RETENCION[clave]) {
      return CBTE_TIPO_CON_RETENCION[clave];
    }
    const id = CBTE_TIPO[clave];
    if (!id) {
      throw new ServiceUnavailableException(
        input.letra === 'E'
          ? 'La factura de exportación (E) va por otro webservice de ARCA (wsfex), todavía no integrado. Emitila con el proveedor manual.'
          : `No hay tipo de comprobante de ARCA para ${clave}.`,
      );
    }
    return id;
  }

  async ultimoNumero(
    puntoVenta: number,
    tipo: EmitirInput['tipo'],
    letra: LetraProvider,
    cuitEmisor?: string,
  ): Promise<number | null> {
    if (!cuitEmisor) return null;
    const clave = `${tipo}:${letra}`;
    const cbteTipo = CBTE_TIPO[clave];
    if (!cbteTipo) return null;
    const r = await this.wsfe(
      this.cuitAUsar(cuitEmisor),
      'FECompUltimoAutorizado',
      {
        PtoVta: puntoVenta,
        CbteTipo: cbteTipo,
      },
    );
    const res = (r.FECompUltimoAutorizadoResult ?? {}) as { CbteNro?: number };
    return typeof res.CbteNro === 'number' ? res.CbteNro : null;
  }

  async emitir(input: EmitirInput): Promise<EmitirResultado> {
    const cuitEmisor = input.emisorCuit
      ? this.cuitAUsar(input.emisorCuit)
      : null;
    if (!cuitEmisor) {
      throw new ServiceUnavailableException(
        'Falta el CUIT del emisor para pedirle el CAE a ARCA.',
      );
    }
    if (input.numero === null) {
      throw new ServiceUnavailableException(
        'ARCA exige numeración correlativa: el número tiene que venir resuelto.',
      );
    }

    const conRetencion = input.leyenda === 'OPERACIÓN SUJETA A RETENCIÓN';
    const cbteTipo = this.cbteTipo(input, conRetencion);

    // Neto, IVA y alícuotas. Ante ARCA, A **y B** discriminan (la B no se
    // lo muestra al cliente, pero WSFE exige el objeto IVA con neto > 0 —
    // error 10070 si falta). C/E no llevan IVA: el precio es final.
    const discrimina = input.letra === 'A' || input.letra === 'B';
    const alicIva: Array<{ Id: number; BaseImp: number; Importe: number }> = [];
    if (input.letra === 'A') {
      // En A los items vienen a precio NETO: el desglose se arma de ahí.
      const porAli = new Map<number, { base: number; monto: number }>();
      for (const it of input.items) {
        const base = it.cantidad * it.precioUnitarioSinIva;
        const ali = typeof it.alicuotaIva === 'number' ? it.alicuotaIva : 0;
        const acc = porAli.get(ali) ?? { base: 0, monto: 0 };
        porAli.set(ali, {
          base: acc.base + base,
          monto: acc.monto + (base * ali) / 100,
        });
      }
      for (const [ali, v] of porAli) {
        const id = IVA_ID[ali];
        if (!id) {
          throw new ServiceUnavailableException(
            `ARCA no acepta la alícuota de IVA ${ali}%.`,
          );
        }
        alicIva.push({
          Id: id,
          BaseImp: r2(v.base),
          Importe: r2(v.monto),
        });
      }
    } else if (input.letra === 'B') {
      // En B los items traen el IVA ADENTRO: recalcular desde el precio
      // inflaría la base. Se usa el desglose ya extraído por
      // totales-comprobante.ts, que viene en el input.
      for (const linea of input.ivaPorAlicuota ?? []) {
        const id = IVA_ID[linea.alicuota];
        if (!id) {
          throw new ServiceUnavailableException(
            `ARCA no acepta la alícuota de IVA ${linea.alicuota}%.`,
          );
        }
        alicIva.push({
          Id: id,
          BaseImp: r2(linea.base),
          Importe: r2(linea.monto),
        });
      }
    }

    const neto = r2(input.netoGravado ?? 0);
    const iva = r2(input.ivaTotal ?? 0);
    const total = r2(input.total);
    const receptorCuit = input.receptor.cuit;
    const fch = Number(input.fecha.replace(/-/g, ''));

    const condicionReceptor =
      CONDICION_IVA_RECEPTOR[input.receptor.condicionFiscal] ??
      CONDICION_IVA_RECEPTOR.consumidor_final;

    const det: Record<string, unknown> = {
      Concepto: 1,
      DocTipo: receptorCuit ? DOC_TIPO_CUIT : DOC_TIPO_SIN_IDENTIFICAR,
      DocNro: receptorCuit ? Number(receptorCuit) : 0,
      // Obligatorio desde la RG 5616: sin esto ARCA rechaza con 10246.
      CondicionIVAReceptorId: condicionReceptor,
      CbteDesde: input.numero,
      CbteHasta: input.numero,
      CbteFch: fch,
      ImpTotal: total,
      // En B/C el precio ya trae el IVA: ante ARCA todo va como neto.
      ImpNeto: discrimina ? neto : total,
      ImpIVA: discrimina ? iva : 0,
      ImpTotConc: 0,
      ImpOpEx: 0,
      ImpTrib: 0,
      MonId: input.moneda === 'USD' ? 'DOL' : 'PES',
      MonCotiz: input.moneda === 'USD' ? (input.cotizacion ?? 1) : 1,
    };
    if (discrimina && alicIva.length > 0) det.Iva = { AlicIva: alicIva };
    if (input.asociados?.length) {
      det.CbtesAsoc = {
        CbteAsoc: input.asociados.map((a) => ({
          Tipo: CBTE_TIPO[`factura:${input.letra}`] ?? 1,
          PtoVta: a.puntoVenta,
          Nro: a.numero,
          Cuit: a.cuit ?? undefined,
        })),
      };
    }

    this.log.log(
      `Emitiendo ${input.tipo} ${input.letra} ${input.puntoVenta}-${input.numero} ` +
        `en entorno ${this.environment.toUpperCase()}` +
        (this.environment === 'dev'
          ? ' (homologación: SIN validez fiscal)'
          : ''),
    );

    const r = await this.wsfe(cuitEmisor, 'FECAESolicitar', {
      FeCAEReq: {
        FeCabReq: { CantReg: 1, PtoVta: input.puntoVenta, CbteTipo: cbteTipo },
        FeDetReq: { FECAEDetRequest: det },
      },
    });

    const result = (r.FECAESolicitarResult ?? {}) as Record<string, unknown>;
    const cab = (result.FeCabResp ?? {}) as { Resultado?: string };
    const detRespRaw = (result.FeDetResp ?? {}) as {
      FECAEDetResponse?: unknown;
    };
    const detResp = (
      Array.isArray(detRespRaw.FECAEDetResponse)
        ? detRespRaw.FECAEDetResponse[0]
        : detRespRaw.FECAEDetResponse
    ) as
      | {
          CAE?: string;
          CAEFchVto?: string;
          CbteDesde?: number;
          Resultado?: string;
          Observaciones?: { Obs?: Array<{ Code: number; Msg: string }> };
        }
      | undefined;

    // Los errores de ARCA llegan como texto libre: se guardan crudos.
    const errores: string[] = [];
    for (const o of detResp?.Observaciones?.Obs ?? []) {
      errores.push(`[${o.Code}] ${o.Msg}`);
    }
    for (const e of (
      (result.Errors ?? {}) as { Err?: Array<{ Code: number; Msg: string }> }
    ).Err ?? []) {
      errores.push(`[${e.Code}] ${e.Msg}`);
    }

    if (cab.Resultado !== 'A' || !detResp?.CAE) {
      return { estado: 'rechazado', errores, raw: r };
    }

    return {
      estado: 'emitido',
      numero: detResp.CbteDesde ?? input.numero,
      cae: String(detResp.CAE).trim(),
      caeVencimiento: fechaArca(String(detResp.CAEFchVto ?? '')),
      // Aprobado pero con observaciones: son leyendas que el comprobante
      // debe llevar, no rechazos. Se guardan para poder imprimirlas.
      raw: { respuesta: r, observaciones: errores },
    };
  }

  /**
   * Reconciliación: ARCA no conoce nuestra clave de idempotencia, así que
   * se busca por (punto de venta, tipo, número) — que es justo el dato que
   * nosotros asignamos antes de llamar. Distingue "nunca llegó" de "se
   * emitió y no me enteré".
   */
  async consultarEmitido(
    puntoVenta: number,
    tipo: EmitirInput['tipo'],
    letra: LetraProvider,
    numero: number,
    cuitEmisor?: string,
  ): Promise<EmitirResultado | null> {
    if (!cuitEmisor) return null;
    const cbteTipo = CBTE_TIPO[`${tipo}:${letra}`];
    if (!cbteTipo) return null;
    const r = await this.wsfe(this.cuitAUsar(cuitEmisor), 'FECompConsultar', {
      FeCompConsReq: {
        CbteTipo: cbteTipo,
        CbteNro: numero,
        PtoVta: puntoVenta,
      },
    });
    const res = (r.FECompConsultarResult ?? {}) as {
      ResultGet?: { CodAutorizacion?: string; FchVto?: string };
    };
    const cae = res.ResultGet?.CodAutorizacion;
    if (!cae) return null;
    return {
      estado: 'emitido',
      numero,
      cae: String(cae).trim(),
      caeVencimiento: fechaArca(String(res.ResultGet?.FchVto ?? '')),
      raw: r,
    };
  }

  /** El padrón necesita otro webservice y CUIT vinculado: todavía no. */
  consultarPadron(): Promise<PadronResultado> {
    return Promise.resolve(null);
  }
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** "20260726" → "2026-07-26". */
function fechaArca(v: string): string {
  const d = v.replace(/\D/g, '');
  if (d.length !== 8) return '';
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}
