# Integración posterior con Grafo

Forma no depende de la sesión, las tarifas ni la base de datos de Grafo. El punto de intercambio es la función `quoteEnvelope(project, model)` de `src/core/output.ts`; también se descarga como `grafo-fabricacion.json` dentro del paquete de fabricación.

## Contrato 1

- `schema`: `grafo.fabrication-design`; `version`: `1`; `units`: `mm`.
- `source`: aplicación, versión, ID local y nombre del proyecto.
- `design`: modo (letras/encastre), estilo, parámetros y dimensiones.
- `components[]`: identificador, nombre, capa, `materialKind` (`filament`, `acrylic` o `pvc`), cantidad, ancho/alto/profundidad, volumen, superficie, área y perímetro de corte, y contornos.
- `estimates`: cálculo orientativo local, moneda y supuestos explícitos de densidad, merma, caudal y tarifas. No sustituye los valores de Grafo.
- `warnings`: incidencias del diseño que deben mostrarse al cotizador.

Todas las dimensiones son mm; áreas mm²; volumen mm³. Para la API de Grafo, área m² = mm² / 1 000 000; perímetro m = mm / 1 000; volumen cm³ = mm³ / 1 000. El peso geométrico es cm³ × densidad en g/cm³. No confundir área del contorno con superficie total del sólido.

Los contornos están en el sistema del diseño con Y hacia arriba y conservan huecos. La caja de una pieza se obtiene de sus límites; no se puede reconstruir el aprovechamiento irregular sólo con ancho y alto. Las cantidades de componentes describen un conjunto; la cantidad comercial debe multiplicarse una vez en el adaptador.

Acrílico y PVC tienen áreas y tarifas locales separadas (`acrylicM2` y `pvcM2`); el adaptador debe asociar cada uno a su material real. Las plantillas de base LED se entregan como DXF en `corte/plantillas/` del ZIP. Son auxiliares de fabricación, no componentes físicos ni consumo de placa en el contrato actual. Las tapas impresas se orientan sobre su chapa al exportar STL por pieza o mesa; los contornos y las métricas del contrato conservan las coordenadas de montaje.

## Ampliación de contrato: versión 2

Las seis nuevas recetas de base de `acrylic-fit`, `printed-fit` y `perforated` (`fitBaseType` distinto de `legacy`) emiten versión 2. Mantienen las unidades y métricas anteriores, incorporan la receta y controles de cierre en `design.parameters`, y permiten una capa adicional `pvc` para separar el fondo de corte del marco impreso. Los demás diseños siguen emitiendo versión 1. El receptor debe admitir ambas versiones y asignar procesos según `materialKind`; un marco y su PVC son componentes físicos diferentes. Detalle en [bases-y-cierre-pvc.md](./bases-y-cierre-pvc.md).

El frente calado añade `design.perforation: { holes, openAreaMm2, frontAreaMm2 }`. Describe el patrón antes de los cortes y agujeros auxiliares de fabricación. Para consumos y costos se usan las métricas finales de `components[]`: el volumen del cuerpo descuenta el calado y el área del difusor conserva la placa entera. Los parámetros del patrón viajan en `design.parameters`. Detalle en [frente-calado.md](./frente-calado.md).

## Banderola circular: versión 3

`design.mode = lightbox` y `design.style = circular-double-face` identifican el conjunto de doble cara. Sus medidas viajan en `design.parameters`. `design.lightbox` incluye área visible expresada por diámetro, montaje, `rimClosure` (`snap` o `screws`), `snapTabsPerFace` y alojamientos de tornillería. `lighting = unconfigured`: el sistema LED anterior se retiró. `ledCount` y `watts` se conservan en cero por compatibilidad; no representan una iluminación dimensionada.

Los materiales fabricados incluyen `flexible` para juntas opcionales; se cotizan con densidad y tarifa separadas. `components[]` contiene una pieza física por ID, y `printDimensionsMm` cuando su orientación de impresión difiere del montaje. Los aros con faldón se imprimen sobre la pestaña frontal. La versión 3 no modifica los contratos de letras.

