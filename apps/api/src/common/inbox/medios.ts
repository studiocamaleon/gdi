/** Lista oficial de medios de WhatsApp. Compartida por selector y servidor. */
export type TipoMedioInbox =
  | 'image'
  | 'audio'
  | 'video'
  | 'document'
  | 'sticker';
export const FORMATOS_INBOX: Record<
  string,
  { tipo: TipoMedioInbox; ext: string; max: number }
> = {};
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
  for (const [mime, ext] of lista) FORMATOS_INBOX[mime] = { tipo, ext, max };
export const ACCEPT_INBOX = [
  ...Object.keys(FORMATOS_INBOX),
  ...Object.values(FORMATOS_INBOX).map((f) => `.${f.ext}`),
  '.jpeg',
  '.opus',
].join(',');
export function formatoArchivoInbox(nombre: string, mimeDeclarado: string) {
  const ext = nombre.split('.').at(-1)?.toLowerCase();
  const mime = Object.entries(FORMATOS_INBOX).find(
    ([, f]) =>
      f.ext === ext ||
      (ext === 'jpeg' && f.ext === 'jpg') ||
      (ext === 'opus' && f.ext === 'ogg'),
  )?.[0];
  if (!mime) return null;
  const raw = mimeDeclarado.split(';')[0].trim().toLowerCase();
  const declarado =
    (
      {
        'audio/x-m4a': 'audio/mp4',
        'audio/m4a': 'audio/mp4',
        'audio/mp3': 'audio/mpeg',
        'audio/x-mp3': 'audio/mpeg',
        'audio/x-aac': 'audio/aac',
        'image/pjpeg': 'image/jpeg',
      } as Record<string, string>
    )[raw] ?? raw;
  // Algunos sistemas no informan MIME. La verificación real ocurre al preparar el envío.
  if (
    declarado &&
    declarado !== 'application/octet-stream' &&
    declarado !== mime
  )
    return null;
  return { mime, ...FORMATOS_INBOX[mime] };
}
