/** Formatos oficiales de coexistencia. Función pura: nunca llama a Meta,
 * interpreta HTML, descarga URLs ni dispara automatizaciones. */
type Objeto = Record<string, unknown>;
export const objeto = (v: unknown): Objeto =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Objeto) : {};
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const texto = (v: unknown, max = 16_384) =>
  typeof v === 'string' && v.length <= max ? v : null;
export const telefono = (v: unknown) => {
  const s = texto(v, 50)?.replace(/[\s()+.-]/g, '') ?? '';
  return /^[1-9]\d{7,14}$/.test(s) ? s : null;
};
const wamid = (v: unknown) => {
  const s = texto(v, 1024);
  return s?.startsWith('wamid.') ? s : null;
};
export function fechaMeta(v: unknown): Date | null {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  if (typeof v === 'string' && !/^\d+$/.test(v)) return null;
  const n = Number(v);
  return Number.isSafeInteger(n) && n > 0 && n < 8.64e12
    ? new Date(n * 1000)
    : null;
}
type Contenido = { tipo: string; contenido: Objeto; prioridad: number };
export type OperacionInbox =
  | ({
      clase: 'mensaje';
      wamid: string;
      contacto: string;
      direccion: 'ENTRANTE' | 'SALIENTE';
      fecha: Date;
      origen: 'HISTORIAL' | 'CELULAR' | 'NUEVO';
    } & Contenido)
  | ({ clase: 'complemento'; wamid: string } & Contenido)
  | ({ clase: 'edicion'; wamid: string; fecha: Date } & Contenido)
  | { clase: 'revocacion'; wamid: string; fecha: Date }
  | {
      clase: 'estado';
      wamid: string;
      estado: string;
      orden: number;
      fecha: Date;
    }
  | {
      clase: 'contacto';
      waId: string;
      nombre: string | null;
      eliminado: boolean;
      fecha: Date;
    }
  | { clase: 'progreso'; fase: number; orden: number; progreso: number }
  | { clase: 'historial_rechazado' }
  | {
      clase: 'cuenta';
      evento: 'PARTNER_REMOVED' | 'ACCOUNT_OFFBOARDED' | 'ACCOUNT_RECONNECTED';
      fecha: Date;
      numero: string | null;
    };
export type EventoParaInbox = {
  tipo: string;
  payload: unknown;
  metaTimestamp?: Date | null;
};
const estados: Record<string, number> = {
  PENDING: 1,
  ERROR: 2,
  FAILED: 2,
  SENT: 3,
  DELIVERED: 4,
  READ: 5,
  PLAYED: 6,
};

function contenidoMensaje(m: Objeto, prioridad: number): Contenido | null {
  const tipo = texto(m.type, 80);
  if (!tipo) return null;
  const source = objeto(m[tipo]);
  if (tipo === 'text') {
    const body = texto(source.body);
    return body === null
      ? null
      : { tipo, contenido: { texto: body }, prioridad };
  }
  if (['image', 'video', 'audio', 'document', 'sticker'].includes(tipo)) {
    const mediaId = texto(source.id, 256);
    return {
      tipo,
      prioridad: mediaId ? prioridad : 0,
      contenido: {
        ...(mediaId ? { mediaId } : {}),
        ...(texto(source.caption) !== null
          ? { texto: texto(source.caption) }
          : {}),
        ...(texto(source.mime_type, 200) ? { mimeType: source.mime_type } : {}),
        ...(texto(source.filename, 1024)
          ? { nombreArchivo: source.filename }
          : {}),
        ...(texto(source.sha256, 200) ? { sha256: source.sha256 } : {}),
        ...(typeof source.voice === 'boolean' ? { voz: source.voice } : {}),
      },
    };
  }
  if (tipo === 'media_placeholder')
    return { tipo, contenido: { adjuntoPendiente: true }, prioridad: 0 };
  if (tipo === 'button')
    return { tipo, contenido: { texto: texto(source.text) ?? '' }, prioridad };
  if (tipo === 'interactive') {
    const respuesta = objeto(source.button_reply ?? source.list_reply);
    return {
      tipo,
      contenido: {
        texto: texto(respuesta.title) ?? '',
        respuestaId: texto(respuesta.id, 1024),
      },
      prioridad,
    };
  }
  // Los tipos aún sin representación se conservan crudos para ampliar soporte.
  return { tipo, contenido: { noRepresentado: true }, prioridad };
}

