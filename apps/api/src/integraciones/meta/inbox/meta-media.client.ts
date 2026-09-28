import { Injectable } from '@nestjs/common';
import { createHash, createHmac } from 'node:crypto';
import { objeto } from './meta-inbox-normalizar';

export class ErrorMediaMeta extends Error {
  constructor(
    readonly codigo:
      | 'NO_DISPONIBLE'
      | 'TEMPORAL'
      | 'FORMATO'
      | 'INTEGRIDAD'
      | 'DESTINO'
      | 'LIMITE',
  ) {
    super(codigo);
  }
}
const formatos: Record<string, { tipo: string; ext: string; max: number }> = {};
for (const [tipo, max, lista] of [
  [
    'image',
    5_000_000,
    [
      ['image/jpeg', 'jpg'],
      ['image/png', 'png'],
    ],
  ],
  ['sticker', 500_000, [['image/webp', 'webp']]],
  [
    'audio',
    16_000_000,
    [
      ['audio/aac', 'aac'],
      ['audio/amr', 'amr'],
      ['audio/mpeg', 'mp3'],
      ['audio/mp4', 'm4a'],
      ['audio/ogg', 'ogg'],
    ],
  ],
  [
    'video',
    16_000_000,
    [
      ['video/mp4', 'mp4'],
      ['video/3gpp', '3gp'],
    ],
  ],
  [
    'document',
    100_000_000,
    [
      ['application/pdf', 'pdf'],
      ['text/plain', 'txt'],
      ['application/msword', 'doc'],
      ['application/vnd.ms-excel', 'xls'],
      ['application/vnd.ms-powerpoint', 'ppt'],
      [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'docx',
      ],
      [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'xlsx',
      ],
      [
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'pptx',
      ],
    ],
  ],
] as const)
  for (const [mime, ext] of lista) formatos[mime] = { tipo, ext, max };
