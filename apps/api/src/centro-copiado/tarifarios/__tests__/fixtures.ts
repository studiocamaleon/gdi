import type { ContenidoTarifario } from '../contenido-tarifario';

export function contenidoEjemplo(
  papelMateriaPrimaId = '00000000-0000-4000-8000-000000000001',
): ContenidoTarifario {
  return {
    esquema: 1,
    monedaCodigo: 'ARS',
    hojas: {
      reglas: {
        unidad: 'HOJA',
        acumulacion: 'COMBINACION',
        cobertura: 'UNICA',
        ultimaHojaImpar: 'MANTENER_DOBLE',
      },
      rangosGenerales: [1, 100],
      filas: [
        {
          combinacion: {
            papelMateriaPrimaId,
            gramaje: 80,
            tamano: 'A4',
            color: 'BN',
            faz: 2,
            cobertura: null,
          },
          precios: [
            { desdeCantidad: 1, precioUnitario: '100.50' },
            { desdeCantidad: 100, precioUnitario: null },
          ],
        },
      ],
    },
    cad: {
      reglas: {
        unidad: 'ML',
        acumulacion: 'COMBINACION',
        cobertura: 'UNICA',
        redondeo: { modalidad: 'SIN_REDONDEO' },
      },
      rangosGenerales: ['0', '10'],
      filas: [],
    },
    composicion: {
      iva: 'INCLUIDO',
      preparacion: { modalidad: 'INCLUIDA' },
      minimo: { modalidad: 'SIN_MINIMO' },
    },
  };
}
