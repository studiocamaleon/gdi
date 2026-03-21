# Especificación Técnica v1
## Productos y Servicios - Ficha de Producto (Impresión Digital Láser)

Fecha: 2026-03-15
Estado: Propuesta lista para implementación

## 1. Objetivo
Definir una implementación v1 para cotizar productos de **Impresión Digital Láser** sin reinventar lógica de producción:

- Reutilizar `ProcesoDefinicion` y `ProcesoOperacion` existentes.
- Asociar la **ruta de producción por variante**.
- Ejecutar un **AlgoritmoCosto versionado**.
- Exponer desglose trazable por pasos, materiales, tiempos y totales.

## 2. Principios cerrados
1. No duplicar estructura de pasos en módulo Productos.
2. La ruta se vincula por variante (`producto_variante.procesoDefinicionId`).
3. Parámetros específicos de operación (ej. tipo de corte, doble calle, mermas, cobertura) viven en la ruta/pasos (`detalleJson`, `reglaMermaJson`, `reglaVelocidadJson`) o en config de algoritmo por variante.
4. El motor usa datos reales de:
- centros de costo + tarifas publicadas,
- máquina/perfil,
- consumibles y repuestos,
- materia prima y conversiones.

## 3. Alcance v1
Incluye:
- Ficha con tabs: `General`, `Variantes`, `Producción`, `Costeo`, `Cotizador`.
- Algoritmo `impresion_digital_laser_v1`.
- Cálculo para:
  - B/N y CMYK por canales,
  - simple faz y doble faz,
  - pliego directo o costo derivado por conversión de sustrato,
  - pasos extras definidos en la ruta (ej. guillotina).

No incluye (v1):
- Optimización avanzada de nesting irregular.
- Simulación multi-máquina automática.
- Reglas de descuento comercial/márgenes de venta.

## 4. Modelo de datos (propuesto)

## 4.1 Reutilizado (sin cambios estructurales)
- `ProcesoDefinicion`
- `ProcesoOperacion`
- `CentroCostoTarifaPeriodo`
- `Maquina`, `MaquinaPerfilOperativo`, `MaquinaConsumible`, `MaquinaComponenteDesgaste`
- `MateriaPrimaVariante`

## 4.2 Nuevas entidades mínimas
1. `ProductoVariante`
- `id`
- `tenantId`
- `productoServicioId`
- `nombre`
- `anchoMm`, `altoMm`
- `papelVarianteId` (MateriaPrimaVariante)
- `tipoImpresion` (enum: `BN`, `CMYK`, `CMYK_K`, etc)
- `caras` (enum: `SIMPLE_FAZ`, `DOBLE_FAZ`)
- `procesoDefinicionId` (obligatorio para cotizar)
- `activo`
- `createdAt`, `updatedAt`

2. `AlgoritmoCosto`
- `id`
- `codigo` (ej. `impresion_digital_laser`)
- `version` (ej. `1`)
- `estado` (`activo`, `inactivo`)
- `schemaJson` (contrato de parámetros)

3. `ProductoVarianteAlgoritmoConfig`
- `id`
- `tenantId`
- `productoVarianteId`
- `algoritmoCostoId`
- `parametrosJson`
- `versionConfig`
- `activo`

4. `CotizacionProductoSnapshot`
- `id`
- `tenantId`
- `productoVarianteId`
- `algoritmoCodigo`, `algoritmoVersion`
- `cantidad`
- `periodoTarifa`
- `inputJson`
- `resultadoJson`
- `total`
- `createdAt`

## 4.3 Índices/constraints
- `ProductoVariante`: unique `(tenantId, productoServicioId, nombre)`
- `ProductoVariante`: index `(tenantId, productoServicioId, activo)`
- `ProductoVariante`: FK a `ProcesoDefinicion` con validación tenant.
- `ProductoVarianteAlgoritmoConfig`: unique `(tenantId, productoVarianteId, algoritmoCostoId, versionConfig)`

## 5. Diseño de Tabs (UI)

## 5.1 Tab General
- Nombre
- Descripción
- Familia/Subfamilia
- Unidad comercial
- Algoritmo costo (solo lectura en v1: `Impresión Digital Láser v1` para familia objetivo)

## 5.2 Tab Variantes
ABM de variantes:
- Nombre variante
- Ancho/Alto
- Papel (MateriaPrimaVariante)
- Tipo impresión
- Caras
- Estado

## 5.3 Tab Producción
Por variante:
- Seleccionar `Ruta de Producción` existente (`ProcesoDefinicion`).
- Acción secundaria: “Crear ruta” (navega al módulo Procesos).
- Visualizar pasos de la ruta seleccionada (solo lectura): centro, máquina/perfil, setup/run/cleanup/fijo, productividad.

## 5.4 Tab Costeo
Config de algoritmo por variante (`parametrosJson`), sin duplicar pasos:
- `tipoImposicion`: `a_sangre | doble_calle`
- `gapHorizontalMm`, `gapVerticalMm`
- `margenPerimetralCorteMm`
- `politicaCostoPapel`: `directo | derivado_conversion`
- `conversionSustratoReglaId` (si aplica)
- `mermaAdicionalPct`
- `redondeoMoneda`
- `canalesActivos` (si no inferible por tipo impresión)

