import {
  AfipSdkProvider,
  verificarConsultaFiscal,
} from '../invoicing/afip-sdk.provider';
import type { EmitirInput } from '../invoicing/invoicing-provider';
import { CBTE_TIPO_CON_RETENCION } from '../invoicing/codigos-arca';

const input: EmitirInput = {
  idempotencyKey: 'ensayo',
  tipo: 'factura',
  letra: 'B',
  emisorCuit: '30000000015',
  puntoVenta: 1,
  numero: 10,
  fecha: '2026-09-22',
  receptor: {
    razonSocial: 'Consumidor Final',
    cuit: null,
    condicionFiscal: 'consumidor_final',
  },
  items: [
    {
      descripcion: 'Trabajo',
      cantidad: 1,
      precioUnitarioSinIva: 121,
      alicuotaIva: 21,
    },
  ],
  netoGravado: 100,
  ivaTotal: 21,
  ivaPorAlicuota: [{ alicuota: 21, base: 100, monto: 21 }],
  total: 121,
  moneda: 'ARS',
};
const respuesta = {
  Resultado: 'A',
  EmisionTipo: 'CAE',
  PtoVta: 1,
  CbteTipo: 6,
  CbteDesde: 10,
  CbteHasta: 10,
  CbteFch: '20260922',
  DocTipo: 99,
  DocNro: 0,
  ImpTotal: 121,
  MonId: 'PES',
  MonCotiz: 1,
  CodAutorizacion: '12345678901234',
  FchVto: '20261002',
};
function preparar(raw: unknown) {
  const svc = new AfipSdkProvider();
  const wsfe = jest.fn(() => Promise.resolve(raw));
  Object.assign(svc, { wsfe, cuitOperativo: (cuit: string) => cuit });
  return { svc, wsfe };
}
it('acepta una consulta con los datos fiscales del envío congelado', () => {
  expect(() => verificarConsultaFiscal(respuesta, input, 6)).not.toThrow();
});
it.each([
  ['ImpTotal', 122],
  ['DocNro', 30000000015],
  ['DocTipo', 80],
  ['CbteDesde', 9],
  ['CbteHasta', 11],
  ['PtoVta', 2],
  ['CbteTipo', 1],
  ['CbteFch', '20260921'],
  ['MonId', 'DOL'],
  ['MonCotiz', 1000],
  ['Resultado', 'R'],
  ['EmisionTipo', 'CAEA'],
  ['ImpTotal', null],
  ['ImpTotal', undefined],
])('una diferencia en %s conserva el envío sin confirmar', (clave, valor) => {
  expect(() =>
    verificarConsultaFiscal({ ...respuesta, [String(clave)]: valor }, input, 6),
  ).toThrow(/no coincide/);
});
it('consulta válida normaliza CAE y vencimiento', async () => {
  const { svc } = preparar({ FECompConsultarResult: { ResultGet: respuesta } });
  expect(
    await svc.consultarEmitido(1, 'factura', 'B', 10, input.emisorCuit!, input),
  ).toMatchObject({
    estado: 'emitido',
    numero: 10,
    cae: respuesta.CodAutorizacion,
    caeVencimiento: '2026-10-02',
  });
});
it('un cuerpo incompleto no equivale a un rechazo que libere numeración', async () => {
  const { svc } = preparar({});
  await expect(svc.emitir(input)).rejects.toThrow(
    /no devolvió una autorización/,
  );
});
it('sólo un rechazo explícito produce estado rechazado', async () => {
  const { svc } = preparar({
    FECAESolicitarResult: {
      FeCabResp: { Resultado: 'R' },
      Errors: { Err: [{ Code: 1, Msg: 'Rechazo de ensayo' }] },
    },
  });
  expect(await svc.emitir(input)).toMatchObject({
    estado: 'rechazado',
    errores: ['[1] Rechazo de ensayo'],
  });
});
it('A con retención usa el mismo código para último número, envío y consulta', async () => {
  const { svc, wsfe } = preparar({
    FECompUltimoAutorizadoResult: { CbteNro: 9 },
  });
  const a: EmitirInput = {
    ...input,
    letra: 'A',
    leyenda: 'OPERACIÓN SUJETA A RETENCIÓN',
  };
  await svc.ultimoNumero(1, 'factura', 'A', input.emisorCuit!, a);
  expect(wsfe.mock.calls[0]).toEqual([
    input.emisorCuit,
    'FECompUltimoAutorizado',
    { PtoVta: 1, CbteTipo: CBTE_TIPO_CON_RETENCION['factura:A'] },
  ]);
  await svc.consultarEmitido(1, 'factura', 'A', 10, input.emisorCuit!, a);
  expect(wsfe.mock.calls[1]).toEqual([
    input.emisorCuit,
    'FECompConsultar',
    {
      FeCompConsReq: {
        CbteTipo: CBTE_TIPO_CON_RETENCION['factura:A'],
        CbteNro: 10,
        PtoVta: 1,
      },
    },
  ]);
});