El lateral orgánico añade parámetros `side*` a `design.parameters` y `design.lightbox.sideProfile: { kind, from, to, relief, maxDiameter }`. `from/to` delimitan la franja decorable axial; `relief` es el avance radial efectivo y `maxDiameter` su diámetro exterior máximo, sin brazos. El diámetro nominal de encastre se mantiene en `diameter`. El relieve es parte del cuerpo, ya incluido en su volumen, superficie y dimensiones: no sumarlo como otro componente. Los cambios de perfil no modifican el corte de los acrílicos.

`purchasedComponents.rimScrews` describe la cantidad de tornillos comerciales del cierre, diámetros de paso y piloto, profundidad ciega y límite geométrico de largo bajo cabeza. `includedInEstimate = false`: no sumar como filamento ni interpretar esos parámetros como un SKU o tornillo aprobado. Seleccionar y ensayar el tornillo real. En cierre click, `quantity = 0`; las pestañas pertenecen al STL de cada aro y no son piezas ni consumos adicionales. El ZIP marca la iluminación como pendiente y la fuente como `null`, y conserva los anclajes de pared según la configuración. El adaptador completo sigue pendiente.

## Encaje con el código actual de Grafo

El frontend de Grafo define `CotizarRequest` en `src/lib/productos-servicios-api.ts`; su endpoint es `POST /motor-universal/cotizar`. Acepta un `productoId` real y `jobContext` con cantidad, medidas, piezas, material y otras entradas. Este contrato de Forma **no es ese DTO y no debe enviarse directamente al endpoint**.

La familia `impresion_3d` ya está declarada en `apps/api/src/productos-servicios/pasos/familias.ts`: consume el slot `material_3d`, usa `gramos_material` como magnitud temporal y admite caudal (T-3) o tiempo manual del laminador (T-4). El parámetro `gramosPorPieza` puede llegar mediante `jobContext.configPasoRuntime[configPasoId]` cuando la receta lo expone; esto se resuelve en `paramsEfectivosDelPaso` de `motor.service.ts`.

El adaptador debe:

1. Recibir el contrato bajo la sesión autenticada y organización de Grafo. Validar versión, unidades, límites y permisos.
2. Asociar capas/materiales a productos, slots, variantes y pasos reales de esa organización. Los IDs locales de Forma no son IDs de inventario.
3. Crear componentes fabricados de impresión 3D y de corte. Incorporar contornos para el flujo vectorial de Grafo cuando corresponda; generar su preparación/nesting antes de cotizar si la receta lo exige.
4. Pedir confirmación del peso/tiempo del laminador, o identificar explícitamente el dato como estimado. No copiar el precio local ni inventar un tiempo cero. Evitar sumar la merma en Forma y nuevamente en la receta.
5. Invocar el motor de Grafo, que sigue siendo la autoridad sobre máquinas, consumibles, gastos, márgenes, moneda e impuestos.
6. Guardar una revisión del proyecto y el contrato junto al ítem cotizado. Editar el diseño invalida las métricas y cualquier cotización anterior; conservar el original permite reproducir una orden.

## Uso embebido o servicio propio

El editor puede publicarse en su propio dominio y reutilizar el motor en un componente de Grafo o abrirse mediante un enlace de proyecto. Si se elige iframe, definir un protocolo de mensajes con versión e ID de solicitud, validar `origin` y `source` en ambos extremos y limitar los dominios permitidos. No pasar tokens por URL ni implementar mensajes con destino `*`.

La futura autenticación/venta debe pertenecer a Forma: usuarios, organizaciones, proyectos, revisiones, suscripciones y permisos. Un adaptador opcional vincula una organización de Forma con una de Grafo; el negocio independiente no necesita instalar Grafo. Las credenciales de facturación y los webhooks viven en un servidor, nunca en el editor estático.

No se agregó todavía un endpoint receptor ni una llamada de cotización automática en Grafo. Esa integración requiere definir el catálogo y la receta reales que consumirán los componentes.
