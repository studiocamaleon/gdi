import { Injectable } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { LoopbackService, LoopbackError } from './loopback.service';
import {
  armarJobContext,
  RespuestasInvalidasError,
  type FormularioParaJobContext,
} from './armar-jobcontext';

/**
 * Construye el servidor MCP con las 4 tools de F1, ligadas al Bearer del
 * request. Las descripciones son EL prompt que gobierna cuándo la IA usa cada
 * tool: prescriptivas sobre el cuándo, no sólo el qué.
 *
 * Regla de oro: toda tool va por loopback HTTP (LoopbackService) — nunca
 * services directos. Y lo que devuelve `cotizar` es una PROYECCIÓN whitelist:
 * jamás costos, tarifas ni márgenes (doble cinturón sobre la poda del API).
 */
@Injectable()
export class McpServerFactory {
  constructor(private readonly loopback: LoopbackService) {}

  crear(token: string): McpServer {
    const server = new McpServer({
      name: 'grafo-cotizador',
      version: '1.0.0',
    });

    const texto = (data: unknown) => ({
      content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
    });
    const error = (mensaje: string) => ({
      content: [{ type: 'text' as const, text: mensaje }],
      isError: true,
    });
    const conManejo =
      <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
      async (...args: A) => {
        try {
          return await fn(...args);
        } catch (e) {
          if (e instanceof RespuestasInvalidasError) return error(e.message);
          if (e instanceof LoopbackError) {
            if (e.status === 429) {
              return error(
                'Límite de consultas alcanzado: esperá un minuto y reintentá.',
              );
            }
            return error(`Grafo respondió ${e.status}: ${e.message}`);
          }
          throw e;
        }
      };

    server.registerTool(
      'buscar_productos',
      {
        title: 'Buscar productos del catálogo',
        description:
          'Busca productos cotizables en el catálogo de la imprenta por nombre o ' +
          'código. Llamala SIEMPRE antes de cotizar para obtener el productoId. ' +
          'Si no hay resultados, reformulá con menos palabras (busca por nombre ' +
          'y código, no por descripción).',
        inputSchema: {
          consulta: z.string().min(1).describe('Texto a buscar, ej: "banner"'),
          pagina: z.number().int().min(1).optional(),
        },
      },
      conManejo(async ({ consulta, pagina }) => {
        const res = await this.loopback.llamar<{
          data: Array<Record<string, unknown>>;
          total: number;
          pages: number;
        }>(
          token,
          'GET',
          `/productos-servicios/productos?search=${encodeURIComponent(consulta)}` +
            `&limit=10&page=${pagina ?? 1}&activo=true`,
        );
        return texto({
          total: res.total,
          paginas: res.pages,
          productos: res.data.map((p) => ({
            productoId: p.id,
            codigo: p.codigo,
            nombre: p.nombre,
            descripcion: p.descripcion,
            unidadComercial: p.unidadComercial,
            categoria:
              (p.subcategoriaComercial as { categoria?: { nombre?: string } } | null)
                ?.categoria?.nombre ?? null,
          })),
        });
      }),
    );

    server.registerTool(
      'formulario_cotizacion',
      {
        title: 'Preguntas para cotizar un producto',
        description:
          'Devuelve QUÉ hay que preguntar para cotizar un producto: medidas, ' +
          'materiales a elegir (con opciones), parámetros, adicionales y ' +
          'multiplicadores, cada uno con su clave de respuesta. Llamala SIEMPRE ' +
          'antes de la primera cotización de un producto en la conversación; ' +
          'después preguntale al usuario sólo lo que falte.',
        inputSchema: {
          productoId: z.string().uuid(),
          rutaAlternativaId: z.string().uuid().optional()
            .describe('Sólo si el producto tiene más de una vía de producción'),
        },
      },
      conManejo(async ({ productoId, rutaAlternativaId }) => {
        const query = rutaAlternativaId
          ? `?rutaAlternativaId=${rutaAlternativaId}`
          : '';
        const form = await this.loopback.llamar(
          token,
          'GET',
          `/productos-servicios/productos/${productoId}/formulario-cotizacion${query}`,
        );
        return texto(form);
      }),
    );

    server.registerTool(
      'cotizar',
      {
        title: 'Cotizar un producto',
        description:
          'Calcula el precio real de un producto con el motor de la imprenta. ' +
          'No persiste nada: se puede llamar las veces que haga falta. Requiere ' +
          'haber llamado antes a formulario_cotizacion: `respuestas` se arma con ' +
          'las claves (`jobContextKey`) que declaró el formulario. Las medidas ' +
          'van SIEMPRE en milímetros. IMPORTANTE: un trabajo con VARIAS medidas ' +
          'del mismo material (vinilos, ploteos, lonas) va en UNA sola llamada ' +
          'usando `piezas` — el motor las consolida en el mismo material y ' +
          'acomodo, igual que el sistema. Cotizarlas como llamadas separadas ' +
          'paga un setup y un mínimo POR MEDIDA y da un precio MÁS CARO que el ' +
          'real. Si falla, el error dice exactamente qué falta o qué corregir.',
        inputSchema: {
          productoId: z.string().uuid(),
          rutaAlternativaId: z.string().uuid().optional(),
          cantidad: z.number().int().min(1).optional()
            .describe('Cantidad del trabajo. Con `piezas` se ignora: manda la suma.'),
          anchoMm: z.number().positive().optional()
            .describe('Ancho en mm (productos con medida libre, UNA sola medida)'),
          altoMm: z.number().positive().optional(),
          piezas: z
            .preprocess(
              // Tolerancia a clientes con el schema viejo cacheado (o modelos
              // que serializan): el array puede llegar como string JSON.
              (valor) => {
                if (typeof valor !== 'string') return valor;
                try {
                  return JSON.parse(valor);
                } catch {
                  return valor;
                }
              },
              z
                .array(
                  z.object({
                    cantidad: z.number().int().min(1),
                    anchoMm: z.number().positive(),
                    altoMm: z.number().positive(),
                  }),
                )
                .min(1),
            )
            .optional()
            .describe(
              'Varias medidas de UN MISMO trabajo (mm). Usar SIEMPRE que el pedido tenga más de una medida del mismo producto: se cotizan consolidadas.',
            ),
          medidaPredefinidaId: z.string().optional()
            .describe('ID de una medida predefinida del formulario'),
          respuestas: z.record(z.string(), z.unknown()).optional()
            .describe('Mapa jobContextKey → valor, según el formulario'),
          adicionales: z.array(z.string()).optional()
            .describe('IDs de adicionales a activar'),
          clienteId: z.string().uuid().optional()
            .describe('Para aplicar precios especiales del cliente'),
          descuento: z
            .object({
              tipo: z.enum(['PORCENTAJE', 'MONTO']),
              valor: z.number().min(0),
            })
            .optional(),
        },
      },
      conManejo(async (input) => {
        const query = input.rutaAlternativaId
          ? `?rutaAlternativaId=${input.rutaAlternativaId}`
          : '';
        const formulario = await this.loopback.llamar<FormularioParaJobContext>(
          token,
          'GET',
          `/productos-servicios/productos/${input.productoId}/formulario-cotizacion${query}`,
        );
        const jobContext = armarJobContext(formulario, input);
        const resultado = await this.loopback.llamar<Record<string, unknown>>(
          token,
          'POST',
          '/motor-universal/cotizar',
          {
            productoId: input.productoId,
            rutaAlternativaId: input.rutaAlternativaId ?? null,
            jobContext,
            clienteId: input.clienteId ?? null,
            descuento: input.descuento,
          },
        );
        return texto(proyectarCotizacion(resultado));
      }),
    );

    server.registerTool(
      'buscar_cliente',
      {
        title: 'Buscar un cliente',
        description:
          'Busca un cliente de la imprenta por nombre/razón social/email, o por ' +
          'número de documento (DNI). Usala cuando el usuario nombre a un ' +
          'cliente, para cotizar con sus precios especiales (clienteId).',
        inputSchema: {
          consulta: z.string().optional()
            .describe('Nombre, razón social o email'),
          documento: z.string().optional()
            .describe('DNI, sólo dígitos (7 a 9)'),
        },
      },
      conManejo(async ({ consulta, documento }) => {
        if (documento?.trim()) {
          const res = await this.loopback.llamar<{
            cliente: Record<string, unknown> | null;
          }>(
            token,
            'GET',
            `/clientes/por-documento/${encodeURIComponent(documento.trim())}`,
          );
          return texto({
            clientes: res.cliente ? [proyectarCliente(res.cliente)] : [],
          });
        }
        if (!consulta?.trim()) {
          return error('Mandá `consulta` (nombre/email) o `documento` (DNI).');
        }
        const res = await this.loopback.llamar<{
          data: Array<Record<string, unknown>>;
        }>(
          token,
          'GET',
          `/clientes?q=${encodeURIComponent(consulta.trim())}&limit=10`,
        );
        return texto({ clientes: res.data.map(proyectarCliente) });
      }),
    );

    return server;
  }
}

