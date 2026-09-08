# Fase 4 — Auditoría integral de alcance, integración y cierre

Fecha: 7 de septiembre de 2026. Revisión del código y los cambios locales de `visual-ilusion/fase-4-rutas-dag`, sobre `26a13da7`. Incluye las extensiones recientes de piezas rectangulares, ocurrencias, archivos DXF y planes por patrones.

## Dictamen

**No cerrar todavía la Fase 4 ni iniciar su integración operativa con Fase 5.** La mayor parte de las capacidades está implementada y hay una base amplia de pruebas. Los impedimentos actuales son de integración, conservación de información y validación operativa. No justifican seguir agregando funcionalidades indefinidamente.

La consolidación puede generar un ciclo en una ruta válida; áreas existentes todavía interpretan componentes técnicos como productos vendidos o participaciones como operaciones físicas. También falta cerrar el contrato de lotes multinivel y la aceptación del motor irregular. Estos problemas pertenecen a F4 porque afectan lo que esta fase ya promete vender y ejecutar.

Esta auditoría incorpora documentación y reproducciones, sin modificar la lógica de negocio ni publicar productos. Las comprobaciones que crearon registros usaron `gdi_saas_test`, dentro de transacciones revertidas. Se verificó que no quedaran las órdenes de prueba. No se emitieron órdenes, facturas ni mensajes en la cuenta de trabajo.

## 1. Alcance original y extensiones

El documento rector es [Plan Maestro](/Users/lucasgomez/gdi-saas/docs/visual-ilusion-plan-maestro.md:590). Los documentos complementarios no reducen sus obligaciones.

| Bloque | Compromiso que debe cerrarse | Estado sustentado por esta revisión |
| --- | --- | --- |
| F4 original | Flujos lineales/DAG, ramas simultáneas, convergencias, gates, reapertura, progreso y ETA | Implementados; pruebas de grafo, permisos, transiciones y scheduler aprobadas. La consolidación posterior puede romper la topología: H1. |
| Padre–componente | Instancias hijas con revisión propia, cantidades, bindings, contexto aislado, incorporación y ejecución independiente/inline | Implementado y cubierto parcialmente por integración del motor. Falta el recorrido completo con OT persistida y ejecución de los casos actuales. |
| F4.1 | Outputs entre componentes; DAG de cálculo separado de la producción; parámetros del oficio tercerizado | Contratos y resolución presentes. Existe Cartel Backlight publicado. Su evidencia funcional histórica y las pruebas parciales no demuestran el cierre completo actual. |
| F4.2 | Nodos compuestos con operaciones internas completas y un único estado de producción | Motor, autoría y materialización presentes; regresión técnica aprobada. Revalidar convergencia, compras y ejecución dentro del recorrido rector. |
| F4.2.3/4.2.4 | Dimensiones explícitas 0D/2D/3D; opcionales y condicionales internos; omisiones que conservan dependencias | Implementados. Las pruebas de contratos/grafo pasan. Incluirlos en la aceptación de Backlight y del producto simple. |
| F4.3 | Precio general, mixto y por componente; impuestos, descuentos y redondeos sin duplicación | Implementado; la integración de pricing pasa. La lectura posterior de costos variables y la factura detallada requieren adaptación: H3/H5. |
| F4.4 | Nesting compatible entre componentes de un producto; consumo/preparación reconciliados; operación compartida única | Motor, snapshots y materializador presentes. H1, H2, H4 y H7 impiden considerarlo cerrado. |
| Extensión de ocurrencias | Repetición 0..N/1..N con identidad, configuración y cantidades propias | Implementada; se distinguen ocurrencias y grupos según exista colección de piezas. Incluir altas, cambios y eliminación en los recorridos de aceptación. |
| Extensión multipieza | Varias piezas DXF o rectangulares dentro de un componente; cantidades por unidad y ajustes al cotizar | Implementada. Kit de Vinilos publicado tiene dos tipos de pieza; el exhibidor de prueba tiene seis. Faltan comprobaciones de esas mismas cantidades al ejecutar y reabrir una OT. |
| Archivos reutilizables y patrones | Fuente guardada, interpretación, cantidades heterogéneas, patrones y registro impresión–corte | Implementados y con evidencia previa de cotización/exportación. Persisten H6/H7 y una brecha de prueba de migración. |
| Capas DXF | Conservar entidades visibles, nombres/propiedades y transformaciones; exportar CAD verificable | Pruebas de API/web y 12 pruebas Python aprobadas. Hay evidencia anterior con archivos reales. Herramientas y tiempos por recorrido todavía corresponden al alcance futuro. |
| UI transversal | Editor unificado, especificaciones, plan de fabricación y vocabulario Grafoprint | Mejoras presentes. La regresión web pasa, pero el control de CSS global falla y falta QA integral responsive/operador. |

