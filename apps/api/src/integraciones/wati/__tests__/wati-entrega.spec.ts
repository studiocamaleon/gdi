import { WatiEntregaService } from '../wati-entrega.service';
import { getCurrentTenantId } from '../../../common/tenant-context';
import { ESTADOS } from '../../notificaciones/estados';

const ahora = new Date('2026-10-08T18:00:00Z');
function preparar() {
  const fila = { id: 'aviso-ficticio', tenantId: 'empresa-a', telefono: '5491150000000', reservaToken: 'intento-a', watiMensajeId: 'mensaje-a', estado: ESTADOS.aceptada as string, estadoEntrega: 'aceptado', enviadaEl: null };
  const db = { notificacionWhatsapp: { findMany: jest.fn(async (_args: unknown) => [fila]), updateMany: jest.fn(async () => ({ count: 1 })) } };
  const integraciones = { credencialesWati: jest.fn(async () => { expect(getCurrentTenantId()).toBe('empresa-a'); return { token: 'ficticio' }; }) };
  const receptor = { contact_phone: fila.telefono, local_message_id: fila.watiMensajeId, status: 'failed', failed_code: '131053' };
  const wati = {
    listarCampanias: jest.fn(async () => ({ broadcasts: [{ id: 'campania-a', name: 'grafo_intento-a' }] })),
    destinatariosCampania: jest.fn(async () => ({ recipients: [receptor] })),
    enviarPlantilla: jest.fn(),
  };
  const service = new WatiEntregaService(db as never, integraciones as never, wati as never);
  return { fila, db, receptor, wati, service };
}
it.each([['failed', 'fallido', ESTADOS.fallida], ['sent', 'enviado', ESTADOS.enviada], ['delivered', 'entregado', ESTADOS.enviada], ['read', 'leido', ESTADOS.enviada]])('registra el estado confirmado %s sin enviar nada', async (status, entrega, estado) => {
  const x = preparar(); x.receptor.status = status;
  await x.service.revisarTenant('empresa-a', ahora);
  expect(x.db.notificacionWhatsapp.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
    where: expect.objectContaining({ id: 'aviso-ficticio', tenantId: 'empresa-a', reservaToken: 'intento-a', estado: ESTADOS.aceptada }),
    data: expect.objectContaining({ estado, estadoEntrega: entrega, enviadaEl: status === 'failed' ? null : ahora }),
  }));
  expect(x.wati.enviarPlantilla).not.toHaveBeenCalled();
});
it.each(['queued', 'pending', 'unknown'])('no convierte %s en entrega ni fallo', async status => {
  const x = preparar(); x.receptor.status = status;
  await x.service.revisarTenant('empresa-a', ahora);
  expect(x.db.notificacionWhatsapp.updateMany).toHaveBeenCalledTimes(1);
});
it.each(['telefono', 'id', 'campania', 'duplicado'])('descarta una correlación incorrecta: %s', async caso => {
  const x = preparar();
  if (caso === 'telefono') x.receptor.contact_phone = '5491150009999';
  if (caso === 'id') x.receptor.local_message_id = 'otro-mensaje';
  if (caso === 'campania') x.wati.listarCampanias.mockResolvedValue({ broadcasts: [{ id: 'otra', name: 'grafo_intento-anterior' }] });
  if (caso === 'duplicado') x.wati.destinatariosCampania.mockResolvedValue({ recipients: [x.receptor, x.receptor] });
  await x.service.revisarTenant('empresa-a', ahora);
  expect(x.db.notificacionWhatsapp.updateMany).toHaveBeenCalledTimes(1);
});
it('un fallo de red conserva la aceptación y nunca dispara reintentos', async () => {
  const x = preparar(); x.wati.listarCampanias.mockRejectedValue(new Error('timeout'));
  await x.service.revisarTenant('empresa-a', ahora);
  expect(x.db.notificacionWhatsapp.updateMany).toHaveBeenCalledTimes(1);
  expect(x.wati.enviarPlantilla).not.toHaveBeenCalled();
});
it('un fallo posterior no habilita reenviar un mensaje cuya salida ya fue confirmada', async () => {
  const x = preparar(); x.fila.estado = ESTADOS.enviada; x.fila.estadoEntrega = 'enviado';
  await x.service.revisarTenant('empresa-a', ahora);
  expect(x.db.notificacionWhatsapp.updateMany).toHaveBeenCalledTimes(1);
});

it.each(['delivered', 'failed'])('reconcilia un envío incierto %s sin repetir el POST', async status => {
  const x = preparar(); x.fila.estado = ESTADOS.incierta; x.fila.estadoEntrega = 'sin_confirmar';
  x.receptor.status = status;
  await x.service.revisarTenant('empresa-a', ahora);
  const filtro = x.db.notificacionWhatsapp.findMany.mock.calls[0][0];
  expect(JSON.stringify(filtro)).toContain(ESTADOS.incierta);
  expect(x.db.notificacionWhatsapp.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
    where: expect.objectContaining({ estado: ESTADOS.incierta, reservaToken: 'intento-a' }),
    data: expect.objectContaining({ estado: status === 'failed' ? ESTADOS.fallida : ESTADOS.enviada, watiMensajeId: 'mensaje-a' }),
  }));
  expect(x.wati.enviarPlantilla).not.toHaveBeenCalled();
});

it('sin campaña comprobable mantiene el aviso incierto, sin autorizar otro envío', async () => {
  const x = preparar(); x.fila.estado = ESTADOS.incierta;
  x.wati.listarCampanias.mockResolvedValue({ broadcasts: [] });
  await x.service.revisarTenant('empresa-a', ahora);
  expect(x.db.notificacionWhatsapp.updateMany).toHaveBeenCalledTimes(1);
  expect(x.wati.enviarPlantilla).not.toHaveBeenCalled();
});
it('un fallo sin identificador de mensaje no habilita el reintento', async () => {
  const x = preparar(); x.fila.estado = ESTADOS.incierta; x.fila.estadoEntrega = 'sin_confirmar';
  x.fila.watiMensajeId = ''; x.receptor.local_message_id = '';
  await x.service.revisarTenant('empresa-a', ahora);
  expect(x.db.notificacionWhatsapp.updateMany).toHaveBeenCalledTimes(1);
});
