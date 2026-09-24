# Precios de materiales por volumen de compra

Fecha: 23/09/2026. Estado: **propuesta para discutir; sin implementación ni cambios en planes o datos**.

## Necesidad

Visual Ilusión compra PAI por kg con precios diferentes según la cantidad del pedido al proveedor. La función comercial debe ofrecerse en **Grafo Avanzado**, manteniendo el costo fijo actual para los demás planes.

No confundir cantidad del producto vendido, consumo del trabajo, faltante de stock y cantidad comprada. Pueden ser cuatro números distintos.

## Base real de Grafo revisada

- `MateriaPrimaVariante`: precio de referencia, moneda, unidad del precio, compra/stock/uso y equivalencias. Actualmente ofrece un único precio de referencia.
- `OfertaCompra`: relación por tenant/proveedor/variante, precio, mínimo, múltiplo, plazo y vigencia. Tiene una única oferta por esa relación; no una lista de tramos.
- `LineaOrdenCompra`: cantidad, precio y `ofertaSnapshot`. El servidor valida mínimos/múltiplos; los tramos futuros deben resolverse también en el servidor, antes de confirmar.
- Recepción: usa el precio congelado de la línea y la cantidad efectivamente recibida, convirtiendo a costo por unidad de stock. Para compra por peso y stock en placas admite cantidad física real; no necesita modificar el coeficiente del catálogo.
- Motor: calcula con el precio de referencia y sus conversiones. Introducir tramos sólo en la ficha no cambiaría la cotización ni las compras correctamente.
- Plataforma: catálogo de capacidades con dependencias y versiones de planes, incluyendo materiales, proveedores, compras y recepciones. No resolver la licencia comparando el nombre del plan en un componente.

Referencias de código: [modelos](../apps/api/prisma/schema.prisma), [compras](../apps/api/src/compras/compras.service.ts), [unidades](../apps/api/src/inventario/material-units.ts), [motor](../apps/api/src/motor-universal/motor.service.ts), [capacidades](../apps/api/src/plataforma/planes/catalogo-planes.ts).

## Modelo propuesto

Una **tarifa de proveedor por volumen** pertenece a una empresa y tiene proveedor, material/variantes aplicables, moneda, unidad del precio, vigencia, mínimo/múltiplo de compra y tramos. Extender la oferta comercial existente con tramos relacionados; conservar el precio fijo como modalidad y como costo de referencia independiente.

- Guardar umbrales «desde», únicos y ordenados, en la unidad de la tarifa. El fin de cada tramo se deriva del siguiente: desde 100 hasta menos de 300; desde 300 hasta menos de 500; desde 500. Evita duplicar el límite de 300 kg.
- Separar **mínimo de compra** del primer umbral de descuento. Si no hay precio aplicable para menos de 100 kg, indicar «Consultar»; nunca tratarlo como costo cero ni usar el tramo de 100 automáticamente.
- Primera modalidad recomendada: el precio del tramo aplica a toda la cantidad elegible del pedido. Confirmar con Visual Ilusión; una tarifa progresiva que cobra cada porción a distinto precio requiere otro método explícito.
- Alcance de acumulación explícito: por variante, o por grupo de variantes que el proveedor permita combinar. Nunca acumular por mera familia, proveedor compartido o nombre PAI.
- Un grupo puede sumar kg de varios espesores aunque cada espesor conserve su precio. Agrupar cantidades no implica igualar precios ni equivalencias.
- La versión inicial no supone acuerdos acumulativos mensuales/anuales; esos son contratos diferentes.

## Interfaz

En **Material → Compra y costos**: conservar el costo de referencia y agregar «Tarifas de proveedores». Editor en panel lateral:

1. Proveedor, moneda y unidad del precio (ej. USD/kg).
2. Modalidad: precio fijo / por volumen.
3. Tabla compacta «Desde cantidad / Precio por kg», con fin derivado visible.
4. Vigencia, mínimo y múltiplo; variantes incluidas y criterio de acumulación.
5. Simulador «Comprar 350 kg» que muestra precio unitario, total y tramo aplicado.

En una compra, al elegir proveedor y cantidad, resolver y mostrar el tramo y su procedencia. Cambiar cantidades recalcula el borrador, incluyendo otras líneas afectadas por la agrupación. Una sustitución manual de precio requiere permiso y queda registrada; no se sobrescribe en silencio.

## Cómo se usa al cotizar

Separar dos políticas explícitas:

### Costo de referencia