Los archivos de diseño de F4, F4.1 y F4.2 mantienen varios estados históricos que no representan el conjunto ampliado. La evidencia antigua se conserva como histórica; este informe es la evaluación de cierre vigente al 07/09.

## 2. Hallazgos que requieren resolución

### H1 — Prioridad alta: consolidar puede convertir un DAG válido en un ciclo

**Reproducido con el consolidador real y el materializador contra PostgreSQL de prueba.**

Caso: `Impresión A → Control intermedio → Impresión B → Final`. A se incorpora al control; B sólo puede comenzar después de ese control. Ambas impresiones comparten material y configuración técnica.

El motor acepta el lote y cotiza un ahorro de 16 unidades monetarias del fixture. Al materializar agrega `Control intermedio → Impresión A`, aunque ya existe `Impresión A → Control intermedio`. La materialización termina sin rechazarlo; el validador del grafo confirma: “La topología productiva contiene un ciclo”.

La compatibilidad de máquina/material no asegura que las operaciones puedan ejecutarse juntas. El ahorro cotizado queda asociado a una operación imposible de iniciar.

**Cierre:** comprobar compatibilidad de precedencias antes de aplicar ahorro, conservar cálculo independiente con motivo cuando corresponda y volver a validar el grafo resultante transaccionalmente al materializar. Cubrir también dependencias transitivas y conjuntos impresión–corte.

Fuentes: [aplicación de grupos](/Users/lucasgomez/gdi-saas/apps/api/src/motor-universal/nesting-compuesto-shadow.ts:1018), [materialización de dependencias](/Users/lucasgomez/gdi-saas/apps/api/src/ordenes-trabajo/ordenes-trabajo.service.ts:5107). [Reproducción](/Users/lucasgomez/gdi-saas/output/auditoria-fase-4-2026-09-07/reproducir-lote-precedencias.cjs), [resultado](/Users/lucasgomez/gdi-saas/output/auditoria-fase-4-2026-09-07/lote-precedencias.json).

### H2 — Prioridad alta: el simulador de impresión pierde piezas y duplica participaciones

**Reproducido invocando el servicio real sobre datos de prueba.** Una operación principal y cinco participaciones generan seis trabajos en el simulador. Todos llegan con `piezas: []`, consumo nulo y variante nula, aunque los hijos tienen contexto de piezas congelado y la operación principal tiene un snapshot del lote.

El constructor sigue leyendo exclusivamente `item.cotizacionItem`. Los hijos técnicos no tienen ese vínculo: reciben `jobContextSnapshotJson` y el lote operativo por otra vía. La consulta tampoco distingue `OPERATIVO` de `PARTICIPANTE`.

**Cierre:** proyectar el contexto congelado correspondiente a cada ítem, recuperar la geometría/material del lote y publicar una sola operación física. Verificar las demás colas/simuladores con el mismo criterio; no reanidar de forma independiente un corte que ya tiene registro de impresión.

Fuentes: [constructor del trabajo](/Users/lucasgomez/gdi-saas/apps/api/src/produccion/produccion.service.ts:530), [consulta del simulador](/Users/lucasgomez/gdi-saas/apps/api/src/produccion/produccion.service.ts:789). Evidencia en `jobsSimulador` del [resultado de integración](/Users/lucasgomez/gdi-saas/output/auditoria-fase-4-2026-09-07/reportes-reproduccion.json).

### H3 — Prioridad alta: los reportes de rentabilidad omiten costos variables de los hijos

