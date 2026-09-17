# Compra, uso y equivalencias de materiales

Fecha: 16/09/2026. Estado: investigación y propuesta; no implementado.

## Recomendación

Definir una unidad base de uso/stock y presentaciones con equivalencias propias de cada variante de material. Toda cantidad y todo precio deben tener una unidad explícita. La ficha, el editor de costos, el motor y los movimientos deben resolver la misma conversión.

Una caja o un rollo no tienen contenido universal. Las medidas físicas y el contenido del envase determinan la conversión. Por ejemplo: un rollo de 1,37 × 50 m contiene 68,5 m²; una caja de un artículo puede contener 100 unidades y otra, 250.

## 1. Hallazgos en Grafo

### Modelo y comportamiento actuales

- `MateriaPrima` guarda `unidadStock` y `unidadCompra`; la interfaz llama a la primera «Unidad de uso». `MateriaPrimaVariante` admite overrides nullable y tiene `precioReferencia`, pero no una unidad de precio explícita ni una equivalencia general. Ver [schema.prisma](../apps/api/prisma/schema.prisma), modelos `MateriaPrima`, `MateriaPrimaVariante`.
- La ficha define el precio como **por unidad de compra** y muestra una conversión a uso: [materia-prima-ficha.tsx](../src/components/inventario/materia-prima-ficha.tsx), campo con `ariaLabel="Precio de costo por unidad de compra"`. El editor masivo sigue ese criterio: [costos-materiales-editor.tsx](../src/components/inventario/costos-materiales-editor.tsx).
- Inventario interpreta `precioReferencia` como precio por compra y lo convierte a stock en `resolvePrecioReferenciaPorUnidadStock`. Si no encuentra conversión, devuelve el precio original silenciosamente: [inventario.service.ts](../apps/api/src/inventario/inventario.service.ts).
- En el motor, `cargarVariante` entrega el precio crudo y la unidad de stock; `precioMaterialPorUnidadDeConsumo` convierte partiendo de esa unidad de stock. Falta el paso compra → uso. Por ello, un precio realmente cargado por rollo puede interpretarse por metro lineal. Esto identifica un defecto del contrato; no demuestra que cada registro existente haya sido cargado con la misma convención. Ver [motor.service.ts](../apps/api/src/motor-universal/motor.service.ts).
- Los catálogos canónicos consideran caja, pack, kit, rollo, par, hoja y unidad compatibles con factor 1; resma tiene factor global 500. Esto permite conversiones de conteo sin conocer el contenido del artículo: [backend](../apps/api/src/inventario/unidades-canonicas.ts) y [frontend](../src/lib/unidades.ts).
- Ya existe conversión geométrica parcial entre rollo, m² y metro lineal para `sustrato_rollo_flexible` y `vinilo_corte`. No hay que rehacerla sin aprovecharla, pero debe integrarse al contrato común. Además, infiere metros/milímetros por el tamaño del número; debe reemplazarse por metadatos de unidad explícitos. Ver [unidades-derivadas.ts](../apps/api/src/inventario/unidades-derivadas.ts).
- `normalizePayload` valida compatibilidad y borra overrides de unidades de variantes poniéndolos en `null`; el editor masivo puede escribir esos overrides. Hay que unificar ambos caminos.
- Existen capacidades por caja en cálculos de procesos (`resolverCapacidadConversion`), pero no constituyen un sistema general de equivalencias de compra/stock. Capacidad de una caja usada para embalar y contenido de una caja comprada son conceptos diferentes.
- El backend de stock ya existe. `RegistrarMovimientoStockDto` recibe cantidad y costo sin unidad de origen; el movimiento persistido tampoco conserva el factor aplicado. No permite reconstruir «entraron dos cajas de 100» desde sus campos estructurados. Ver [DTO](../apps/api/src/inventario/dto/registrar-movimiento-stock.dto.ts) y modelos `StockMateriaPrimaVariante` / `MovimientoStockMateriaPrima`.

### Auditoría de desarrollo, de solo lectura

Empresa utilizada en la reproducción de PVC; materiales y variantes activos. Las unidades efectivas consideran override de variante y luego herencia del material.

| Compra → uso | Variantes |
| --- | ---: |
| Rollo → metro lineal | 13 |
| Caja → unidad | 28 |
| Metro lineal → unidad | 4 |
| Litro → ml | 15 |
| Unidad → ml | 1 |
| **Total con unidades diferentes** | **61** |