function proyectarCliente(c: Record<string, unknown>) {
  return {
    clienteId: c.id,
    nombre: c.nombre,
    razonSocial: c.razonSocial ?? null,
    email: c.emailPrincipal ?? null,
  };
}

/**
 * Proyección whitelist del CotizarOutput para la conversación.
 *
 * El API ya poda costos/márgenes por permisos (@OcultaMargenes y la credencial
 * sin finanzas.ver_margenes) — esto es el SEGUNDO cinturón: acá se enumera lo
 * que SALE, no lo que se tacha. `costos`, tarifas, `margenEfectivoPct` y
 * cualquier campo nuevo del motor quedan afuera por diseño.
 */
function proyectarCotizacion(output: Record<string, unknown>) {
  const errores = ((output.errores ?? []) as Array<Record<string, unknown>>).map(
    (e) => ({
      codigo: e.codigo,
      mensaje: e.mensaje,
      sugerencia: e.sugerencia ?? null,
    }),
  );
  if (!output.exitoso || !output.cotizacion) {
    return { exitoso: false, errores };
  }

  const cot = output.cotizacion as Record<string, unknown>;
  const desglose = cot.desglosePrecio as Record<string, unknown> | undefined;
  const precioLegacy = cot.precio as Record<string, unknown> | undefined;
  const pasos = (cot.pasos ?? []) as Array<Record<string, unknown>>;

  const plazos = pasos
    .map((p) => Number(p.plazoProveedorDias))
    .filter((d) => Number.isFinite(d) && d > 0);

  return {
    exitoso: true,
    producto: cot.productoNombre,
    ruta: cot.rutaNombre,
    cantidad: cot.cantidadPedida,
    cantidadEfectiva: cot.cantidadEfectiva,
    minimoComercialAplicado: cot.minimoComercialAplicado ?? null,
    precio: desglose
      ? {
          netoUnitario: desglose.precioNetoUnitario,
          netoTotal: desglose.precioNetoTotal,
          brutoUnitario: desglose.precioBrutoUnitario,
          brutoTotal: desglose.precioBrutoTotal,
          totalImpuestos: desglose.totalImpuestos,
          descuento: desglose.descuento ?? null,
        }
      : precioLegacy
        ? {
            netoUnitario: precioLegacy.precioUnitario,
            netoTotal: precioLegacy.precioTotal,
            nota: precioLegacy.mensaje ?? null,
          }
        : null,
    plazoProveedorDias: plazos.length ? Math.max(...plazos) : null,
    pasosEjecutados: pasos
      .filter((p) => p.activado !== false)
      .map((p) => ({
        paso: p.nombreVisible ?? p.familiaCodigo,
        tercerizado: p.tercerizado === true,
      })),
  };
}