**Reproducido con la consulta SQL real.** Un ítem tiene 20 de material en el padre y 100 en un componente. Su costo total congelado es 120; el reporte devuelve sólo 20 de costos variables.

La consulta recorre `trazabilidadJson.pasos[].materiales[]`, pero no el árbol de componentes. Esto sobrestima la contribución y altera el punto de equilibrio. El costo total agregado no es el mismo defecto: en el ejemplo sí conserva 120.

**Cierre:** usar una proyección económica recursiva y reconciliada del snapshot, sin sumar dos veces costos absorbidos por el padre ni consumos reasignados de lotes compartidos. Probar materiales, consumibles, desgaste, tercerización e incorporación con las tres estrategias de pricing.

Fuente: [rentabilidad](/Users/lucasgomez/gdi-saas/apps/api/src/reportes/rentabilidad.service.ts:58). [Fixture y resultado](/Users/lucasgomez/gdi-saas/output/auditoria-fase-4-2026-09-07/reportes-reproduccion.json).

### H4 — Prioridad alta: métricas comerciales y productivas cuentan entidades internas

**Reproducido con consultas reales.**

| Magnitud | Caso correcto | Resultado actual |
| --- | --- | --- |
| Ítems vendidos | 1 kit | 7: kit + 6 componentes |
| Ítems sin costo | 0 | 6 componentes sin `cotizacionItemId` |
| Operaciones terminadas | 1 tanda física | 6 filas |
| Muestras de tiempo | 1 medición de 60 minutos | 6 muestras, cinco de cero |
| Mediana de tiempo del ejemplo | 60 minutos | 0 minutos |

No aumenta el importe vendido, porque los hijos valen cero comercialmente. Sí distorsiona unidades, tasas, alertas de cobertura y productividad. El lector de medianas de Producción y la evaluación histórica de ETA tampoco excluyen participaciones; pueden alimentar estimaciones futuras con ceros técnicos.

**Cierre:** filtrar raíces para métricas comerciales y operaciones físicas para producción. Auditar todos los agregados que consultan `OrdenTrabajoItem`/`OrdenTrabajoItemPaso`, incluyendo producto, clientes, equipo y ETA. No aplicar un filtro global que oculte componentes cuando se necesita su ejecución real.

Fuentes: [ventas](/Users/lucasgomez/gdi-saas/apps/api/src/reportes/ventas.service.ts:269), [productividad](/Users/lucasgomez/gdi-saas/apps/api/src/reportes/produccion.service.ts:193), [medianas](/Users/lucasgomez/gdi-saas/apps/api/src/produccion/produccion.service.ts:757), [ETA histórico](/Users/lucasgomez/gdi-saas/apps/api/src/eta/eta.service.ts:501). [Reproducción](/Users/lucasgomez/gdi-saas/output/auditoria-fase-4-2026-09-07/reproducir-reportes.cjs).

### H5 — Prioridad media: la factura detallada expone componentes internos

**Reproducido en la función real de preparación, sin emitir comprobantes.** Al facturar completamente una orden con descuento, el detalle contiene el kit y seis componentes internos de precio cero. Los importes cierran, pero el cliente recibe el despiece productivo como si fueran renglones vendidos.

La consulta de facturación trae todos los ítems y el preparador los transforma sin distinguir su relación padre–hijo.

**Cierre:** armar las líneas fiscales a partir de ítems comerciales raíz; preservar productos gratuitos legítimos. Verificar también presupuesto/PDF, comprobantes parciales y notas de crédito. No basta filtrar `precio > 0`.

Fuentes: [consulta de facturación](/Users/lucasgomez/gdi-saas/apps/api/src/administracion/comprobantes.service.ts:828), [preparación del detalle](/Users/lucasgomez/gdi-saas/apps/api/src/administracion/comprobantes.service.ts:1215). Evidencia en `facturaSimuladaSinEmitir` del [resultado](/Users/lucasgomez/gdi-saas/output/auditoria-fase-4-2026-09-07/reportes-reproduccion.json).

### H6 — Prioridad media: archivos válidos pueden quedar bloqueados al cotizar

**Reproducido pasando por importador, interpretación, serialización JSON y validador del DTO.** Seis fuentes de 1.000 puntos cada una, de 36.413 bytes por archivo, producen un cuerpo de 350.626 bytes. La interpretación funciona, pero `jobContextCotizacionValido` lo rechaza. Una fuente de la misma complejidad sí pasa.

