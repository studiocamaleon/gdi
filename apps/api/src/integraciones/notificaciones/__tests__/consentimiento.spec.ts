import { POR_EVENTO } from '../../wati/catalogo';

/**
 * La regla de consentimiento, aislada de la base.
 *
 * Es la que decide si un cliente real recibe o no un mensaje, y tiene un caso
 * que no admite discusión —el que pidió no recibir— y uno que sí: el que
 * nunca dijo nada. Wati no exige opt-in (manda a cualquier número), pero la
 * política de Meta lo pide y el castigo es indirecto: la gente bloquea, baja
 * la calidad del número, Meta pausa plantillas.
 *
 * La distinción que hace esto proporcionado es QUÉ bloquea la gente: el
 * marketing, no el aviso de su propia orden.
 */
function puedeRecibir(
  aceptaWhatsapp: boolean | null,
  categoria: 'UTILITY' | 'MARKETING',
): boolean {
  if (aceptaWhatsapp === false) return false;
  if (categoria === 'MARKETING' && aceptaWhatsapp !== true) return false;
  return true;
}

describe('consentimiento por categoría', () => {
  describe('el que pidió no recibir', () => {
    it('no recibe nada, ni siquiera lo transaccional', () => {
      expect(puedeRecibir(false, 'UTILITY')).toBe(false);
      expect(puedeRecibir(false, 'MARKETING')).toBe(false);
    });
  });

  describe('el que nunca dijo nada (null)', () => {
    /**
     * El caso que hace que el módulo sirva desde el día uno. Con opt-in
     * estricto no saldría un solo mensaje hasta juntar consentimientos uno por
     * uno, y un sistema mudo se termina apagando.
     */
    it('recibe los transaccionales', () => {
      expect(puedeRecibir(null, 'UTILITY')).toBe(true);
    });

    it('NO recibe los promocionales', () => {
      expect(puedeRecibir(null, 'MARKETING')).toBe(false);
    });
  });

  describe('el que aceptó', () => {
    it('recibe todo', () => {
      expect(puedeRecibir(true, 'UTILITY')).toBe(true);
      expect(puedeRecibir(true, 'MARKETING')).toBe(true);
    });
  });

  /**
   * Con el catálogo de verdad: sin pedir nada a nadie, un tenant tiene los
   * trece avisos de su operación andando y los dos promocionales apagados.
   */
  it('sobre el catálogo real, sólo dos eventos exigen aceptación', () => {
    const conCatalogo = [...POR_EVENTO.values()];
    const sinPreguntar = conCatalogo.filter((p) =>
      puedeRecibir(null, p.categoria),
    );
    expect(sinPreguntar).toHaveLength(13);

    const bloqueados = conCatalogo
      .filter((p) => !puedeRecibir(null, p.categoria))
      .map((p) => p.evento)
      .sort();
    expect(bloqueados).toEqual(['presupuesto_por_vencer', 'resena']);
  });
});
