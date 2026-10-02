/** Datos auxiliares del cotizador. No es la ficha de administración del producto.
 * Las columnas nuevas de la base no se publican por defecto. */
const CAMPOS = new Set(
  `id codigo nombre descripcion createdAt updatedAt estructuraProducto esCompuesto
usadoComoComponente activo listoParaCotizar estadoCatalogo tercerizado unidadComercial modoMedidas
medidaDefaultAnchoMm medidaDefaultAltoMm medidaDefaultProfundidadMm dimensionesRequeridas
minimoComercialPolitica minimoComercialCantidad minimoComercialBase subcategoriaComercial categoria
icono color orden ordenInterno ordenFlujo insertarDespuesDeRutaPasoId maquinaM1Id perfilM1Id centroCostoId version rutaVersion nombreVisible esPreferida rutaAlternativaId
rutasAlternativas ruta pasos configPasos pasosExtras rutaPasoId rutaPaso familiaCodigo familiaNombre
herramientasCotizacion herramientasCotizacionDisponibles permiteSegmentacionVectorial modoActivacion
modoTiempo mecanismoCantidad multiplicadoresActivos maquinaM1 maquinaId perfilM1 perfilDefaultId
perfilDefault perfilesOperativos tipoPerfil productivityValue productivityUnit anchoUtil plantilla
centroCostoPrincipalId centroCostoPrincipal centroCosto unidadBaseFutura setupOverrideMin cleanupOverrideMin
tiempoFijoOverrideMin dotacionOperarios requiereRutaPasoIds slotsMateriales slotCodigo slotNombre slotRol
modoSeleccion heredaDeRutaPasoId heredaDeSlotCodigo criterioMotorAuto politicaStock formula cantidadFactor
mermaAdicionalPct cantidadBase aplicaMultiCaras materialVariante materiaPrimaId materiaPrima sku
nombreVariante familia subfamilia templateId variantes candidatos defaultVarianteId defaultVariante
variante todasLasVariantes maquinasCandidatas modoColorAllowedModes modoColorOptions value label perfilIds
maquina estacion cargosDirectosPaso cargosDirectosCotizacion cargoDirectoCatalogo cargoDirectoCatalogoId
nivelCodigo modoCalculo modosActivacionSoportados plazoProveedorDias tercerizadoEntradas claveMatch cantidad
fuenteCostoTercerizado`.split(/\s+/),
);
const JSON_COMERCIALES = new Set(
  `atributosComercialesJson atributosSchemaJson medidasPredefinidasJson personalizacionesJson
reglaAutoSeleccionJson condicionActivacionJson mecanismoCantidadConfigJson paramsPasoJson
parametrosTecnicosJson capacidadesAvanzadasJson detalleJson atributosVarianteJson valoresJson`.split(
    /\s+/,
  ),
);
const CONFIG_TERCERIZADO = new Set([
  'tecnologia',
  'ejes',
  'unidad',
  'cantidadMinima',
  'cantidadMaxima',
]);
const CONFIG_CARGO = new Set([
  'inputCantidad',
  'inputNombre',
  'inputLabel',
  'inputUnidad',
  'unidad',
  'cantidadDefault',
  'cantidadMinima',
  'cantidadMaxima',
  'decimales',
  'permiteDecimales',
  'label',
  'descripcion',
]);
const FINANCIEROS =
  /^(cost|price|pricing|amount|fee|unitPrice|basePrice|margin|coste|precio|tarifa|comision|rentabilidad|ganancia|utilidad|markup|margenPct|margenBruto|margenNeto|margenAplicado|margenMin|aplicaMargen|importe|monto|valorHora|porcentajeMargen)/i;
function objeto(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}
/** JSON técnico/comercial: conserva medidas físicas, nunca valores económicos. */
function jsonComercial(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(jsonComercial);
  if (v === null || typeof v !== 'object') return v;
  return Object.fromEntries(
    Object.entries(objeto(v))
      .filter(
        ([k]) => !FINANCIEROS.test(k) && k !== 'margen' && k !== 'proveedorId',
      )
      .map(([k, x]) => [k, jsonComercial(x)]),
  );
}
/** Sólo el contrato de configuración comercial de los componentes publicados. */
export function configuracionComponenteParaCotizacion(v: unknown): unknown {
  const campos = new Set(['version', 'bindings', 'piezas', 'piezasEditables', 'repeticion']);
  return v == null ? null : jsonComercial(Object.fromEntries(
    Object.entries(objeto(v)).filter(([k]) => campos.has(k)),
  ));
}
export function productoParaCotizacion(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(productoParaCotizacion);
  if (valor instanceof Date) return valor;
  if (valor === null || typeof valor !== 'object') return valor;
  // Los Decimal de Prisma son escalares; el nombre del campo ya pasó el filtro.
  if (valor.constructor !== Object) return valor;
  const entrada = objeto(valor);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(entrada)) {
    if (k === 'precioReferencia') {
      out.precioCargado = Number(v) > 0;
      continue;
    }
    if (k === 'precioConfigJson') {
      const c = objeto(v),
        d = objeto(c.detalle);
      out[k] = {
        metodoCalculo: c.metodoCalculo,
        detalle: {
          tiers: Array.isArray(d.tiers)
            ? d.tiers.map((t) => ({ quantity: objeto(t).quantity }))
            : [],
        },
      };
    } else if (k === 'tercerizadoConfigJson') {
      out[k] = {
        ...Object.fromEntries(
          Object.entries(objeto(v))
            .filter(([key]) => CONFIG_TERCERIZADO.has(key))
            .map(([key, x]) => [key, jsonComercial(x)]),
        ),
        costoEstimadoDisponible: Number(objeto(v).costoEstimado) > 0,
      };
    } else if (k === 'configJson' || k === 'configOverrideJson') {
      out[k] = Object.fromEntries(
        Object.entries(objeto(v))
          .filter(([key]) => CONFIG_CARGO.has(key))
          .map(([key, x]) => [key, jsonComercial(x)]),
      );
    } else if (JSON_COMERCIALES.has(k)) out[k] = jsonComercial(v);
    else if (CAMPOS.has(k)) out[k] = productoParaCotizacion(v);
  }
  return out;
}