## 5.5 Tab Cotizador
- Inputs: cantidad(es), fecha/periodo tarifa opcional, notas.
- Salida:
  - piezas por pliego,
  - hojas/pliegos requeridos,
  - desglose por paso,
  - desglose materiales (papel, toner por canal, desgaste),
  - total y unitario,
  - guardar snapshot.

## 6. Contrato del AlgoritmoCosto

## 6.1 Input (normalizado)
- Producto/variante
- Ruta y pasos
- Máquina/perfil por paso
- Tarifas publicadas por centro
- Precios MP
- Param config variante
- Cantidad

## 6.2 Output
- `resumen`: total, unitario, moneda
- `imposicion`: piezasPorPliego, orientacion, areaUtil
- `materiales`: detalle por ítem
- `pasos`: minutos/costo por paso
- `validaciones`: warnings/errores
- `traza`: parámetros efectivos aplicados

## 7. Reglas de cálculo v1

## 7.1 Imposición
1. Tomar formato pliego objetivo de impresión.
2. Restar márgenes no imprimibles de máquina.
3. Aplicar parámetros de corte (`a_sangre` o `doble_calle`) desde config.
4. Calcular piezas por pliego normal/rotado y usar máximo.

## 7.2 Papel
- Si papel coincide con pliego: costo directo.
- Si no coincide: costo derivado por regla de conversión (rendimiento + merma).

## 7.3 Tóner (sin hardcode)
- Leer consumibles `tipo=TONER` de máquina/perfil.
- Tomar unidad y semántica de `consumoBase` desde configuración del consumible.
- Para consumo en `g/m2`: `gramos = consumoBase * areaImpresaM2 * factorCanal * caras`.
- Valorar por `precioReferencia` de cada canal.

## 7.4 Repuestos/desgaste
- Leer componentes activos de máquina.
- Si unidad es `COPIAS_A4_EQUIV`, prorratear por equivalentes A4 de la corrida.
- Excluir ítems sin precio y reportar warning.

## 7.5 Tiempo/costo por pasos
Para cada `ProcesoOperacion`:
- `minPaso = setup + run + cleanup + fijo` (según unidad/productividad y cantidad técnica)
- `costoPaso = (minPaso/60) * tarifaHoraCentro`

## 7.6 Total
`total = costoPapel + costoToner + costoDesgaste + Σ costoPaso (+ otros insumos)`
`unitario = total / cantidad`

## 8. Validaciones obligatorias
1. Variante sin ruta -> no cotizable.
2. Ruta con paso sin centro de costo -> error.
3. Centro sin tarifa publicada para período -> error.
4. Consumible/repuesto sin precio -> warning (configurable: bloquear o continuar).
5. Piezas por pliego = 0 -> error de geometría.

## 9. API (propuesta)

## 9.1 Productos/variantes
- `GET /productos-servicios/:id/variantes`
- `POST /productos-servicios/:id/variantes`
- `PUT /productos-servicios/variantes/:varianteId`

## 9.2 Producción por variante
- `PUT /productos-servicios/variantes/:varianteId/ruta` (asigna `procesoDefinicionId`)
- `GET /productos-servicios/variantes/:varianteId/ruta`

## 9.3 Config algoritmo
- `GET /productos-servicios/variantes/:varianteId/algoritmo-config`
- `PUT /productos-servicios/variantes/:varianteId/algoritmo-config`

## 9.4 Cotización
- `POST /productos-servicios/variantes/:varianteId/cotizar`
- `GET /productos-servicios/variantes/:varianteId/cotizaciones`
- `GET /productos-servicios/cotizaciones/:snapshotId`

## 10. Plan de implementación por fases

## Fase 1 - Base de dominio
- Migraciones DB: variantes + algoritmo + config + snapshot.
- Endpoints CRUD variantes + asignación de ruta.
- DoD: variante creada y vinculada a ruta existente.

## Fase 2 - Motor algoritmo v1
- Implementar `impresion_digital_laser_v1`.
- Resolver lectura de consumibles/repuestos/centros/tarifas.
- DoD: cotiza 9x5 A4 B/N y CMYK con desglose.

## Fase 3 - UI Tabs
- Variantes + Producción + Costeo + Cotizador.
- DoD: usuario configura y cotiza de punta a punta.

## Fase 4 - Calidad y hardening
- Tests unitarios de motor.
- Tests integrales API.
- Casos QA reales: A4 directo, SRA3 derivado, simple/doble faz, canal faltante.
- DoD: resultados reproducibles y snapshot auditables.

## 11. Casos de prueba mínimos
1. Tarjeta 9x5, A4, B/N, simple faz.
2. Tarjeta 9x5, A4, CMYK, simple faz.
3. Tarjeta 9x5, SRA3->A4 derivado.
4. Paso adicional de guillotina fijo.
5. Falta tarifa publicada en un centro (debe fallar).

## 12. Riesgos y decisiones pendientes
1. Estandarizar semántica de `consumoBase` (ej. `g/m2`, `g/hoja`, etc.) en consumibles.
2. Definir tabla/reglas oficiales de conversión de sustratos (si aún no existe activa).
3. Definir política ante precios nulos en repuestos/consumibles (`bloquear` vs `warning`).

## 13. Criterio de éxito v1
Un usuario puede:
1. Crear producto y variantes.
2. Asignar ruta existente por variante.
3. Configurar parámetros de costeo.
4. Cotizar cantidades y obtener desglose trazable + snapshot.

