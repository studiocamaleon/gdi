import 'reflect-metadata';
import { createHash, randomUUID } from 'node:crypto';
import { ValidationPipe } from '@nestjs/common';
import { inspeccionarVector, interpretarVector } from './interpretar-vector';
import {
  compactarPiezaArchivo,
  separarPiezasArchivo,
  sugerirPiezasArchivo,
} from './piezas-archivo';
import { MAX_PIEZAS_VECTORIALES } from './limites-piezas-vectoriales';
import { GeometriasProductoController } from './geometrias-producto.controller';
import { ExportarFabricacionController } from './exportar-fabricacion.controller';
import { validarGeometriasComerciales } from '../geometrias-comerciales';
import { leerPiezasComponente } from '../componentes-configuracion';
import { jobContextCotizacionValido } from '../../motor-universal/cotizar.dto';
import { geometriaDeColeccion } from '../../motor-universal/geometria-vectorial/geometria-coleccion';
import {
  crearDemandasDesdeGeometriaVectorial,
  crearProblemaNestingIrregular,
  resolverProblemaNestingIrregular,
} from '../../motor-universal/geometria-vectorial/contrato-nesting';
import type { JobContext } from '../../motor-universal/tipos';

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});
const dtoImportacion = Reflect.getMetadata(
  'design:paramtypes',
  GeometriasProductoController.prototype,
  'guardarLote',
)[2];
const dtoCapas = Reflect.getMetadata(
  'design:paramtypes',
  ExportarFabricacionController.prototype,
  'capas',
)[1];

describe('SVG con más de 30 diseños', () => {
  it.each([50, MAX_PIEZAS_VECTORIALES])(
    'conserva los %i diseños desde el SVG hasta la cotización',
    async (cantidad) => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cantidad * 20} 10">${Array.from({ length: cantidad }, (_, i) => `<path d="M${i * 20} 0h10v10h-10Z"/>`).join('')}</svg>`;
      const inspeccion = inspeccionarVector(svg, 'piezas-ficticias.svg');
      const exteriorIds = sugerirPiezasArchivo(inspeccion);
      expect(exteriorIds).toHaveLength(cantidad);
      const seleccion = {
        exteriorId: exteriorIds[0],
        exteriorIds,
        unidad: 'mm',
        cerrarExterior: false,
        operaciones: [],
      };
      const archivoId = randomUUID();
      await expect(
        pipe.transform(
          { ...seleccion, archivoId },
          { type: 'body', metatype: dtoImportacion },
        ),
      ).resolves.toMatchObject({ exteriorIds });
      const fuentes = separarPiezasArchivo(inspeccion, seleccion).map((p) =>
        compactarPiezaArchivo(
          interpretarVector(p.inspeccion, p.seleccion, {
            geometriaId: randomUUID(),
            archivoId,
            nombreArchivo: 'piezas-ficticias.svg',
            hash: createHash('sha256').update(svg).digest('hex'),
          }),
        ),
      );
      const piezas = fuentes.map((fuente, i) => ({
        id: `pieza-${i}`,
        nombre: `Pieza ${i + 1}`,
        cantidadPorUnidad: 1,
        fuente,
      }));
      expect(fuentes).toHaveLength(cantidad);
      expect(leerPiezasComponente(piezas)).toHaveLength(cantidad);
      expect(() =>
        validarGeometriasComerciales({
          geometriasComerciales: {
            version: 1,
            modo: 'VECTORIAL',
            fuentes: piezas.map((p) => ({
              id: p.id,
              nombre: p.nombre,
              requerida: true,
              predeterminada: p.fuente,
            })),
          },
        }),
      ).not.toThrow();
      const ctx: JobContext = { cantidad: 1, disenosVectoriales: piezas };
      expect(jobContextCotizacionValido(JSON.parse(JSON.stringify(ctx)))).toBe(
        true,
      );
      expect(
        jobContextCotizacionValido(
          JSON.parse(
            JSON.stringify({
              cantidad: 1,
              geometriasVectoriales: Object.fromEntries(
                piezas.map((p) => [p.id, p.fuente]),
              ),
            }),
          ),
        ),
      ).toBe(true);
      expect(
        jobContextCotizacionValido(
          JSON.parse(
            JSON.stringify({
              cantidad: 1,
              coleccionesVectoriales: { principal: piezas },
            }),
          ),
        ),
      ).toBe(true);
      const geometria = geometriaDeColeccion(ctx);
      expect(geometria.piezas).toHaveLength(cantidad);
      const demandas = crearDemandasDesdeGeometriaVectorial({
        geometria,
        cantidad: ctx.cantidad,
      });
      expect(demandas).toHaveLength(cantidad);
      expect(demandas.reduce((total, p) => total + p.cantidad, 0)).toBe(
        cantidad,
      );
      // Un lote de 50 recorre también el acomodo real, sin motor nativo ni base.
      if (cantidad === 50) {
        const solucion = resolverProblemaNestingIrregular(
          crearProblemaNestingIrregular({
            anchoPlacaMm: 1000,
            altoPlacaMm: 1000,
            demandas,
          }),
        );
        expect(solucion.resultado.placements).toHaveLength(cantidad);
      }
      const geometriaIds = fuentes.map((f) => f.procedencia.geometriaId);
      await expect(
        pipe.transform({ geometriaIds }, { type: 'body', metatype: dtoCapas }),
      ).resolves.toMatchObject({ geometriaIds });
    },
    20000,
  );

  it('rechaza una selección por encima de la capacidad y los IDs repetidos', async () => {
    const exteriorIds = Array.from(
      { length: MAX_PIEZAS_VECTORIALES + 1 },
      (_, i) => `pieza-${i}`,
    );
    const dto = {
      archivoId: randomUUID(),
      exteriorId: exteriorIds[0],
      exteriorIds,
      unidad: 'mm',
      cerrarExterior: false,
      operaciones: [],
    };
    await expect(
      pipe.transform(dto, { type: 'body', metatype: dtoImportacion }),
    ).rejects.toThrow();
    await expect(
      pipe.transform(
        { ...dto, exteriorIds: ['pieza', 'pieza'] },
        { type: 'body', metatype: dtoImportacion },
      ),
    ).rejects.toThrow();
  });
});
