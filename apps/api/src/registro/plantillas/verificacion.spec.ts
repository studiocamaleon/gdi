import { crearCorreoVerificacion } from './verificacion';

const datos = {
  nombre: 'Lucas',
  empresa: 'Gráfica de ejemplo',
  plan: 'Grafo Pro',
  trialDias: 14,
  url: 'https://app.grafoprint.com.ar/registro/verificar?token=ejemplo&origen=web',
};

describe('correo de verificación', () => {
  it.each([1, 14, 30])(
    'respeta un plazo de prueba de %s días en HTML y texto',
    (trialDias) => {
      const correo = crearCorreoVerificacion({ ...datos, trialDias });
      const plazo = `${trialDias} ${trialDias === 1 ? 'día' : 'días'} de prueba`;
      expect(correo.html).toContain(plazo);
      expect(correo.text).toContain(plazo);
      expect(correo.html).toContain(datos.plan);
      expect(correo.text).toContain(datos.plan);
    },
  );

  it.each([null, 0, -1, 1.5, NaN])(
    'no inventa un período de prueba para %s',
    (trialDias) => {
      const correo = crearCorreoVerificacion({ ...datos, trialDias });
      expect(correo.html).not.toContain('días de prueba');
      expect(correo.text).not.toContain('Sin tarjeta');
    },
  );

  it('escapa datos en asunto HTML, preheader, empresa, plan y enlaces', () => {
    const correo = crearCorreoVerificacion({
      ...datos,
      nombre: '<img src=x onerror=alert(1)>',
      empresa: 'A&B <script>',
      plan: 'Plan "especial"',
    });
    expect(correo.html).not.toContain('<script>');
    expect(correo.html).not.toContain('<img src=x');
    expect(correo.html).toContain('A&amp;B &lt;script&gt;');
    expect(correo.html).toContain('Plan &quot;especial&quot;');
    expect(correo.html).toContain('token=ejemplo&amp;origen=web');
    expect(correo.text).toContain(datos.url);
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,hola',
    'https://usuario:clave@example.com',
  ])('rechaza enlaces inseguros: %s', (url) => {
    expect(() => crearCorreoVerificacion({ ...datos, url })).toThrow(
      'HTTP o HTTPS',
    );
  });

  it('identifica las muestras y mantiene limpio el correo real', () => {
    const real = crearCorreoVerificacion(datos);
    const prueba = crearCorreoVerificacion(datos, { prueba: true });
    expect(real.subject).not.toContain('[PRUEBA]');
    expect(real.html).not.toContain('Vista de prueba');
    expect(prueba.subject).toContain('[PRUEBA]');
    expect(prueba.html).toContain('no confirma ni crea una cuenta');
    expect(prueba.text).toContain('VISTA DE PRUEBA');
  });
});