El contexto arrastra geometría de fabricación y el recorrido genérico tiene límites de nodos/profundidad pensados para un contexto más pequeño. La validación termina antes de que el servidor pueda rehidratar las referencias guardadas. El riesgo aumenta con capas, entidades y múltiples piezas; no es sólo el tamaño original del DXF.

**Cierre:** enviar referencias compactas para geometrías persistidas y validar explícitamente los contratos geométricos, conservando límites de recursos. No resolverlo elevando indiscriminadamente todos los límites. Probar carga simple, seis fuentes, reemplazos y ocurrencias contra el endpoint real.

Fuentes: [validador](/Users/lucasgomez/gdi-saas/apps/api/src/motor-universal/cotizar.dto.ts:20), [recorrido del contexto](/Users/lucasgomez/gdi-saas/apps/api/src/motor-universal/cotizar.dto.ts:267). [Reproducción](/Users/lucasgomez/gdi-saas/output/auditoria-fase-4-2026-09-07/reproducir-validacion-fuentes.cjs), [resultados](/Users/lucasgomez/gdi-saas/output/auditoria-fase-4-2026-09-07/validacion-fuentes.json).

### H7 — Prioridad alta: el contrato de lotes no conserva todo el nivel anidado

**Brecha identificada por inspección de código; falta su reproducción funcional completa.** Al incorporar una cotización hija, el motor copia costos, pasos y componentes, pero no `hija.analisisNestingCompuesto`. La materialización de lotes sólo recorre los padres iniciales y lee su `cotizacionItem.trazabilidadJson`; los hijos no tienen ese vínculo. El visor también toma los grupos aplicados de la raíz.

Un compuesto que contiene otro compuesto puede conservar el costo optimizado del hijo sin conservar el lote operativo que permite ejecutarlo. Tener BOM recursiva no garantiza actualmente que el plan de fabricación sea recursivo.

**Cierre:** decidir y aplicar una semántica completa por ámbito: conservar, identificar y materializar lotes en cada nivel, o impedir explícitamente esa combinación antes de cotizar. No dejar el ahorro activo si se pierde su ejecución. Probar dos niveles y códigos de componentes/pasos repetidos entre ramas.

Fuentes: [proyección del hijo](/Users/lucasgomez/gdi-saas/apps/api/src/motor-universal/motor.service.ts:1571), [recorrido de lotes](/Users/lucasgomez/gdi-saas/apps/api/src/ordenes-trabajo/ordenes-trabajo.service.ts:5113), [planes comerciales](/Users/lucasgomez/gdi-saas/src/lib/plan-fabricacion-cotizacion.ts:28).

### H8 — Aceptación pendiente: el motor real no reprodujo el caso Puma de dos placas

Se activó la prueba de integración que la suite general omite. El validador confirma que las ocho partes caben en dos placas con los márgenes y separaciones del fixture. El motor real, con presupuesto de 120 segundos, devolvió tres placas; falla la expectativa de dos.

Esto demuestra que ese criterio de calidad no quedó satisfecho en esta ejecución. No demuestra que el layout devuelto sea inválido ni que toda búsqueda deba garantizar el óptimo. Hay que estabilizar o revisar explícitamente el criterio de aceptación y su presupuesto, sin confundir “terminó de calcular” con “alcanzó la calidad aprobada”.

Fuente: [prueba real](/Users/lucasgomez/gdi-saas/apps/api/src/workers/geometria/opennest-puma.spec.ts:36). [Registro de la corrida](/Users/lucasgomez/gdi-saas/output/auditoria-fase-4-2026-09-07/worker-real.log).

## 3. Verificaciones realizadas y límites

