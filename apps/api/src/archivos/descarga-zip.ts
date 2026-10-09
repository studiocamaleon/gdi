import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Readable } from 'node:stream';
import { Zip, ZipPassThrough } from 'fflate';
import type { StorageDriver } from './storage/storage.driver';

export type EntradaZip = { key: string; nombre: string; bytes: number };
// ZIP32: margen para directorio y cabeceras, sin cargar los archivos en RAM.
export const MAX_ZIP_BYTES = 2 * 1024 ** 3;
export function nombreSeguroZip(nombre: string): string {
  return (
    nombre
      .normalize('NFC')
      .replace(/[\\/\x00-\x1f\x7f:*?"<>|]/g, '_')
      .replace(/\.{2,}/g, '_')
      .replace(/[. ]+$/g, '')
      .slice(0, 120) || 'archivo'
  );
}
export function validarPaqueteZip(entradas: EntradaZip[]) {
  if (!entradas.length)
    throw new NotFoundException('No hay archivos disponibles para descargar.');
  if (
    entradas.length > 500 ||
    entradas.reduce((n, e) => n + e.bytes, 0) > MAX_ZIP_BYTES
  )
    throw new BadRequestException(
      'La descarga conjunta admite hasta 500 archivos y 2 GB. Descargá los archivos por separado.',
    );
}

/** Secuencial y con backpressure. Un fallo aborta la descarga: nunca omite un archivo. */
export function crearZipStream(
  entradas: EntradaZip[],
  storage: Pick<StorageDriver, 'abrirLectura'>,
): Readable {
  validarPaqueteZip(entradas);
  async function* generar() {
    const salida: Uint8Array[] = [];
    let errorZip: Error | null = null;
    let fuente: Readable | null = null;
    let total = 0;
    const zip = new Zip((error, chunk) => {
      if (error) errorZip = error;
      else salida.push(chunk);
    });
    try {
      for (const entrada of entradas) {
        fuente = await storage.abrirLectura(entrada.key);
        if (!fuente)
          throw new Error(
            'Un archivo ya no está disponible. Volvé a cargar la lista.',
          );
        const archivo = new ZipPassThrough(entrada.nombre);
        zip.add(archivo);
        let bytes = 0;
        for await (const bloque of fuente) {
          const chunk = Buffer.isBuffer(bloque) ? bloque : Buffer.from(bloque);
          bytes += chunk.length;
          total += chunk.length;
          if (total > MAX_ZIP_BYTES || bytes > entrada.bytes)
            throw new Error(
              'El tamaño del archivo cambió. Volvé a intentar la descarga.',
            );
          archivo.push(chunk, false);
          if (errorZip) throw errorZip;
          while (salida.length) yield salida.shift()!;
        }
        if (bytes !== entrada.bytes)
          throw new Error('No se recibió el archivo completo.');
        archivo.push(new Uint8Array(), true);
        if (errorZip) throw errorZip;
        while (salida.length) yield salida.shift()!;
        fuente = null;
      }
      zip.end();
      if (errorZip) throw errorZip;
      while (salida.length) yield salida.shift()!;
    } finally {
      fuente?.destroy();
      zip.terminate();
    }
  }
  return Readable.from(generar(), {
    objectMode: false,
    highWaterMark: 64 * 1024,
  });
}