export function normalizarEventoInbox(
  evento: EventoParaInbox,
  numeroEmpresa: string,
) {
  const value = objeto(evento.payload),
    propio = telefono(numeroEmpresa);
  const operaciones: OperacionInbox[] = [];
  let avisos = 0;
  const avisar = () => {
    avisos++;
  };
  if (!propio) return { operaciones, avisos: 1 };
  const estado = (id: string, raw: unknown, fecha: Date) => {
    const s = texto(raw, 30)?.toUpperCase();
    if (s && estados[s])
      operaciones.push({
        clase: 'estado',
        wamid: id,
        estado: s === 'FAILED' ? 'ERROR' : s,
        orden: estados[s],
        fecha,
      });
    else avisar();
  };
  const mensaje = (
    raw: unknown,
    origen: 'HISTORIAL' | 'CELULAR' | 'NUEVO',
    hilo?: string,
    complemento = false,
  ) => {
    const m = objeto(raw),
      id = wamid(m.id),
      fecha = fechaMeta(m.timestamp);
    if (!id || !fecha) return avisar();
    // Un complemento de adjunto no determina dirección, hilo ni fecha original.
    if (complemento) {
      const contenido = contenidoMensaje(m, 2);
      if (
        !contenido ||
        !['image', 'video', 'audio', 'document', 'sticker'].includes(
          contenido.tipo,
        ) ||
        !contenido.contenido.mediaId
      )
        return avisar();
      operaciones.push({ clase: 'complemento', wamid: id, ...contenido });
      return;
    }
    if (m.type === 'edit' || m.type === 'revoke') {
      // Historial no documenta estos eventos: conservarlo para revisión.
      if (origen === 'HISTORIAL') return avisar();
      const from = telefono(m.from),
        to = telefono(m.to);
      if (!from || (m.to !== undefined && !to)) return avisar();
      const cambio = objeto(m[m.type]),
        original = wamid(cambio.original_message_id);
      if (!original) return avisar();
      if (m.type === 'revoke')
        operaciones.push({ clase: 'revocacion', wamid: original, fecha });
      else {
        const contenido = contenidoMensaje(objeto(cambio.message), 4);
        if (!contenido) return avisar();
        if (contenido.contenido.noRepresentado) avisar();
        operaciones.push({
          clase: 'edicion',
          wamid: original,
          fecha,
          ...contenido,
          prioridad: 4,
        });
      }
      return;
    }
    const from = telefono(m.from),
      to = telefono(m.to);
    let contacto: string | null = null,
      direccion: 'ENTRANTE' | 'SALIENTE';
    if (origen === 'NUEVO') {
      if (!from || from === propio || (m.to !== undefined && to !== propio))
        return avisar();
      contacto = from;
      direccion = 'ENTRANTE';
    } else if (origen === 'CELULAR') {
      if (from !== propio || !to || to === propio) return avisar();
      contacto = to;
      direccion = 'SALIENTE';
    } else {
      contacto = telefono(hilo);
      if (!contacto || contacto === propio) return avisar();
      if (from === propio && (m.to === undefined || to === contacto))
        direccion = 'SALIENTE';
      else if (from === contacto && (m.to === undefined || to === propio))
        direccion = 'ENTRANTE';
      else return avisar();
    }
    const contenido = contenidoMensaje(m, origen === 'HISTORIAL' ? 1 : 3);
    if (!contenido) return avisar();
    operaciones.push({
      clase: 'mensaje',
      wamid: id,
      contacto,
      direccion,
      fecha,
      origen,
      ...contenido,
    });
    if (contenido.contenido.noRepresentado) avisar();
    const entrega = objeto(m.history_context).status;
    if (origen === 'HISTORIAL' && entrega !== undefined)
      estado(id, entrega, fecha);
  };

  if (evento.tipo === 'history') {
    if (!Array.isArray(value.history) && !Array.isArray(value.messages))
      avisar();
    for (const raw of lista(value.history)) {
      const h = objeto(raw),
        errors = lista(h.errors);
      if (errors.length) {
        for (const e of errors) {
          if (objeto(e).code === 2593109)
            operaciones.push({ clase: 'historial_rechazado' });
          else avisar();
        }
        continue;
      }
      const meta = objeto(h.metadata);
      if (!Array.isArray(h.threads)) avisar();
      for (const rawHilo of lista(h.threads)) {
        const hilo = objeto(rawHilo);
        if (!Array.isArray(hilo.messages)) avisar();
        for (const m of lista(hilo.messages))
          mensaje(m, 'HISTORIAL', texto(hilo.id) ?? '');
      }
      // Progreso DESPUÉS de procesar los mensajes del bloque.
      if (
        [0, 1, 2].includes(meta.phase as number) &&
        Number.isInteger(meta.chunk_order) &&
        Number(meta.chunk_order) >= 0 &&
        Number(meta.chunk_order) <= 2147483647 &&
        Number.isInteger(meta.progress) &&
        Number(meta.progress) >= 0 &&
        Number(meta.progress) <= 100
      )
        operaciones.push({
          clase: 'progreso',
          fase: meta.phase as number,
          orden: meta.chunk_order as number,
          progreso: meta.progress as number,
        });
      else avisar();
    }
    for (const m of lista(value.messages))
      mensaje(m, 'HISTORIAL', undefined, true);
  } else if (
    evento.tipo === 'messages' ||
    evento.tipo === 'smb_message_echoes'
  ) {
    const raw =
      evento.tipo === 'messages' ? value.messages : value.message_echoes;
    if (!Array.isArray(raw) || !raw.length) avisar();
    for (const m of lista(raw))
      mensaje(m, evento.tipo === 'messages' ? 'NUEVO' : 'CELULAR');
  } else if (evento.tipo === 'statuses') {
    if (!Array.isArray(value.statuses) || !value.statuses.length) avisar();
    for (const raw of lista(value.statuses)) {
      const s = objeto(raw),
        id = wamid(s.id),
        fecha = fechaMeta(s.timestamp);
      if (!id || !fecha) avisar();
      else estado(id, s.status, fecha);
    }
  } else if (evento.tipo === 'smb_app_state_sync') {
    if (!Array.isArray(value.state_sync)) avisar();
    for (const raw of lista(value.state_sync)) {
      const s = objeto(raw),
        contacto = objeto(s.contact),
        waId = telefono(contacto.phone_number),
        fecha = fechaMeta(objeto(s.metadata).timestamp);
      if (
        s.type !== 'contact' ||
        !waId ||
        !fecha ||
        !['add', 'remove'].includes(String(s.action))
      ) {
        avisar();
        continue;
      }
      operaciones.push({
        clase: 'contacto',
        waId,
        fecha,
        eliminado: s.action === 'remove',
        nombre:
          s.action === 'remove'
            ? null
            : (texto(contacto.full_name, 1024) ??
              texto(contacto.first_name, 1024)),
      });
    }
  } else if (evento.tipo === 'account_update') {
    if (
      ![
        'PARTNER_REMOVED',
        'ACCOUNT_OFFBOARDED',
        'ACCOUNT_RECONNECTED',
      ].includes(String(value.event)) ||
      !evento.metaTimestamp ||
      !Number.isFinite(evento.metaTimestamp.getTime())
    )
      avisar();
    else if (
      value.event === 'PARTNER_REMOVED' &&
      telefono(value.phone_number) !== propio
    )
      avisar();
    else
      operaciones.push({
        clase: 'cuenta',
        evento: value.event as
          | 'PARTNER_REMOVED'
          | 'ACCOUNT_OFFBOARDED'
          | 'ACCOUNT_RECONNECTED',
        fecha: evento.metaTimestamp,
        numero: telefono(value.phone_number),
      });
  } else avisar();
  return { operaciones, avisos };
}