| Verificación actual | Resultado | Qué permite afirmar |
| --- | --- | --- |
| Frontend completo | 81 archivos, 697 pruebas aprobadas | Regresión automatizada web aprobada. |
| Backend completo | 240 archivos: 235 aprobados, 3 fallidos, 2 omitidos; 2.219 pruebas aprobadas, 4 fallidas y 4 omitidas | La suite general no está verde. No incluye todos los cruces encontrados. |
| Integración del motor con base sembrada | 87 pruebas aprobadas, incluidas composición/pricing | Se ejercitaron datos de prueba reales; no equivalen a ejecutar una OT industrial completa. |
| DAG/OT y ETA | 134 pruebas de OT/grafo y 40 de ETA aprobadas | Cobertura de reglas, transiciones, mocks y funciones puras; no cubría H1. |
| DXF nativo en Python | 12 pruebas aprobadas | Exportador CAD local comprobado, además de las pruebas web/API relacionadas. |
| Worker irregular real, opt-in | 1 prueba aprobada y 1 fallida | El caso de dos placas no fue reproducido por la búsqueda actual. |
| TypeScript web/API | Aprobado | Contratos compilables. |
| Builds web/API | Aprobados en copias temporales aisladas | Se evitó interferir con la app abierta. Los tres scripts Python necesarios están en el build API. |
| Migraciones desarrollo | Al día | El esquema local de trabajo contiene la migración nueva. |
| Base dedicada de pruebas | Falta `20260907010000_geometrias_producto_reutilizables`; tabla `GeometriaProducto` ausente | La suite general no puede acreditar persistencia integral de la biblioteca nueva. Ensayar la migración y el recorrido con archivos antes de cerrar. |
| `css:guard` | Falla: 43 clases globales fuera de la base | Deuda transversal existente; algunas clases pertenecen a componentes/producción. Clasificar y aislar; no actualizar la base sólo para silenciarlo. |

Los cuatro fallos generales se clasificaron:

- Uno espera el texto antiguo “rutas” cuando el sistema ya dice “flujos de producción”.
- Uno no contempla el nuevo valor normalizado `permitirReemplazo: false`.
- Dos validan directamente el objeto del importador, que contiene propiedades `undefined`; su versión serializada HTTP sí es aceptada para el archivo pequeño. Corregir la prueba para representar el contrato de transporte, manteniendo pruebas separadas del importador. Esto no resuelve H6.

Los benchmarks de placa/rollo siguen omitidos por configuración. La prueba real Puma se ejecutó aparte. No se realizó una campaña estadística de rendimiento ni se ensayó un despliegue remoto.

En la cuenta local del caso de referencia se encontraron **cero ítems hijos de OT, cero lotes operativos y cero lotes compartidos finalizados**. No hay allí evidencia persistida de ejecución completa de estas extensiones. Los documentos de GrafoNest también aclaran que sus pruebas de exhibidor terminaron en cotización, sin emitir la OT. Esto es una brecha de aceptación, no una prueba de que toda ejecución falle.

La cuenta sí dispone de los casos para completar esa aceptación: Cartel Backlight publicado v10; Kit de Vinilos v18 con dos piezas; Exhibidor de prueba v4 con seis piezas. La existencia/publicación del producto no se toma como aprobación de su ejecución.

## 4. Trabajo acotado para cerrar F4

No abrir otra ampliación de alcance. Resolver y demostrar estos paquetes:

1. **Operación ejecutable:** H1/H2/H7; compatibilidad de precedencias, contexto de hijos en las colas, una operación por lote y conservación multinivel.
2. **Lectura comercial y económica:** H3/H4/H5; raíces comerciales, costos recursivos, participaciones excluidas de mediciones y documentos al cliente correctos.
3. **Archivos y calidad del nesting:** H6/H8; transporte de geometrías complejas, aceptación del worker y correspondencia impresión–corte–DXF.
4. **Cierre técnico:** migración en pruebas, cuatro expectativas desactualizadas, CSS global relacionado, documentación e integración de todos los cambios locales.
5. **Aceptación de recorridos completos:** ejecutar la matriz siguiente y conservar evidencia reproducible de lectura posterior, sin recalcular maestros históricos.

