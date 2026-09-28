import { fechaMeta, normalizarEventoInbox } from './meta-inbox-normalizar';

const propio = '+16505550100',
  contacto = '16505550123';
const base = {
  id: 'wamid.ensayo',
  from: contacto,
  timestamp: '1700000000',
  type: 'text',
  text: { body: 'Hola ficticio' },
};
const history = (
  messages: unknown[],
  metadata = { phase: 0, chunk_order: 1, progress: 10 },
) => ({
  tipo: 'history',
  payload: { history: [{ metadata, threads: [{ id: contacto, messages }] }] },
});

it('distingue entradas y salidas del historial y pone el progreso después del contenido', () => {
  const r = normalizarEventoInbox(
    history([base, { ...base, id: 'wamid.salida', from: propio }]),
    propio,
  );
  expect(r.avisos).toBe(0);
  expect(r.operaciones).toMatchObject([
    { clase: 'mensaje', direccion: 'ENTRANTE', origen: 'HISTORIAL', contacto },
    { clase: 'mensaje', direccion: 'SALIENTE', origen: 'HISTORIAL', contacto },
    { clase: 'progreso', progreso: 10 },
  ]);
});
it('el eco del celular conserva su dirección saliente', () => {
  expect(
    normalizarEventoInbox(
      {
        tipo: 'smb_message_echoes',
        payload: { message_echoes: [{ ...base, from: propio, to: contacto }] },
      },
      propio,
    ),
  ).toMatchObject({
    avisos: 0,
    operaciones: [
      { clase: 'mensaje', direccion: 'SALIENTE', origen: 'CELULAR', contacto },
    ],
  });
});
it.each([
  { ...base, from: '16505550124' },
  { ...base, to: '16505550124' },
  { ...base, from: '123@g.us' },
])('no adjudica mensajes históricos contradictorios a un hilo', (mensaje) => {
  const r = normalizarEventoInbox(history([mensaje]), propio);
  expect(r.avisos).toBe(1);
  expect(r.operaciones.filter((o) => o.clase === 'mensaje')).toHaveLength(0);
});
it('los adjuntos tardíos se identifican sólo por wamid y no inventan una conversación', () => {
  const r = normalizarEventoInbox(
    {
      tipo: 'history',
      payload: {
        messages: [
          {
            ...base,
            type: 'image',
            image: {
              id: '900001',
              caption: 'Imagen ficticia',
              url: 'https://ajeno.example.invalid/privado',
              mime_type: 'image/jpeg',
            },
          },
        ],
      },
    },
    propio,
  );
  expect(r).toMatchObject({
    avisos: 0,
    operaciones: [
      {
        clase: 'complemento',
        wamid: base.id,
        contenido: { mediaId: '900001' },
      },
    ],
  });
  expect(JSON.stringify(r)).not.toContain('url');
  expect(JSON.stringify(r)).not.toContain('contacto');
});
it('un marcador de archivo tiene menor prioridad que su información posterior', () => {
  const r = normalizarEventoInbox(
    history([{ ...base, type: 'media_placeholder' }]),
    propio,
  );
  expect(r.operaciones[0]).toMatchObject({
    prioridad: 0,
    contenido: { adjuntoPendiente: true },
  });
});
it('representa el rechazo explícito del historial', () => {
  expect(
    normalizarEventoInbox(
      {
        tipo: 'history',
        payload: { history: [{ errors: [{ code: 2593109 }] }] },
      },
      propio,
    ),
  ).toEqual({ avisos: 0, operaciones: [{ clase: 'historial_rechazado' }] });
});
it('un error desconocido queda para revisión en lugar de interpretarse como rechazo', () => {
  expect(
    normalizarEventoInbox(
      { tipo: 'history', payload: { history: [{ errors: [{ code: 999 }] }] } },
      propio,
    ),
  ).toEqual({ avisos: 1, operaciones: [] });
});
it('normaliza contactos y su eliminación sin convertirlos en clientes de Grafo', () => {
  const r = normalizarEventoInbox(
    {
      tipo: 'smb_app_state_sync',
      payload: {
        state_sync: [
          {
            type: 'contact',
            action: 'add',
            contact: { phone_number: contacto, full_name: 'Cliente ficticio' },
            metadata: { timestamp: '1700000000' },
          },
          {
            type: 'contact',
            action: 'remove',
            contact: { phone_number: contacto },
            metadata: { timestamp: '1700000010' },
          },
        ],
      },
    },
    propio,
  );
  expect(r).toMatchObject({
    avisos: 0,
    operaciones: [
      { clase: 'contacto', nombre: 'Cliente ficticio', eliminado: false },
      { clase: 'contacto', nombre: null, eliminado: true },
    ],
  });
});
it.each(['edit', 'revoke'])(
  'apunta %s al mensaje original y conserva la fecha del cambio',
  (type) => {
    const r = normalizarEventoInbox(
      {
        tipo: 'messages',
        payload: {
          messages: [
            {
              ...base,
              type,
              [type]: {
                original_message_id: 'wamid.original',
                message: { type: 'text', text: { body: 'Texto corregido' } },
              },
            },
          ],
        },
      },
      propio,
    );
    expect(r.operaciones[0]).toMatchObject({
      clase: type === 'edit' ? 'edicion' : 'revocacion',
      wamid: 'wamid.original',
      fecha: new Date(1700000000000),
    });
  },
);
it('el orden de estados impide que un fallo tardío rebaje una entrega leída', () => {
  const r = normalizarEventoInbox(
    {
      tipo: 'statuses',
      payload: {
        statuses: [
          { id: base.id, status: 'read', timestamp: '1700000000' },
          { id: base.id, status: 'failed', timestamp: '1700000010' },
        ],
      },
    },
    propio,
  );
  expect(r.operaciones).toMatchObject([
    { estado: 'READ', orden: 5 },
    { estado: 'ERROR', orden: 2 },
  ]);
});
it('conserva texto como texto y clasifica tipos aún no representados para revisión', () => {
  const r = normalizarEventoInbox(
    {
      tipo: 'messages',
      payload: {
        messages: [
          { ...base, text: { body: '<script>alert(1)</script>' } },
          { ...base, id: 'wamid.nuevo-tipo', type: 'tipo_futuro' },
        ],
      },
    },
    propio,
  );
  expect(r.operaciones[0]).toMatchObject({
    contenido: { texto: '<script>alert(1)</script>' },
  });
  expect(r.avisos).toBe(1);
});
it.each([
  null,
  undefined,
  NaN,
  Infinity,
  -1,
  0,
  8.64e12,
  'no-fecha',
  '1700000000.5',
])('rechaza fecha inválida %s', (fecha) => {
  expect(fechaMeta(fecha)).toBeNull();
});
it('conserva miles de mensajes y fases vacías sin inventar progreso', () => {
  const messages = Array.from({ length: 3000 }, (_, n) => ({
    ...base,
    id: `wamid.ensayo${n}`,
  }));
  const r = normalizarEventoInbox(
    history(messages, { phase: 2, chunk_order: 9, progress: 100 }),
    propio,
  );
  expect(r.avisos).toBe(0);
  expect(r.operaciones).toHaveLength(3001);
  expect(
    normalizarEventoInbox(
      { tipo: 'history', payload: { history: [] } },
      propio,
    ),
  ).toEqual({ avisos: 0, operaciones: [] });
});
it('exige tiempo y número coherentes para cambios de cuenta', () => {
  const payload = { event: 'PARTNER_REMOVED', phone_number: propio };
  expect(
    normalizarEventoInbox({ tipo: 'account_update', payload }, propio).avisos,
  ).toBe(1);
  expect(
    normalizarEventoInbox(
      { tipo: 'account_update', payload, metaTimestamp: new Date() },
      propio,
    ).operaciones[0],
  ).toMatchObject({ clase: 'cuenta', evento: 'PARTNER_REMOVED' });
  expect(
    normalizarEventoInbox(
      {
        tipo: 'account_update',
        payload: { ...payload, phone_number: contacto },
        metaTimestamp: new Date(),
      },
      propio,
    ).avisos,
  ).toBe(1);
});
it.each([
  { tipo: 'otro', payload: {} },
  { tipo: 'messages', payload: { messages: [null] } },
  { tipo: 'history', payload: {} },
])('conserva formas desconocidas para revisión: $tipo', (evento) => {
  expect(normalizarEventoInbox(evento, propio).avisos).toBeGreaterThan(0);
});

