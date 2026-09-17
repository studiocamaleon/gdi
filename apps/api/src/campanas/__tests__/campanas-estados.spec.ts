import { transicionCampanaPermitida } from '../campanas.service';
import type { CampanaEstado } from '../dto/campanas.dto';

describe('máquina de estados de campañas', () => {
  const permitidas: Array<[CampanaEstado, CampanaEstado]> = [
    ['borrador', 'activo'],
    ['borrador', 'cancelado'],
    ['activo', 'pausado'],
    ['activo', 'completado'],
    ['activo', 'cancelado'],
    ['pausado', 'activo'],
    ['pausado', 'completado'],
    ['pausado', 'cancelado'],
    ['completado', 'activo'],
  ];

  it.each(permitidas)('permite %s → %s', (desde, hacia) => {
    expect(transicionCampanaPermitida(desde, hacia)).toBe(true);
  });

  it('acepta una repetición idempotente del mismo estado', () => {
    expect(transicionCampanaPermitida('activo', 'activo')).toBe(true);
  });

  it.each<CampanaEstado>([
    'borrador',
    'activo',
    'pausado',
    'completado',
    'cancelado',
  ])('cancelado es terminal frente a %s', (hacia) => {
    expect(transicionCampanaPermitida('cancelado', hacia)).toBe(
      hacia === 'cancelado',
    );
  });

  it('no permite saltar de borrador a completado', () => {
    expect(transicionCampanaPermitida('borrador', 'completado')).toBe(false);
  });
});