| Recorrido | Comprobación de salida |
| --- | --- |
| Producto simple lineal histórico | Cotizar → guardar → emitir OT de prueba → ejecutar → finalizar. Secuencia, precio, material, PDF/factura y reporte equivalentes. |
| Backlight | Dimensiones 3D, outputs Bastidor→Lona, opcional y condicional, tercerización, ramas simultáneas, convergencia y nodo compuesto con un solo estado. Rechazar inicio prematuro y reapertura con descendiente iniciado. |
| Kit de Vinilos | 1/10/50 unidades generan 3/30/150 piezas; editar cantidad/medidas cuando corresponda. Probar grupo inicial activo/inactivo y adicionales sin multiplicaciones dobles. Guardar, reabrir y ejecutar conservando el desglose. |
| Exhibidor DXF multipieza | 1/10/50/51 exhibidores generan 9/90/450/459 piezas; conservar identidad, cantidades y capas. Impresión y corte mantienen exactamente las mismas posiciones y transformaciones. Verificar DXF reimportado y lectura desde OT. |
| Lotes compatibles/incompatibles | Ahorro real sin doble preparación; separación por configuración y por precedencias. Una operación en tablero/simulador. Reintentos concurrentes no duplican operación, tramos ni consumo. |
| Compuesto de dos niveles | Conservación de contexto, revisión, lote, costo y archivos en cada nivel. Cambiar maestros después de vender y comprobar que la OT antigua conserva lo cotizado. |
| Áreas vecinas sobre esas mismas órdenes | Unidades y líneas comerciales correctas, costos variables completos, tiempos sin aliases, factura con descuento sin despiece interno, tracking/documentos/permisos y acceso entre cuentas. |

La comprobación de inventario en F4 debe asegurar que no se duplican proyecciones/consumos existentes. No exige adelantar reservas y movimientos físicos completos de F9. Los gates manuales de material/calidad continúan siendo válidos en F4 si bloquean correctamente, registran al supervisor y conservan auditoría.

## 5. Qué queda fuera del cierre y a dónde va

| Trabajo | Destino |
| --- | --- |
| Centro de corte con plan operativo propio, estados, revisiones, aprobación/liberación y cola | F5 |
| Consolidar ítems de diferentes órdenes/clientes; reanidar con revisión operativa | F5 |
| Herramientas, pasadas y tiempos por recorrido/capa; vínculo operativo print/cut/TAP | F5, usando las entidades conservadas ahora |
| Consumo planificado frente a real y reserva vinculada al plan | F5 y conexión con F9 |
| División/fusión de lotes, cantidades buenas/rechazadas, producción parcial | F6 |
| Evidencia formal de inspección, calidad y reproceso | F7 |
| Reservas/asignación física e inventario avanzado | F9 |
| “Continuar optimizando”, nuevas estrategias o mejoras que exceden la aceptación acordada | Backlog de GrafoNest/F5; no condición adicional automática de F4 |

Los patrones, archivos y snapshots actuales son una base útil para F5. Todavía no sustituyen `PlanNesting` con ciclo de vida, liberación, revisiones e identidad entre órdenes. No se encontró ese modelo operativo en el esquema actual.

**Condición para avanzar:** resolver los bloqueos de integración, dejar la regresión y migración de pruebas verificadas, aprobar la matriz operativa y actualizar el estado del plan con esa evidencia. No hace falta incorporar todas las mejoras posibles de nesting antes de pasar a otros temas.

## 6. Evidencia reproducible

[Carpeta de evidencias](/Users/lucasgomez/gdi-saas/output/auditoria-fase-4-2026-09-07) con resultados JSON, registros de compilación y scripts. Desde la raíz:

```sh
node output/auditoria-fase-4-2026-09-07/reproducir-reportes.cjs
node output/auditoria-fase-4-2026-09-07/reproducir-lote-precedencias.cjs
node output/auditoria-fase-4-2026-09-07/reproducir-validacion-fuentes.cjs
npx vitest run
```

Desde `apps/api`:

```sh
npx jest --runInBand
OPENNEST_INTEGRATION=1 npx jest --runInBand src/workers/geometria/opennest-puma.spec.ts
.venv-opennest/bin/python -m unittest discover -s src/productos-servicios/geometrias/python -p 'test_*.py'
```

La configuración de Jest fuerza la base de prueba. Los dos scripts que crean datos fijan explícitamente `gdi_saas_test` y revierten sus transacciones. Las reproducciones documentan el comportamiento observado: deberán convertirse en pruebas de regresión con expectativas correctas al implementar las correcciones.
