import { OCULTA_MARGENES_KEY } from '../../auth/margenes.decorator';
import { PERMISO_KEY } from '../../auth/permiso.decorator';
import { ReportesController } from '../reportes.controller';

describe('permisos sensibles de ReportesController', () => {
  it('el resumen ejecutivo conserva sus márgenes porque ya tiene un permiso específico', () => {
    expect(
      Reflect.getMetadata(
        OCULTA_MARGENES_KEY,
        ReportesController.prototype.resumen,
      ),
    ).toBe(false);
    expect(
      Reflect.getMetadata(PERMISO_KEY, ReportesController.prototype.resumen),
    ).toEqual(['reportes.ver_resumen']);
  });

  it('editar umbrales no queda habilitado con el permiso general de lectura', () => {
    expect(
      Reflect.getMetadata(
        PERMISO_KEY,
        ReportesController.prototype.actualizarUmbrales,
      ),
    ).toEqual(['reportes.ver_resumen']);
  });
});
