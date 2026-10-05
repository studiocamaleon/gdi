import { PresupuestosService } from '../presupuestos.service';
import type { CurrentAuth } from '../../auth/auth.types';
import { expandir } from '../../auth/permisos';

/** Ejecuta el flujo real de evaluación/envío con persistencia y notificaciones simuladas. */
function escenario() {
  const update = jest.fn().mockResolvedValue({});
  const service = new PresupuestosService(
    { cotizacion: { update } } as never,
    ...(Array(9).fill({}) as [
      never,
      never,
      never,
      never,
      never,
      never,
      never,
      never,
      never,
    ]),
    { exigir: jest.fn() } as never,
  );
  const stub = (metodo: string, resultado: unknown) =>
    jest
      .spyOn(service as never, metodo as never)
      .mockResolvedValue(resultado as never);
  stub('exigir', {
    id: 'presupuesto-ficticio',
    clienteId: 'cliente-ficticio',
    estado: 'borrador',
    total: 100,
  });
  stub('evaluarReglas', [
    { regla: 'margen', detalle: 'Por debajo del mínimo' },
  ]);
  const evento = stub('evento', undefined);
  stub('detalle', { estado: 'pendiente_aprobacion' });
  const enviar = stub('ejecutarEnvio', { estado: 'enviado' });
  const avisar = stub('avisarAlCliente', undefined);
  return { service, update, evento, enviar, avisar };
}
describe('Aprobación por permiso, sin privilegios implícitos del enum histórico', () => {
  it.each(['ADMINISTRADOR', 'SUPERVISOR', 'OPERADOR'] as const)(
    '%s sin autorización queda pendiente y no envía',
    async (role) => {
      const c = escenario();
      const auth = {
        tenantId: 'empresa-ficticia',
        role,
        permisos: expandir([
          'acceso.por_vista',
          'comercial.presupuestos.gestionar',
        ]),
      } as CurrentAuth;
      await expect(
        c.service.enviar(auth, 'presupuesto-ficticio'),
      ).resolves.toEqual({ estado: 'pendiente_aprobacion' });
      expect(c.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ estado: 'pendiente_aprobacion' }),
        }),
      );
      expect(c.enviar).not.toHaveBeenCalled();
      expect(c.avisar).not.toHaveBeenCalled();
    },
  );
  it.each(['ADMINISTRADOR', 'SUPERVISOR', 'OPERADOR'] as const)(
    '%s con permiso puede asumir el envío y queda auditado',
    async (role) => {
      const c = escenario();
      const auth = {
        tenantId: 'empresa-ficticia',
        role,
        permisos: expandir([
          'acceso.por_vista',
          'comercial.presupuestos.gestionar',
          'comercial.aprobar_descuento',
        ]),
      } as CurrentAuth;
      await expect(
        c.service.enviar(auth, 'presupuesto-ficticio', {
          notificarWhatsapp: false,
        }),
      ).resolves.toEqual({ estado: 'enviado' });
      expect(c.evento).toHaveBeenCalledWith(
        auth,
        'presupuesto-ficticio',
        expect.objectContaining({ tipo: 'envio_asumido' }),
      );
      expect(c.enviar).toHaveBeenCalledTimes(1);
      expect(c.avisar).not.toHaveBeenCalled();
    },
  );
});
