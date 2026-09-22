import { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { PresupuestoPdfDatos } from '../presupuesto-pdf.service';
import { VERSION_PRESUPUESTO_HTML } from './presupuesto-html';
import {
  pilotoPdfHabilitado,
  PresupuestoRenderService,
} from './presupuesto-render.service';

const TTL_MS = 5 * 60_000;
const MAX_BYTES = 32 * 1024 * 1024;
const MAX_ENTRIES = 16;

/** Caché acotado del piloto, separado de los PDF emitidos y del almacenamiento. */
@Injectable()
export class PresupuestoPilotoService {
  private readonly cache = new Map<string, { pdf: Buffer; expira: number }>();
  private readonly pendientes = new Map<string, Promise<Buffer>>();
  private bytes = 0;

  constructor(
    private readonly renderer: PresupuestoRenderService,
    private readonly capacidades: CapacidadesEmpresaService,
  ) {}

  async generar(
    tenantId: string,
    id: string,
    datos: PresupuestoPdfDatos,
  ): Promise<Buffer> {
    if (!pilotoPdfHabilitado())
      throw new NotFoundException('PDF piloto no habilitado.');
    await this.capacidades.exigir(tenantId, 'documentos_pdf');
    const json = JSON.stringify(datos);
    if (datos.items.length > 500 || Buffer.byteLength(json) > 4 * 1024 * 1024) {
      throw new BadRequestException(
        'El presupuesto supera el límite de esta prueba piloto.',
      );
    }
    const hash = createHash('sha256')
      .update(JSON.stringify([tenantId, id, VERSION_PRESUPUESTO_HTML, json]))
      .digest('hex');
    for (const [key, item] of this.cache)
      if (item.expira <= Date.now()) this.quitar(key);
    const guardado = this.cache.get(hash);
    if (guardado) return guardado.pdf;
    const pendiente = this.pendientes.get(hash);
    if (pendiente) return pendiente;
    // Límite por proceso para no acumular documentos en RAM esperando al render.
    if (this.pendientes.size >= 8)
      throw new ServiceUnavailableException(
        'El generador está ocupado. Probá de nuevo en unos instantes.',
      );
    const promesa = this.renderer
      .generar(datos)
      .then((pdf) => {
        if (pdf.length <= MAX_BYTES) {
          while (
            this.cache.size &&
            (this.cache.size >= MAX_ENTRIES ||
              this.bytes + pdf.length > MAX_BYTES)
          ) {
            const antiguo = this.cache.keys().next();
            if (antiguo.done) break;
            this.quitar(antiguo.value);
          }
          this.cache.set(hash, { pdf, expira: Date.now() + TTL_MS });
          this.bytes += pdf.length;
        }
        return pdf;
      })
      .finally(() => this.pendientes.delete(hash));
    this.pendientes.set(hash, promesa);
    return promesa;
  }

  private quitar(key: string) {
    this.bytes -= this.cache.get(key)?.pdf.length ?? 0;
    this.cache.delete(key);
  }
}
