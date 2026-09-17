import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PresupuestoPdfDatos } from '../presupuesto-pdf.service';
import { presupuestoFooter, presupuestoHtml } from './presupuesto-html';

export function pilotoPdfHabilitado(): boolean {
  return (
    process.env.PRESUPUESTO_PDF_PILOTO === 'true' &&
    Boolean(process.env.PDF_RENDER_URL?.trim())
  );
}

/** Adaptador de render reutilizable desde un worker. No carga Chromium en Nest. */
@Injectable()
export class PresupuestoRenderService {
  private fuentes?: Promise<Array<{ nombre: string; contenido: Buffer }>>;

  async generar(d: PresupuestoPdfDatos): Promise<Buffer> {
    const base = process.env.PDF_RENDER_URL?.trim();
    if (!base)
      throw new ServiceUnavailableException(
        'El generador de PDF no está configurado.',
      );
    const form = new FormData();
    form.append(
      'files',
      new Blob([presupuestoHtml(d)], { type: 'text/html' }),
      'index.html',
    );
    form.append(
      'files',
      new Blob([presupuestoFooter(d)], { type: 'text/html' }),
      'footer.html',
    );
    for (const fuente of await this.cargarFuentes()) {
      form.append(
        'files',
        new Blob([new Uint8Array(fuente.contenido)], { type: 'font/ttf' }),
        fuente.nombre,
      );
    }
    form.append('printBackground', 'true');
    form.append('preferCssPageSize', 'true');
    form.append('marginTop', '0.5118');
    form.append('marginBottom', '0.7087');
    form.append('marginLeft', '0.5906');
    form.append('marginRight', '0.5906');
    form.append('failOnResourceLoadingFailed', 'true');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 35_000);
    try {
      const response = await fetch(
        `${base.replace(/\/$/, '')}/forms/chromium/convert/html`,
        {
          method: 'POST',
          body: form,
          signal: controller.signal,
        },
      );
      if (
        !response.ok ||
        !response.headers.get('content-type')?.includes('application/pdf') ||
        !response.body
      ) {
        await response.body?.cancel();
        throw new Error(`Render HTTP ${response.status}`);
      }
      const partes: Uint8Array[] = [];
      let bytes = 0;
      for await (const parte of response.body) {
        bytes += parte.byteLength;
        if (bytes > 16 * 1024 * 1024)
          throw new Error('PDF excede el tamaño permitido');
        partes.push(parte);
      }
      const pdf = Buffer.concat(partes);
      if (pdf.subarray(0, 5).toString() !== '%PDF-')
        throw new Error('Respuesta inválida del render');
      return pdf;
    } catch {
      controller.abort();
      throw new ServiceUnavailableException(
        'No se pudo generar el PDF. Intentá nuevamente en unos instantes.',
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private cargarFuentes() {
    this.fuentes ??= Promise.all(
      ['Geist-Regular.ttf', 'Geist-Bold.ttf'].map(async (nombre) => ({
        nombre,
        contenido: await readFile(
          join(
            __dirname,
            '..',
            '..',
            'administracion',
            'invoicing',
            'fonts',
            nombre,
          ),
        ),
      })),
    ).catch((error: unknown) => {
      this.fuentes = undefined;
      throw error;
    });
    return this.fuentes;
  }
}