Son 61 sobre 226 variantes activas; 58 de las 61 tienen precio informado. No se ha validado el significado comercial de esos 58 precios ni se han recalculado cotizaciones en esta investigación. La empresa no registra movimientos de stock en la tabla consultada.

Ejemplos que orientan la migración:

- Los rollos de lona y vinilo tienen ancho y largo aprovechables para derivar contenido, previa normalización de unidades.
- Las 28 variantes caja → unidad no tienen un atributo de cantidad por caja entre sus claves actuales. Ese contenido no se puede inventar.
- Hay caños con uso `UNIDAD`, compra `METRO_LINEAL` y `largoBarra: 6`. Hay que confirmar si «unidad» significa barra y en qué unidad se informó el precio.
- Una tinta comprada por unidad y usada en ml tiene `volumenPresentacion: 500`; otras usan litro → ml. Conviene distinguir contenido físico del envase y rendimiento de impresión.

## 2. Qué hacen otros sistemas

Fuentes primarias consultadas el 16/09/2026. Se describen los comportamientos documentados, sin inferir funcionalidades no comprobadas.

| Sistema | Comportamiento documentado | Aplicación propuesta en Grafo |
| --- | --- | --- |
| ERPNext | Unidad de stock por artículo, otras unidades de compra con factor; el movimiento se registra en la unidad de stock. Permite definir varias equivalencias en el artículo. | Una unidad base estable y cantidad de compra convertida explícitamente. |
| Odoo 19 | Presentaciones específicas por producto, con cantidad y unidad de referencia; puede configurar presentaciones de compra por proveedor. | El contenido de caja/rollo pertenece al material y su presentación, no a una equivalencia global. |
| Business Central | Unidad base por artículo y unidades alternativas para compras, producción y ventas con cantidad por unidad; contempla precisión de redondeo. | Conservar equivalencias por artículo y reglas de precisión apropiadas para unidades discretas y continuas. |
| Pace MIS | La documentación de versión 30 describe unidades de compra para distintas longitudes de rollo y tamaños de caja, y distingue unidad de cantidad y unidad de precio en materiales del trabajo. | Conservar presentación física y base del precio por separado cuando sea necesario. |

Fuentes:

