import { crearCorreoInvitacionEmpresa } from './invitacion-empresa';

const datos = {
  empresa: 'Gráfica Sur',
  plan: 'Co-founder Pro',
  url: 'https://grafo.test/aceptar-invitacion?token=prueba',
  venceEl: new Date('2026-09-29T18:00:00Z'),
  trialHasta: new Date('2026-10-22T18:00:00Z'),
  moneda: 'USD',
  mensual: 290,
  implementacion: 0,
};

it('muestra las condiciones reales y aclara que aceptar no cobra', () => {
  const r = crearCorreoInvitacionEmpresa(datos);
  expect(r.html).toContain('USD 290');
  expect(r.text).toContain('Implementación: Sin cargo');
  expect(r.html).toContain('Aceptar la invitación no realiza un cobro');
  expect(r.text).toContain('22 de octubre de 2026');
  expect(r.html).not.toContain('30 días desde');
  expect(r.text).toContain(datos.url);
});
it('no ofrece implementación gratuita ni prueba cuando no hay datos', () => {
  const r = crearCorreoInvitacionEmpresa({
    ...datos,
    trialHasta: null,
    implementacion: null,
    mensual: null,
  });
  expect(r.text).not.toContain('Sin cargo');
  expect(r.text).not.toContain('Prueba disponible');
  expect(r.text).not.toContain('Abono mensual');
});
it('escapa empresa, plan y URL en el HTML', () => {
  const r = crearCorreoInvitacionEmpresa({
    ...datos,
    empresa: '<script>A&B</script>',
    plan: '<img src=x>',
  });
  expect(r.html).not.toContain('<script>');
  expect(r.html).not.toContain('<img src=x>');
  expect(r.html).toContain('A&amp;B');
  expect(() =>
    crearCorreoInvitacionEmpresa({ ...datos, url: 'javascript:alert(1)' }),
  ).toThrow();
});
