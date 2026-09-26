import { normalizarPlantilla } from './meta-plantillas';
import {
  componentesPlantilla,
  textoPlantilla,
  validarValoresPlantilla,
} from '../../../common/inbox/plantillas';
const raw = {
  id: '123',
  name: 'pedido_listo',
  status: 'APPROVED',
  category: 'UTILITY',
  language: 'es_AR',
  parameter_format: 'NAMED',
  components: [
    { type: 'HEADER', format: 'TEXT', text: 'Pedido {{pedido}}' },
    { type: 'BODY', text: 'Hola {{nombre}}, gracias {{nombre}}.' },
    { type: 'FOOTER', text: 'Equipo ficticio' },
  ],
};
it('separa variables por componente y no duplica nombres repetidos ni expone crudos', () => {
  const p = normalizarPlantilla(raw, 'cursor')!;
  expect(p.motivo).toBeNull();
  expect(p.variables).toHaveLength(2);
  expect(componentesPlantilla(p, ['42', 'Alma'])).toEqual([
    {
      type: 'header',
      parameters: [{ type: 'text', parameter_name: 'pedido', text: '42' }],
    },
    {
      type: 'body',
      parameters: [{ type: 'text', parameter_name: 'nombre', text: 'Alma' }],
    },
  ]);
  expect(textoPlantilla(p, ['42', 'Alma'])).toContain(
    'Hola Alma, gracias Alma.',
  );
  expect(p).not.toHaveProperty('components');
  expect(normalizarPlantilla(raw, 'otro')!.version).toBe(p.version);
});
it('ordena parámetros posicionales por número y conserva el orden visual', () => {
  const p = normalizarPlantilla(
    {
      ...raw,
      parameter_format: 'POSITIONAL',
      components: [{ type: 'BODY', text: '{{2}}: pedido {{1}}' }],
    },
    null,
  )!;
  expect(componentesPlantilla(p, ['42', 'Alma'])).toEqual([
    {
      type: 'body',
      parameters: [
        { type: 'text', text: '42' },
        { type: 'text', text: 'Alma' },
      ],
    },
  ]);
  expect(textoPlantilla(p, ['42', 'Alma'])).toBe('Alma: pedido 42');
});
it.each([
  { status: 'PAUSED' },
  { category: 'AUTHENTICATION' },
  { components: [{ type: 'HEADER', format: 'IMAGE' }] },
  { components: [{ type: 'BODY', text: 'Hola' }, { type: 'CAROUSEL' }] },
  {
    components: [
      { type: 'BODY', text: 'Hola' },
      {
        type: 'BUTTONS',
        buttons: [
          { type: 'URL', text: 'Abrir', url: 'https://example.invalid/{{1}}' },
        ],
      },
    ],
  },
  {
    parameter_format: 'POSITIONAL',
    components: [{ type: 'BODY', text: 'Hola {{2}}' }],
  },
])('bloquea componentes incompatibles o estado no aprobado: %j', (c) =>
  expect(normalizarPlantilla({ ...raw, ...c }, null)!.motivo).toBeTruthy(),
);
it('valida valores requeridos, cantidad y largo del mensaje completo', () => {
  const p = normalizarPlantilla(raw, null)!;
  expect(validarValoresPlantilla(p, ['42', 'Alma'])).toBeNull();
  for (const v of [
    [],
    ['42', ''],
    ['42', 'Alma\nLago'],
    ['x'.repeat(60), 'Alma'],
    ['42', '{{otro}}'],
    ['42', 'Alma', 'extra'],
  ])
    expect(validarValoresPlantilla(p, v)).toBeTruthy();
});
it('detecta cambios en acciones de botones estáticos', () => {
  const b = {
    type: 'BUTTONS',
    buttons: [
      { type: 'URL', text: 'Ver', url: 'https://example.invalid/pedido' },
    ],
  };
  const p = normalizarPlantilla(
    { ...raw, components: [...raw.components, b] },
    null,
  )!;
  expect(p.motivo).toBeNull();
  expect(
    normalizarPlantilla(
      {
        ...raw,
        components: [
          ...raw.components,
          {
            ...b,
            buttons: [{ ...b.buttons[0], url: 'https://example.invalid/otro' }],
          },
        ],
      },
      null,
    )!.version,
  ).not.toBe(p.version);
});

it.each([
  ['IMAGE', 'image'],
  ['DOCUMENT', 'document'],
])('admite encabezado %s sin exponer URLs de ejemplos', (format, archivo) => {
  const p = normalizarPlantilla(
    {
      ...raw,
      components: [
        {
          type: 'HEADER',
          format,
          example: { header_handle: ['secreto-de-ejemplo'] },
        },
        { type: 'BODY', text: 'Tu archivo' },
      ],
    },
    null,
  )!;
  expect(p.motivo).toBeNull();
  expect(p.archivo).toBe(archivo);
  expect(JSON.stringify(p)).not.toContain('secreto-de-ejemplo');
});
it.each(['VIDEO', 'LOCATION', 'NEW'])(
  'mantiene cerrado encabezado no compatible %s',
  (format) => {
    expect(
      normalizarPlantilla(
        {
          ...raw,
          components: [
            { type: 'HEADER', format },
            { type: 'BODY', text: 'Hola' },
          ],
        },
        null,
      )!.motivo,
    ).toBeTruthy();
  },
);