- [ERPNext: Purchasing in Different UoM](https://docs.frappe.io/erpnext/purchasing-in-different-unit).
- [Odoo 19: Packaging, fuente oficial de su documentación](https://github.com/odoo/documentation/blob/19.0/content/applications/inventory_and_mrp/inventory/product_management/configure/packaging.rst). Consultado su archivo fuente porque el sitio HTML devolvió timeout.
- [Odoo 19: Units of measure, fuente oficial](https://github.com/odoo/documentation/blob/19.0/content/applications/inventory_and_mrp/inventory/product_management/configure/uom.rst).
- [Microsoft: Set up units of measure](https://learn.microsoft.com/en-us/dynamics365/business-central/inventory-how-setup-units-of-measure).
- [Pace: Release Notes v30, páginas impresas 18–19](https://pace-clientfiles.epssw.com/releasematerials/documents/30/Pace_v30.0RNs.pdf#page=17). Documento histórico: portada mayo de 2018, revisión octubre de 2019; se usa como referencia de diseño de un MIS, no como comprobación de su versión actual.

## 3. Conceptos propuestos

1. **Unidad de uso:** unidad base para contabilizar cantidad y costo del material. Puede ser m², metro lineal, hoja, unidad, ml o kg, según la operación. No forzar todos los sustratos a m² ni cambiar automáticamente las unidades actuales.
2. **Unidad/presentación de compra:** cómo se pide o recibe al proveedor: rollo, caja de 100, botella de 1 litro, barra de 6 m, placa, etc. El nombre genérico «caja» no alcanza para identificar dos contenidos diferentes.
3. **Equivalencia:** cuánto contenido en unidad base tiene esa presentación. Guardada en el contexto de la variante; puede heredar valores comunes del material. Las dimensiones diferentes de variantes producen equivalencias diferentes.
4. **Unidad del precio informado:** por defecto coincide con compra, pero debe ser explícita. Es válido comprar una placa y recibir una cotización del proveedor por m². No obligar a calcular su precio a mano ni mantener dos precios editables independientes.
5. **Unidad de consumo del paso:** puede diferir de la base del material. Un paso puede consumir metros lineales y otro m². Se convierte usando la misma equivalencia y dimensiones, sin cambiar el catálogo.

La unidad de venta del producto terminado es otra decisión: vender un cartel por unidad no obliga a comprar ni consumir su PVC por unidad.

### Tres clases de conversión

- **Física fija:** kg ↔ g, litro ↔ ml, metro ↔ cm/mm. Automática, no editable por material.
- **Geométrica:** placa ↔ m²; rollo ↔ m² o metro lineal; barra ↔ metros. Calculada desde medidas con unidades explícitas. No usar umbrales numéricos para adivinar la unidad. Ejemplo: 1 metro lineal de un rollo de 1,37 m de ancho equivale a 1,37 m².
- **Contenido manual:** caja ↔ unidades, envase ↔ ml, pack ↔ hojas. Valor positivo por presentación/variante. Una resma puede sugerir 500 hojas, pero la configuración debe conservar y mostrar ese contenido, en vez de imponerlo a todo el catálogo.

El modo manual puede servir cuando no existe una fórmula geométrica aplicable. Si contradice medidas válidas, debe requerir resolver la diferencia; no permitir dos fuentes activas que den resultados distintos. kg ↔ litros requiere densidad del material, no una conversión universal. Un kit con distintos componentes requiere composición, no equivale automáticamente a N unidades de un mismo artículo.

## 4. Ejemplos y reglas de cálculo

Importes ilustrativos, no precios de mercado ni modificaciones de los precios actuales.

| Material | Presentación | Unidad de uso | Equivalencia |
| --- | --- | --- | --- |
| Vinilo | Rollo 1,37 × 50 m | m² | 1 rollo = 68,5 m² |
| Ojales | Caja de 100 | Unidad | 1 caja = 100 unidades |
| PVC | Placa 1,22 × 2,44 m | m² | 1 placa = 2,9768 m² |
| Tinta | Botella de 1 litro | ml | 1 botella = 1.000 ml |
| Perfil | Barra de 6 m | Metro lineal | 1 barra = 6 metros lineales |

Si `F` es la cantidad base contenida en una presentación:

```text
cantidad de uso = cantidad comprada × F
costo por unidad de uso = precio por presentación ÷ F
costo total = cantidad comprada × precio por presentación
            = cantidad de uso × costo por unidad de uso
```

Ejemplo: rollo a $137.000 con 68,5 m² → $2.000/m². Comprar 2 rollos incorpora 137 m² y $274.000 de valor. Consumir 3 m² cuesta $6.000 antes de aplicar la política de merma/costeo correspondiente.

Para una caja de 100 a $12.000, cada unidad cuesta $120. Consumir 25 unidades cuesta $3.000; no implica comprar 0,25 cajas si el proveedor vende solo cajas cerradas. El redondeo de reposición/compra se aplica por separado.

### Límites importantes para la industria gráfica

- Una equivalencia de área no describe la forma del material disponible. Dos retazos con igual área pueden no admitir la misma pieza. Mantener dimensiones y, cuando se implemente, identificación de rollos/placas/retazos.
- El nesting y la estrategia de costeo deciden si se cobra superficie exacta, un porcentaje o una placa completa. La equivalencia solo convierte unidades. Una imputación del 30 % de placa no demuestra que el consumo físico ni el remanente sean exactamente el 30 % / 70 %.
- No descontar merma del contenido y volver a aplicarla en el motor: duplicaría el efecto.
- El rendimiento de una tinta (ml por m² o páginas por envase) es una regla de consumo, distinta del contenido de la botella.
- Conservar precisión decimal en los cálculos; redondear importes al final. Para stock en unidades discretas, validar cantidades enteras; para áreas y volúmenes admitir la precisión necesaria.

## 5. Interfaz propuesta

Bloque «Compra y uso» en la ficha y en Nueva materia prima. Los valores específicos aparecen en cada variante; permitir aplicar un contenido común a varias variantes cuando corresponda.

```text
Unidad de compra       Rollo
Unidad de uso          m²

Contenido del rollo    Calculado por medidas
Ancho                  1,37 m
Largo                  50 m
Equivalencia           1 rollo = 68,5 m²

Precio informado       $137.000 por rollo
Costo por m²           $2.000
```

Para cajas: «1 caja contiene [100] unidades». Para unidades físicas compatibles: «1 litro = 1.000 ml», sin pedir un factor manual.

El precio toma compra como unidad inicial, con opción de informar el precio en otra unidad compatible. Ejemplo ilustrativo de PVC de 1,22 × 2,44 m: «$8.000 por m²» y «Precio equivalente por placa: $23.814,40». Mostrar una única fuente editable del precio y los equivalentes calculados.

Editor de costos y biblioteca: identificar siempre «$/rollo», «$/caja de 100», «$/m²», etc.; usar el mismo resolver. Si falta contenido, mostrar «Falta indicar cuántas unidades contiene la caja». Se puede guardar un material incompleto como borrador, pero no cotizarlo como si la conversión fuera 1:1.

En movimientos: «2 cajas × 100 = 200 unidades», preservando cantidad original y convertida. Cambiar el contenido del catálogo más adelante no altera movimientos ya registrados.

## 6. Implementación recomendada por etapas

### A. Contrato y auditoría de migración

- Establecer el significado explícito de `precioReferencia` y su unidad. Incorporar presentación, factor positivo, origen del factor (fijo/geométrico/manual), unidad base y versión de la equivalencia.
- Preferir presentaciones identificables sobre un único número global: una variante puede comprarse por caja de 100 y caja de 250. La primera interfaz puede exponer una presentación predeterminada y reservar múltiples presentaciones/proveedores para una ampliación.
- Resolver la inconsistencia entre guardado de ficha y editor masivo. Herencia y overrides deben ser iguales al guardar, leer y cotizar.
- Auditar los 61 casos actuales. Derivar equivalencias solo si la evidencia dimensional es inequívoca; las cajas sin contenido quedan para completar. No deducir la unidad de un precio por su magnitud ni aplicar una división masiva a todos los precios.
- Preservar cotizaciones/OT guardadas y sus snapshots. Los nuevos cálculos usan la nueva configuración; una actualización de una orden requiere recotización explícita.

### B. Resolver único e interfaz

- Centralizar conversiones de cantidad y precio con resultado trazable: origen, destino, factor, cantidad y costo equivalentes.
- Usarlo en ficha, Nueva materia prima, biblioteca, editor de costos, motor, materiales candidatos y consumibles. Convertir compra → base → unidad del paso exactamente una vez.
- Mantener el fix de PVC y verificar que el precio por placa se derive una sola vez. No cambiar estrategias de nesting ni reglas de merma como parte de esta migración.
- Sustituir fallbacks de conversión desconocida por errores de configuración concretos. Mantener conversiones fijas legítimas.

### C. Movimientos y compras

- Adaptar los endpoints existentes de stock a cantidades y precios con unidad explícita. Persistir cantidad original, unidad original, factor aplicado, cantidad base, costo base y referencia/versionado de presentación.
- Conservar costo promedio en la unidad base. Impedir cambiar esa unidad si existen saldos/movimientos sin una migración controlada.
- Un cambio de tamaño de envase crea o versiona su presentación, sin reescribir movimientos históricos. Cambios físicos como ancho de rollo o formato de placa pueden requerir otra variante porque afectan el nesting.
- Diferenciar presentación predeterminada, presentaciones por proveedor y múltiplos mínimos de compra. No es necesario construir todo el módulo de compras para resolver primero el costeo.

### Verificación necesaria al implementar

- Conservación del valor total al convertir cantidad y precio; ida y vuelta con precisión controlada.
- Misma equivalencia en ficha, editor, API, motor y stock; incluir overrides e importación desde biblioteca.
- Caja de 100, caja de 250 de la misma variante, rollos con anchos diferentes, placa PVC, litro/ml y envase de 500 ml.
- Casos sin factor, factor cero/negativo, dimensiones sin unidad y conflictos entre contenido manual y geometría.
- Todas las estrategias de costeo de placas; merma aplicada una sola vez; consumibles y selección por menor costo.
- Cambio de presentación sin alterar documentos anteriores y sin reinterpretar un saldo existente.

## Alcance de esta investigación

Se revisaron código, esquema y datos mediante consultas de lectura, y documentación oficial externa. No se modificaron materiales, precios, cotizaciones, stock ni lógica de ejecución. Los cambios previos del fix de PVC se conservan separados de esta propuesta.
