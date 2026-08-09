import { CATALOGO, FOOTER, validar } from '../catalogo';
import { mapearParametros } from '../wati.client';

/**
 * El catálogo se somete a Meta, que tarda 24-48 h en contestar y rechaza con
 * motivos genéricos. Todo lo que se pueda verificar de este lado, se verifica
 * de este lado.
 */
describe('catálogo canónico de plantillas', () => {
  it('tiene las 15 plantillas y ningún código repetido', () => {
    expect(CATALOGO).toHaveLength(15);
    const codigos = CATALOGO.map((p) => p.codigo);
    expect(new Set(codigos).size).toBe(15);
    const eventos = CATALOGO.map((p) => p.evento);
    expect(new Set(eventos).size).toBe(15);
  });

  it.each(CATALOGO.map((p) => [p.codigo, p] as const))(
    '%s cumple las reglas de Meta',
    (_codigo, plantilla) => {
      expect(validar(plantilla)).toEqual([]);
    },
  );

  it('todas llevan el mismo footer y entra en el límite de 60', () => {
    expect(FOOTER.length).toBeLessThanOrEqual(60);
    for (const p of CATALOGO) expect(p.footer).toBe(FOOTER);
  });

  /**
   * El eslogan de cierre es lo único que tumbó las plantillas viejas a
   * MARKETING (`nueva_orden_v4`: "Gracias por confiar en … para hacer
   * realidad tus ideas"). Este test no reemplaza al clasificador de Meta,
   * pero atrapa la recaída obvia cuando alguien edite un texto.
   */
  it('ninguna UTILITY tiene frases promocionales', () => {
    const prohibidas = [
      /gracias por (elegir|confiar)/i,
      /te esperamos/i,
      /hacer realidad/i,
      /no te lo pierdas/i,
      /aprovech[áa]/i,
      /oferta|promoci[óo]n|descuento/i,
    ];
    for (const p of CATALOGO.filter((x) => x.categoria === 'UTILITY')) {
      for (const regex of prohibidas) {
        expect(`${p.codigo}: ${p.cuerpo}`).not.toMatch(regex);
      }
    }
  });

  /**
   * La empresa habla en primera persona porque el mensaje sale de su número.
   * Si vuelve a colarse un {{nombre_empresa}}, el texto pasó a hablar de sí
   * mismo en tercera persona.
   */
  it('ninguna se nombra a sí misma', () => {
    for (const p of CATALOGO) {
      expect(p.parametros.map((x) => x.nombre)).not.toContain('nombre_empresa');
    }
  });

  /**
   * El ida y vuelta completo: si el normalizador lee de Wati el cuerpo
   * posicional y el nombrado, tiene que recuperar EXACTAMENTE los nombres
   * que declaramos, en orden. Es la garantía de que no vamos a mandar el
   * número de orden donde va el nombre.
   */
  it('el normalizador recupera los nombres en el orden declarado', () => {
    for (const p of CATALOGO) {
      const nombres = p.parametros.map((x) => x.nombre);
      const cuerpoNombrado = p.cuerpo.replace(
        /\{\{\s*(\d+)\s*\}\}/g,
        (_, n: string) => `{{${nombres[Number(n) - 1]}}}`,
      );
      expect(mapearParametros(p.cuerpo, cuerpoNombrado)).toEqual(nombres);
    }
  });
});

describe('validar', () => {
  const base = CATALOGO[0];

  it('rechaza un cuerpo que empieza con variable', () => {
    const errores = validar({ ...base, cuerpo: '{{1}} hola qué tal' });
    expect(errores).toContain('El cuerpo no puede empezar con una variable.');
  });

  it('rechaza un cuerpo que termina con variable', () => {
    const errores = validar({ ...base, cuerpo: 'Hola {{1}}' });
    expect(errores).toContain('El cuerpo no puede terminar con una variable.');
  });

  it('rechaza dos variables pegadas', () => {
    const errores = validar({ ...base, cuerpo: 'Hola {{1}} {{2}} qué tal' });
    expect(errores).toContain(
      'No puede haber dos variables seguidas sin texto en el medio.',
    );
  });

  it('detecta un parámetro declarado que el cuerpo no usa', () => {
    const errores = validar({
      ...base,
      cuerpo: 'Hola {{1}}, tu orden {{2}} salió bien',
      parametros: [
        { nombre: 'a', ejemplo: '1' },
        { nombre: 'b', ejemplo: '2' },
        { nombre: 'c', ejemplo: '3' },
      ],
    });
    expect(errores).toContain(
      'Declara parámetros que el cuerpo no usa: {{3}}.',
    );
  });

  it('detecta una variable del cuerpo que no está declarada', () => {
    const errores = validar({
      ...base,
      cuerpo: 'Hola {{1}}, tu orden {{9}} salió bien',
      parametros: [{ nombre: 'a', ejemplo: '1' }],
    });
    expect(errores).toContain('El cuerpo usa variables no declaradas: {{9}}.');
  });

  it('exige valor de ejemplo en todos los parámetros', () => {
    const errores = validar({
      ...base,
      parametros: base.parametros.map((p, i) =>
        i === 0 ? { ...p, ejemplo: '  ' } : p,
      ),
    });
    expect(errores).toContain(
      'Todos los parámetros necesitan un valor de ejemplo para el alta.',
    );
  });

  it('acepta un encabezado de imagen', () => {
    expect(validar({ ...base, encabezado: { tipo: 'IMAGE' } })).toEqual([]);
  });
});

describe('plantillas del QR de retiro', () => {
  // Las dos variantes del momento "listo": sin saldo y con saldo, cada una
  // con su QR. Espejan orden_lista / orden_lista_con_saldo.
  const qrs = CATALOGO.filter(
    (p) => p.evento === 'orden_lista_qr' || p.evento === 'orden_lista_con_saldo_qr',
  );

  it('son dos: la variante sin saldo y la con saldo', () => {
    expect(qrs.map((p) => p.evento).sort()).toEqual([
      'orden_lista_con_saldo_qr',
      'orden_lista_qr',
    ]);
  });

  it('las dos llevan header de imagen', () => {
    for (const qr of qrs) {
      expect(qr.encabezado?.tipo).toBe('IMAGE');
    }
  });

  it('ninguna arranca prendida: el envío se cablea con la aprobación', () => {
    for (const qr of qrs) {
      expect(qr.activoPorDefecto).toBe(false);
      expect(qr.cableado).toBeFalsy();
    }
  });

  it('la con-saldo declara el saldo pendiente', () => {
    const conSaldo = qrs.find((p) => p.evento === 'orden_lista_con_saldo_qr');
    expect(conSaldo?.parametros.map((x) => x.nombre)).toContain(
      'saldo_pendiente',
    );
  });

  it('pasan las reglas de Meta como cualquier otra', () => {
    for (const qr of qrs) expect(validar(qr)).toEqual([]);
  });
});
