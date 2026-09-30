import { BadRequestException } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { firmaValida } from './meta-media.client';
import { FORMATOS_INBOX } from '../../../common/inbox/medios';
import { entornoProcesoNativo } from '../../../common/entorno-proceso-nativo';
const ejecutar = promisify(execFile);
const formatos: Record<string, string> = {
  'audio/webm': 'matroska',
  'audio/ogg': 'ogg',
  'audio/mp4': 'mov',
  'video/mp4': 'mov',
  'video/3gpp': 'mov',
  'audio/mpeg': 'mp3',
  'audio/aac': 'aac',
  'audio/amr': 'amr',
};
const bin = (nombre: 'ffmpeg' | 'ffprobe') =>
  process.env[
    nombre === 'ffmpeg' ? 'INBOX_FFMPEG_PATH' : 'INBOX_FFPROBE_PATH'
  ] || nombre;
type Sonda = {
  streams: Array<{
    codec_type: string;
    codec_name: string;
    channels?: number;
    width?: number;
    height?: number;
  }>;
  format: { duration?: string };
};
async function sondear(path: string, formato: string): Promise<Sonda> {
  const { stdout } = await ejecutar(
    bin('ffprobe'),
    [
      '-v',
      'error',
      '-protocol_whitelist',
      'file,pipe',
      '-f',
      formato,
      '-i',
      path,
      '-show_entries',
      'stream=codec_type,codec_name,channels,width,height:format=duration',
      '-of',
      'json',
    ],
    {
      timeout: 10000,
      killSignal: 'SIGKILL',
      maxBuffer: 65536,
      env: entornoProcesoNativo(),
    },
  );
  return JSON.parse(stdout) as Sonda;
}
/** Sin shell, sin URLs, con tamaño, tiempo, hilos y salida acotados. */
export async function prepararMedioInbox(
  bytes: Buffer,
  mime: string,
  voz = false,
) {
  if (
    !bytes.length ||
    bytes.length > (voz ? 16_000_000 : (FORMATOS_INBOX[mime]?.max ?? 0))
  )
    throw new BadRequestException('El archivo supera el límite de WhatsApp.');
  if (!voz && !firmaValida(bytes, mime))
    throw new BadRequestException(
      'El contenido no corresponde al formato del archivo.',
    );
  if (mime.startsWith('image/')) {
    const m = await sharp(bytes, {
      limitInputPixels: 40_000_000,
      animated: true,
    }).metadata();
    if (mime === 'image/webp') {
      if (
        m.format !== 'webp' ||
        m.width !== 512 ||
        (m.pageHeight ?? m.height) !== 512 ||
        bytes.length > ((m.pages ?? 1) > 1 ? 500_000 : 100_000)
      )
        throw new BadRequestException(
          'El sticker debe ser WebP de 512 × 512: hasta 100 KB estático o 500 KB animado.',
        );
    } else if (
      !['srgb', 'rgb'].includes(m.space ?? '') ||
      m.depth !== 'uchar' ||
      m.format !== (mime === 'image/png' ? 'png' : 'jpeg')
    )
      throw new BadRequestException(
        'La imagen debe ser JPG o PNG RGB de 8 bits.',
      );
  }
  if (!voz && !formatos[mime]) return { bytes, mime };
  if (!formatos[mime])
    throw new BadRequestException('El formato de grabación no es compatible.');
  const dir = await mkdtemp(join(tmpdir(), 'grafo-inbox-'));
  try {
    const entrada = join(dir, 'entrada');
    await writeFile(entrada, bytes, { mode: 0o600 });
    const s = await sondear(entrada, formatos[mime]);
    const audios = s.streams.filter((x) => x.codec_type === 'audio'),
      videos = s.streams.filter((x) => x.codec_type === 'video');
    if (voz) {
      if (
        audios.length !== 1 ||
        videos.length ||
        Number(s.format.duration) > 300
      )
        throw new BadRequestException(
          'La nota de voz debe durar como máximo 5 minutos.',
        );
      const salida = join(dir, 'nota.ogg');
      await ejecutar(
        bin('ffmpeg'),
        [
          '-nostdin',
          '-hide_banner',
          '-loglevel',
          'error',
          '-protocol_whitelist',
          'file,pipe',
          '-threads',
          '1',
          '-f',
          formatos[mime],
          '-i',
          entrada,
          '-map',
          '0:a:0',
          '-map_metadata',
          '-1',
          '-vn',
          '-t',
          '301',
          '-ac',
          '1',
          '-ar',
          '48000',
          '-c:a',
          'libopus',
          '-b:a',
          '32k',
          '-threads',
          '1',
          '-f',
          'ogg',
          salida,
        ],
        {
          timeout: 30000,
          killSignal: 'SIGKILL',
          maxBuffer: 65536,
          env: entornoProcesoNativo(),
        },
      );
      const convertido = await readFile(salida),
        fin = await sondear(salida, 'ogg');
      if (
        !Number.isFinite(Number(fin.format.duration)) ||
        Number(fin.format.duration) > 300 ||
        convertido.length > 16_000_000 ||
        fin.streams[0]?.codec_name !== 'opus' ||
        fin.streams[0]?.channels !== 1
      )
        throw new BadRequestException('No se pudo preparar la nota de voz.');
      return { bytes: convertido, mime: 'audio/ogg' };
    }
    if (mime.startsWith('video/')) {
      if (
        videos.length !== 1 ||
        videos[0].codec_name !== 'h264' ||
        audios.length > 1 ||
        audios.some((a) => a.codec_name !== 'aac')
      )
        throw new BadRequestException(
          'El video necesita H.264 y audio AAC (o sin audio).',
        );
    } else if (
      videos.length ||
      audios.length !== 1 ||
      (mime === 'audio/ogg' &&
        (audios[0].codec_name !== 'opus' || audios[0].channels !== 1))
    )
      throw new BadRequestException(
        'OGG necesita Opus mono; el archivo debe contener un único audio.',
      );
    return { bytes, mime };
  } catch (e) {
    if (e instanceof BadRequestException) throw e;
    throw new BadRequestException(
      'No pudimos validar o convertir el archivo. Revisá su formato.',
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