Se sigue usando el costo habitual del catálogo. Las tarifas afectan las compras; no cambian todas las cotizaciones ni revalúan el inventario. Es la continuidad predeterminada.

### Costo según compra prevista

Antes de emitir la OT se puede calcular una compra estimada para el trabajo, con proveedor, faltante, mínimo/múltiplo y conversión confirmada. También puede declararse un lote habitual de reposición como supuesto de costeo; debe verse y guardarse como estimación, sin crear una compra ni reservar stock por cotizar.

Ejemplo: un trabajo consume 80 kg y se estima comprar un lote de 400 kg. El precio del kg puede venir del tramo de 400, pero los 400 kg no son automáticamente consumo de ese trabajo. La parte restante es inventario; cualquier política de cargar una compra exclusiva completa al cliente debe ser explícita.

Si parte del material ya está en stock, no asumir que toda la necesidad se comprará ni revalorizar existencias al precio de una nueva oferta. Distinguir costo comercial estimado del costo real que se registra al consumir stock.

La conversión placas/m² → kg debe usar peso por placa u otra equivalencia declarada para esa variante. Considerar merma y placas completas conforme a la política de costeo existente. No inventar una densidad universal del PAI.

El cálculo consolidado no debe duplicar un sustrato heredado entre pasos ni las necesidades físicas de un lote de nesting compartido. Si una estrategia compara alternativas por costo, evaluar cada alternativa con su cantidad y tarifa aplicables; no elegir con un precio y costear con otro después sin revisar la selección.

## Historial, recepción y planes

- Guardar tarifa/versión, proveedor, cantidad que habilitó el tramo, variantes acumuladas, precio, moneda/tipo de cambio, conversiones y supuesto de abastecimiento junto al resultado. No recalcular documentos históricos por editar una tarifa.
- Una recepción parcial conserva el precio acordado para la compra completa: recibir 100 kg de una compra de 400 no vuelve a evaluar el tramo de 100. Renegociaciones/cancelaciones parciales requieren una revisión explícita.
- Capacidad propuesta `precios_materiales_volumen`, disponible en el editor de Plataforma. Activación comercial en Avanzado; Esencial y Pro mantienen precio fijo. Resolver explícitamente su asignación a Founder, Trial y variantes Co-founder antes de publicar; no habilitarlos por accidente.
- Validar configuración y aplicación de tarifas en API/motor, importaciones y operaciones por lote, además de la UI. Dependencias mínimas: materiales/proveedores. La integración operativa con OC depende de compras; simular un costo no debe exigir existencias, reservas ni una OT emitida.
- Al bajar de plan, conservar tarifas e historial sin habilitar nuevas aplicaciones de tramos. Definir costo fijo de continuidad; permitir terminar compras ya emitidas con su precio congelado.

## Secuencia recomendada

1. Confirmar con un caso de PAI las condiciones del proveedor: acumulación por espesor o conjunta, precio sobre todo el pedido, unidad y mínimo.
2. Construir tarifas, editor/simulador, reglas compartidas y control de capacidad.
3. Integrar preparación y confirmación de compras, snapshots y recepciones parciales.
4. Integrar compra prevista en cotización, antes de emitir, preservando el modo de referencia y la trazabilidad de supuestos.

Pruebas necesarias: umbrales exactos y cantidades fraccionarias; ninguna tarifa aplicable; vigencias; monedas; conversiones faltantes; mezclas permitidas/prohibidas; líneas repetidas; pedido consolidado; stock parcial; variantes heredadas; recepción parcial; aislamiento entre empresas; plan sin capacidad y continuidad tras cambio de plan; snapshots históricos.

## Referencias externas

- [Odoo — tarifas de proveedores](https://www.odoo.com/documentation/18.0/applications/inventory_and_mrp/purchase/products/pricelist.html): cantidad mínima y precio por proveedor para completar pedidos de compra.
- [ERPNext — Pricing Rule](https://docs.frappe.io/erpnext/pricing-rule): reglas de precio con condiciones de cantidad y ámbito de aplicación. Referencia de diseño; no implica reproducir todas sus opciones en Grafo.

## Decisiones pendientes

- ¿Visual Ilusión suma kg de distintos espesores/colores de PAI para alcanzar el tramo?
- ¿El precio aplica a todo el pedido o progresivamente?
- ¿El comercial costea con reposición habitual o con compra específica para cada trabajo?
- No hay precios ni pesos reales del proveedor confirmados; los ejemplos son ilustrativos.
