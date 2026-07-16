import {
  CONDICIONES_RECEPTOR,
  bloqueoEmision,
  letraComprobante,
  type CondicionFiscalEmisor,
  type CondicionFiscalReceptor,
  type LetraComprobante,
} from '../letra-comprobante';

/**
 * La matriz oficial de ARCA, transcrita tal cual de
 * https://www.afip.gob.ar/facturacion/regimen-general/comprobantes.asp
 * Si algún día cambia el régimen, este es el test que tiene que fallar.
 */
const MATRIZ: Record<
  CondicionFiscalEmisor,
  Record<CondicionFiscalReceptor, LetraComprobante>
> = {
  RI: {
    RI: 'A',
    monotributo: 'A',
    exento: 'B',
    consumidor_final: 'B',
    exterior: 'E',
  },
  monotributo: {
    RI: 'C',
    monotributo: 'C',
    exento: 'C',
    consumidor_final: 'C',
    exterior: 'E',
  },
  exento: {
    RI: 'C',
    monotributo: 'C',
    exento: 'C',
    consumidor_final: 'C',
    exterior: 'E',
  },
};

describe('letraComprobante — matriz emisor × receptor', () => {
  for (const emisor of Object.keys(MATRIZ) as CondicionFiscalEmisor[]) {
    for (const receptor of CONDICIONES_RECEPTOR) {
      const esperada = MATRIZ[emisor][receptor];
      it(`emisor ${emisor} → receptor ${receptor} = ${esperada}`, () => {
        expect(letraComprobante(emisor, receptor).letra).toBe(esperada);
      });
    }
  }

  it('cubre las 15 combinaciones posibles', () => {
    const total =
      Object.keys(MATRIZ).length * CONDICIONES_RECEPTOR.length;
    expect(total).toBe(15);
  });
});

describe('discriminación de IVA', () => {
  it('sólo la A discrimina IVA', () => {
    expect(letraComprobante('RI', 'RI').discriminaIva).toBe(true);
    expect(letraComprobante('RI', 'monotributo').discriminaIva).toBe(true);
  });

  it('la B lleva el IVA incluido en el precio, no discriminado', () => {
    const r = letraComprobante('RI', 'consumidor_final');
    expect(r.letra).toBe('B');
    expect(r.discriminaIva).toBe(false);
    expect(r.exenta).toBe(false);
  });

  it('la C no discrimina IVA pero no es exenta', () => {
    const r = letraComprobante('monotributo', 'RI');
    expect(r.discriminaIva).toBe(false);
    expect(r.exenta).toBe(false);
  });

  it('la E es exenta: exportación sin IVA', () => {
    const r = letraComprobante('RI', 'exterior');
    expect(r.letra).toBe('E');
    expect(r.exenta).toBe(true);
    expect(r.discriminaIva).toBe(false);
  });

  it('la exportación manda sobre la condición del emisor', () => {
    for (const emisor of ['RI', 'monotributo', 'exento'] as const) {
      expect(letraComprobante(emisor, 'exterior').letra).toBe('E');
    }
  });
});

describe('leyendas que reemplazan a la vieja factura M (RG 5762/2025)', () => {
  it('la leyenda del emisor viaja en la A', () => {
    const r = letraComprobante('RI', 'RI', 'OPERACIÓN SUJETA A RETENCIÓN');
    expect(r.letra).toBe('A');
    expect(r.leyenda).toBe('OPERACIÓN SUJETA A RETENCIÓN');
  });

  it('sin leyenda asignada, la A no lleva ninguna', () => {
    expect(letraComprobante('RI', 'RI').leyenda).toBeUndefined();
    expect(letraComprobante('RI', 'RI', null).leyenda).toBeUndefined();
  });

  it('la leyenda no se cuela en letras que no son A', () => {
    expect(
      letraComprobante('RI', 'consumidor_final', 'PAGO EN CBU INFORMADA')
        .leyenda,
    ).toBeUndefined();
    expect(
      letraComprobante('monotributo', 'RI', 'PAGO EN CBU INFORMADA').leyenda,
    ).toBeUndefined();
  });

  it('ya no existe la letra M', () => {
    const todas = new Set<string>();
    for (const emisor of ['RI', 'monotributo', 'exento'] as const) {
      for (const receptor of CONDICIONES_RECEPTOR) {
        todas.add(letraComprobante(emisor, receptor).letra);
      }
    }
    expect(todas.has('M')).toBe(false);
    expect([...todas].sort()).toEqual(['A', 'B', 'C', 'E']);
  });
});

describe('motivo', () => {
  it('explica la sugerencia en castellano y nombra la letra', () => {
    for (const emisor of ['RI', 'monotributo', 'exento'] as const) {
      for (const receptor of CONDICIONES_RECEPTOR) {
        const r = letraComprobante(emisor, receptor);
        expect(r.motivo.length).toBeGreaterThan(20);
        expect(r.motivo).toContain(r.letra);
      }
    }
  });
});

describe('bloqueoEmision', () => {
  it('una A sin CUIT del receptor no se puede emitir', () => {
    expect(bloqueoEmision('A', null)).toMatch(/CUIT/);
  });

  it('una A con CUIT se emite', () => {
    expect(bloqueoEmision('A', '30712345671')).toBeNull();
  });

  it('B, C y E no exigen CUIT', () => {
    for (const letra of ['B', 'C', 'E'] as const) {
      expect(bloqueoEmision(letra, null)).toBeNull();
    }
  });
});
