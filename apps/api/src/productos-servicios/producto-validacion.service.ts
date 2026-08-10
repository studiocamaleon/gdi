import { Injectable } from '@nestjs/common';
import { resolverFamilia } from './pasos/familias';
import { ProductosService } from './productos.service';
import {
  getConsumableChannelFromDetail,
  getPerfilConsumableChannels,
  PRINTER_TEMPLATES_WITH_MACHINE_CONSUMABLES,
} from '../maquinaria/consumibles-impresion';

@Injectable()
export class ProductoValidacionService {
  constructor(private readonly productos: ProductosService) {}

  async validarProducto(tenantId: string, productoId: string) {
    const producto = await this.productos.obtenerProducto(tenantId, productoId);
    const errores: Array<{
      severidad: 'ERROR' | 'WARNING';
      codigo: string;
      mensaje: string;
      ubicacion?: {
        rutaAltId?: string;
        rutaPasoId?: string;
        slotCodigo?: string;
      };
    }> = [];

    if (producto.rutasAlternativas.length === 0) {
      errores.push({
        severidad: 'ERROR',
        codigo: 'sin_rutas_alternativas',
        mensaje:
          'El producto no tiene ninguna ruta alternativa asociada. No se puede cotizar.',
      });
      return { exitoso: false, errores };
    }

    if (!producto.rutasAlternativas.some((r) => r.esPreferida)) {
      errores.push({
        severidad: 'WARNING',
        codigo: 'sin_ruta_preferida',
        mensaje:
          'No hay ruta preferida marcada. Se usará la primera por orden.',
      });
    }

    for (const ra of producto.rutasAlternativas) {
      const pasosRuta = ra.ruta.pasos;
      const configMap = new Map(
        ra.configPasos.map((cp) => [cp.rutaPasoId, cp]),
      );

      for (const paso of pasosRuta) {
        const familia = resolverFamilia(paso.familiaCodigo);
        if (!familia) {
          errores.push({
            severidad: 'ERROR',
            codigo: 'familia_desconocida',
            mensaje: `Paso ${paso.orden} usa familia desconocida "${paso.familiaCodigo}"`,
            ubicacion: { rutaAltId: ra.id, rutaPasoId: paso.id },
          });
          continue;
        }

        const config = configMap.get(paso.id);
        if (!config) {
          errores.push({
            severidad: 'ERROR',
            codigo: 'config_paso_faltante',
            mensaje: `Paso ${paso.orden} (${familia.nombre}) en ruta "${ra.nombre}" no tiene configuración`,
            ubicacion: { rutaAltId: ra.id, rutaPasoId: paso.id },
          });
          continue;
        }
        if (config.modoActivacion === 'NO_EJECUTAR') continue;

        // Paso tercerizado: lo compra un proveedor. No requiere máquina ni
        // material; sólo validamos que tenga una fuente de costo válida.
        if (config.tercerizado) {
          const fuentesOk = ['tarifa_magnitud', 'matriz', 'fijo', 'manual'];
          if (
            !config.fuenteCostoTercerizado ||
            !fuentesOk.includes(config.fuenteCostoTercerizado)
          ) {
            errores.push({
              severidad: 'ERROR',
              codigo: 'tercerizado_sin_fuente',
              mensaje: `Paso ${paso.orden} (${familia.nombre}): tercerizado sin fuente de costo válida (tarifa_magnitud | matriz | fijo | manual).`,
              ubicacion: { rutaAltId: ra.id, rutaPasoId: paso.id },
            });
          }
          continue;
        }

        const params =
          config.paramsPasoJson &&
          typeof config.paramsPasoJson === 'object' &&
          !Array.isArray(config.paramsPasoJson)
            ? (config.paramsPasoJson as Record<string, unknown>)
            : {};
        const modoColorConfig =
          params.modoColorConfig &&
          typeof params.modoColorConfig === 'object' &&
          !Array.isArray(params.modoColorConfig)
            ? (params.modoColorConfig as Record<string, unknown>)
            : {};
        const configConModoColor = config as typeof config & {
          modoColorOptions?: unknown[];
        };
        if (
          modoColorConfig.enabled === true &&
          modoColorConfig.comercialElige === true &&
          Array.isArray(configConModoColor.modoColorOptions) &&
          configConModoColor.modoColorOptions.length === 0
        ) {
          errores.push({
            severidad: 'ERROR',
            codigo: 'modo_color_sin_opciones',
            mensaje: `Paso ${paso.orden} (${familia.nombre}): modo de color comercial activo sin perfiles compatibles.`,
            ubicacion: { rutaAltId: ra.id, rutaPasoId: paso.id },
          });
        }

        if (
          familia.relacionMaquinaSoportada.includes('M-1') &&
          !familia.relacionMaquinaSoportada.includes('M-0') &&
          !config.maquinaM1Id
        ) {
          errores.push({
            severidad: 'ERROR',
            codigo: 'maquina_m1_faltante',
            mensaje: `Paso ${paso.orden} (${familia.nombre}) requiere máquina M-1 pero no tiene ninguna asignada`,
            ubicacion: { rutaAltId: ra.id, rutaPasoId: paso.id },
          });
        }

        if (
          familia.slotsRequeridos.some(
            (slot) => slot.tipo === 'CONSUMIBLE_MAQUINA',
          )
        ) {
          if (!config.maquinaM1) {
            errores.push({
              severidad: 'ERROR',
              codigo: 'consumibles_maquina_sin_maquina',
              mensaje: `Paso ${paso.orden} (${familia.nombre}) consume tinta/tóner automático, pero no tiene máquina asignada`,
              ubicacion: { rutaAltId: ra.id, rutaPasoId: paso.id },
            });
          } else if (
            PRINTER_TEMPLATES_WITH_MACHINE_CONSUMABLES.has(
              config.maquinaM1.plantilla,
            )
          ) {
            if (!config.perfilM1) {
              errores.push({
                severidad: 'ERROR',
                codigo: 'consumibles_maquina_sin_perfil',
                mensaje: `Paso ${paso.orden} (${familia.nombre}) necesita un perfil de máquina para resolver tinta/tóner`,
                ubicacion: { rutaAltId: ra.id, rutaPasoId: paso.id },
              });
            } else {
              const channels = getPerfilConsumableChannels(
                (config.perfilM1.detalleJson ?? {}) as Record<string, unknown>,
                (config.maquinaM1.parametrosTecnicosJson ?? {}) as Record<
                  string,
                  unknown
                >,
              );
              if (channels.length === 0) {
                errores.push({
                  severidad: 'ERROR',
                  codigo: 'consumibles_maquina_sin_canales',
                  mensaje: `Paso ${paso.orden} (${familia.nombre}): el perfil de máquina no declara canales de color`,
                  ubicacion: { rutaAltId: ra.id, rutaPasoId: paso.id },
                });
              }
              for (const channel of channels) {
                const consumible = config.maquinaM1.consumibles.find(
                  (item) =>
                    item.perfilOperativoId === config.perfilM1?.id &&
                    getConsumableChannelFromDetail(
                      (item.detalleJson ?? {}) as Record<string, unknown>,
                    ) === channel,
                );
                if (
                  !consumible ||
                  Number(consumible.consumoBase ?? 0) <= 0 ||
                  !consumible.materiaPrimaVariante?.precioReferencia
                ) {
                  errores.push({
                    severidad: 'ERROR',
                    codigo: 'consumible_maquina_incompleto',
                    mensaje: `Paso ${paso.orden} (${familia.nombre}): falta configurar el consumible ${channel} en Maquinaria para ${config.maquinaM1.nombre}`,
                    ubicacion: { rutaAltId: ra.id, rutaPasoId: paso.id },
                  });
                }
              }
            }
          }
        }

        for (const slotDecl of familia.slotsRequeridos) {
          if (!slotDecl.requerido) continue;
          if (slotDecl.tipo === 'CONSUMIBLE_MAQUINA') continue;
          const slotConfig = config.slotsMateriales.find(
            (s) => s.slotCodigo === slotDecl.codigo,
          );
          if (!slotConfig) {
            errores.push({
              severidad: 'ERROR',
              codigo: 'slot_requerido_sin_config',
              mensaje: `Paso ${paso.orden} (${familia.nombre}): slot requerido "${slotDecl.nombre}" sin configuración`,
              ubicacion: {
                rutaAltId: ra.id,
                rutaPasoId: paso.id,
                slotCodigo: slotDecl.codigo,
              },
            });
            continue;
          }
          if (
            slotConfig.modoSeleccion === 'HARDCODED' &&
            !slotConfig.materialVariante
          ) {
            errores.push({
              severidad: 'ERROR',
              codigo: 'slot_hardcoded_sin_material',
              mensaje: `Paso ${paso.orden}: slot "${slotDecl.nombre}" en modo HARDCODED sin material asignado`,
              ubicacion: {
                rutaAltId: ra.id,
                rutaPasoId: paso.id,
                slotCodigo: slotDecl.codigo,
              },
            });
          }
          if (
            (slotConfig.modoSeleccion === 'COMERCIAL_ELIGE' ||
              slotConfig.modoSeleccion === 'MOTOR_ELIGE_AUTO') &&
            slotConfig.candidatos.length === 0
          ) {
            errores.push({
              severidad: 'ERROR',
              codigo: 'slot_sin_candidatos',
              mensaje: `Paso ${paso.orden}: slot "${slotDecl.nombre}" en modo ${slotConfig.modoSeleccion} sin candidatos definidos`,
              ubicacion: {
                rutaAltId: ra.id,
                rutaPasoId: paso.id,
                slotCodigo: slotDecl.codigo,
              },
            });
          }
        }

        if (familia.modosTiempoSoportados.length === 1 && !config.modoTiempo) {
          errores.push({
            severidad: 'WARNING',
            codigo: 'modo_tiempo_faltante',
            mensaje: `Paso ${paso.orden}: modo de tiempo no especificado (default: ${familia.modosTiempoSoportados[0]})`,
            ubicacion: { rutaAltId: ra.id, rutaPasoId: paso.id },
          });
        }
      }
    }

    const tieneErrores = errores.some((e) => e.severidad === 'ERROR');
    return {
      exitoso: !tieneErrores,
      errores,
    };
  }
}
