import { rutaLog } from './ruta-log';
describe('Rutas sin credenciales en logs', () => {
  it.each([
    '/api/auth/invitations/secreto-ficticio/accept',
    '/api/registro/verificar/secreto-ficticio',
    '/api/presupuestos/track/secreto-ficticio/decision',
    '/api/ordenes-trabajo/track/secreto-ficticio/archivos/ficticio',
    '/api/recibos/publico/secreto-ficticio/pdf',
    '/api/comprobantes/publico/secreto-ficticio',
    '/api/desarrollo-documental/publico/secreto-ficticio/archivo',
    '/api/PRESUPUESTOS/TRACK/secreto-ficticio',
    '/api/archivos/local/ficticio?firma=secreto-ficticio',
    '/api/usuarios?email=secreto-ficticio',
  ])('no conserva secretos de %s', (url) => {
    expect(rutaLog(url)).not.toContain('secreto-ficticio');
    expect(rutaLog(url)).not.toContain('?');
  });
  it('conserva la ruta operativa sin aceptar saltos de línea', () => {
    expect(rutaLog('/api/ordenes-trabajo/123?estado=activa')).toBe(
      '/api/ordenes-trabajo/123',
    );
    expect(rutaLog('/api/test\ninventado')).not.toContain('\n');
  });
});