it('normaliza ubicación, contactos, citas y reacciones sin conservar URLs remotas', () => {
  const r = normalizarEventoInbox(
    {
      tipo: 'messages',
      payload: {
        messages: [
          {
            ...base,
            type: 'location',
            location: {
              latitude: -50.3,
              longitude: -72.2,
              name: 'Local ficticio',
              address: 'Dirección de ejemplo',
              url: 'https://example.invalid/no',
            },
          },
          {
            ...base,
            id: 'wamid.contacto',
            type: 'contacts',
            contacts: [
              {
                name: { formatted_name: 'Alma Ficticia' },
                phones: [{ phone: '+16505550123' }],
                emails: [{ email: 'alma@example.invalid' }],
                org: { company: 'Gráfica Demo' },
                url: 'https://example.invalid/no',
              },
            ],
          },
          { ...base, id: 'wamid.cita', context: { id: base.id } },
          {
            ...base,
            id: 'wamid.reaccion',
            type: 'reaction',
            reaction: { message_id: base.id, emoji: '👍' },
          },
          {
            ...base,
            id: 'wamid.quitar',
            type: 'reaction',
            reaction: { message_id: base.id, emoji: '' },
          },
          {
            ...base,
            id: 'wamid.no-soportado',
            type: 'unsupported',
            errors: [
              { code: 131060, message: 'No conservar el texto del proveedor' },
            ],
          },
        ],
      },
    },
    propio,
  );
  expect(r.operaciones).toMatchObject([
    {
      contenido: {
        ubicacion: {
          latitud: -50.3,
          longitud: -72.2,
          nombre: 'Local ficticio',
        },
      },
    },
    {
      contenido: {
        contactos: [
          {
            nombre: 'Alma Ficticia',
            telefonos: ['+16505550123'],
            correos: ['alma@example.invalid'],
          },
        ],
      },
    },
    { contenido: { texto: 'Hola ficticio', contextoWamid: base.id } },
    { contenido: { reaccionWamid: base.id, emoji: '👍' } },
    { contenido: { reaccionWamid: base.id, emoji: '' } },
    { contenido: { codigos: [131060] } },
  ]);
  expect(JSON.stringify(r)).not.toContain('https://');
  expect(JSON.stringify(r)).not.toContain('No conservar');
});
it.each([
  { latitude: 91, longitude: 0 },
  { latitude: 0, longitude: 181 },
  { latitude: '-50', longitude: -72 },
  { latitude: NaN, longitude: 0 },
])('no presenta una ubicación malformada: %j', (location) => {
  const r = normalizarEventoInbox(
    {
      tipo: 'messages',
      payload: { messages: [{ ...base, type: 'location', location }] },
    },
    propio,
  );
  expect(r.operaciones[0]).toMatchObject({
    contenido: { noRepresentado: true },
  });
});