export const mimeBase = (s: string) => s.split(';')[0].trim().toLowerCase();
export function hashMedia(s: unknown): string | null {
  if (typeof s !== 'string') return null;
  if (/^[a-f\d]{64}$/i.test(s)) return s.toLowerCase();
  if (/^[A-Za-z\d+/]{43}=$/.test(s))
    return Buffer.from(s, 'base64').toString('hex');
  return null;
}
export function nombreMedia(nombre: unknown, ext: string) {
  const limpio =
    typeof nombre === 'string'
      ? nombre
          .normalize('NFKC')
          .replace(/[\p{Cc}/\\<>:"|?*\u202a-\u202e\u2066-\u2069]/gu, '_')
          .replace(/\.[^.]*$/, '')
          .trim()
          .slice(0, 100)
      : '';
  return `${limpio || 'Adjunto'}.${ext}`;
}
function destino(url: string): URL {
  const u = new URL(url);
  if (
    u.protocol !== 'https:' ||
    u.hostname !== 'lookaside.fbsbx.com' ||
    u.port ||
    u.username ||
    u.password ||
    !u.pathname.startsWith('/whatsapp_business/attachments')
  )
    throw new ErrorMediaMeta('DESTINO');
  return u;
}
function firmaValida(b: Buffer, mime: string) {
  const hex = b.subarray(0, 12).toString('hex');
  const text = b.subarray(0, 12).toString('ascii');
  if (mime === 'image/png') return hex.startsWith('89504e470d0a1a0a');
  if (mime === 'image/jpeg') return hex.startsWith('ffd8ff');
  if (mime === 'image/webp')
    return text.startsWith('RIFF') && text.slice(8) === 'WEBP';
  if (mime === 'application/pdf') return text.startsWith('%PDF-');
  if (mime === 'audio/ogg') return text.startsWith('OggS');
  if (mime === 'audio/amr') return text.startsWith('#!AMR');
  if (mime === 'audio/mpeg')
    return text.startsWith('ID3') || (b[0] === 255 && (b[1] & 0xe0) === 0xe0);
  if (mime === 'audio/aac') return b[0] === 255 && (b[1] & 0xf6) === 0xf0;
  if (['video/mp4', 'audio/mp4', 'video/3gpp'].includes(mime))
    return text.slice(4, 8) === 'ftyp';
  if (mime.includes('openxmlformats')) return hex.startsWith('504b0304');
  if (
    [
      'application/msword',
      'application/vnd.ms-excel',
      'application/vnd.ms-powerpoint',
    ].includes(mime)
  )
    return hex.startsWith('d0cf11e0a1b11ae1');
  return mime === 'text/plain'; // Siempre descarga, nunca HTML inline.
}
export type MediaMeta = {
  url: string;
  mime: string;
  bytes: number;
  hash: string;
  ext: string;
};
@Injectable()
export class MetaMediaClient {
  async metadata(p: {
    mediaId: string;
    phoneNumberId: string;
    token: string;
    appSecret: string;
    version: string;
    tipo: string;
    sha256?: unknown;
  }): Promise<MediaMeta> {
    try {
      if (
        !/^\d{1,32}$/.test(p.mediaId) ||
        !/^\d{1,32}$/.test(p.phoneNumberId) ||
        !/^v\d+\.0$/.test(p.version) ||
        !p.token ||
        !p.appSecret
      )
        throw new ErrorMediaMeta('FORMATO');
      const url = new URL(
        `https://graph.facebook.com/${p.version}/${p.mediaId}`,
      );
      url.searchParams.set('phone_number_id', p.phoneNumberId);
      url.searchParams.set(
        'appsecret_proof',
        createHmac('sha256', p.appSecret).update(p.token).digest('hex'),
      );
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${p.token}` },
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) {
        await res.body?.cancel();
        throw new ErrorMediaMeta(
          res.status === 404 || res.status === 400
            ? 'NO_DISPONIBLE'
            : 'TEMPORAL',
        );
      }
      // Limitar también la respuesta JSON de Graph, no sólo los binarios.
      const reader = res.body?.getReader();
      if (!reader) throw new ErrorMediaMeta('TEMPORAL');
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.length;
          if (size > 16384) throw new ErrorMediaMeta('FORMATO');
          chunks.push(part.value);
        }
      } finally {
        await reader.cancel();
      }
      const data = objeto(JSON.parse(Buffer.concat(chunks).toString()));
      const mime =
        typeof data.mime_type === 'string' ? mimeBase(data.mime_type) : '';
      const f = formatos[mime],
        bytes = Number(data.file_size),
        hash = hashMedia(data.sha256);
      // WhatsApp puede entregar una imagen, audio o video como documento
      // cuando el remitente lo adjunta como archivo. El MIME de Graph define
      // su extensión, límite y firma; la categoría del mensaje no los cambia.
      const tipoCompatible =
        f &&
        (f.tipo === p.tipo ||
          (p.tipo === 'document' &&
            ['image', 'audio', 'video'].includes(f.tipo)));
      if (
        data.id !== p.mediaId ||
        !f ||
        !tipoCompatible ||
        !hash ||
        typeof data.url !== 'string'
      )
        throw new ErrorMediaMeta('FORMATO');
      if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > f.max)
        throw new ErrorMediaMeta('LIMITE');
      if (p.sha256 && hashMedia(p.sha256) !== hash)
        throw new ErrorMediaMeta('INTEGRIDAD');
      destino(data.url);
      return { url: data.url, mime, bytes, hash, ext: f.ext };
    } catch (e) {
      if (e instanceof ErrorMediaMeta) throw e;
      throw new ErrorMediaMeta('TEMPORAL');
    }
  }
  async descargar(meta: MediaMeta, token: string): Promise<Buffer> {
    try {
      const url = destino(meta.url);
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.timeout(60000),
      });
      if (!res.ok) {
        await res.body?.cancel();
        throw new ErrorMediaMeta('TEMPORAL');
      }
      const length = res.headers.get('content-length');
      if (
        (length !== null && Number(length) !== meta.bytes) ||
        mimeBase(res.headers.get('content-type') ?? '') !== meta.mime
      ) {
        await res.body?.cancel();
        throw new ErrorMediaMeta('INTEGRIDAD');
      }
      const reader = res.body?.getReader();
      if (!reader) throw new ErrorMediaMeta('TEMPORAL');
      const output = Buffer.alloc(meta.bytes);
      let offset = 0;
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          if (offset + part.value.length > meta.bytes)
            throw new ErrorMediaMeta('LIMITE');
          output.set(part.value, offset);
          offset += part.value.length;
        }
      } finally {
        await reader.cancel();
      }
      if (
        offset !== meta.bytes ||
        createHash('sha256').update(output).digest('hex') !== meta.hash ||
        !firmaValida(output, meta.mime)
      )
        throw new ErrorMediaMeta('INTEGRIDAD');
      return output;
    } catch (e) {
      if (e instanceof ErrorMediaMeta) throw e;
      throw new ErrorMediaMeta('TEMPORAL');
    }
  }
}
