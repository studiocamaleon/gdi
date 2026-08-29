# Evaluación de preparación de Grafoprint para operaciones shopper / in-store

**Caso de referencia:** Visual Ilusión  
**Fecha del análisis:** 29 de agosto de 2026  
**Rama:** `visual-ilusion/analisis`  
**Alcance del informe recibido:** puntos 1 a 29 completos y comienzo del punto 30. El archivo adjunto termina literalmente en `Log`, dentro de “Fecha objetivo calculada hacia atrás”; cualquier contenido posterior no estaba disponible.

## 1. Resumen ejecutivo

### Veredicto

Grafoprint **sí está arquitectónicamente bien encaminado para evolucionar hacia este tipo de operación sin duplicar el producto**. No hace falta crear hoy un “GrafoShopper” separado, ni copiar frontend, backend, base o motor de costeo.

Pero hay que distinguir dos afirmaciones:

1. **La base técnica es reutilizable y valiosa.** Productos configurables, rutas versionadas, pasos condicionales, snapshots de cotización, OT por ítems, ejecución por pasos, estaciones, máquinas, calendarios, ETA con capacidad finita, tercerizaciones, archivos, inventario transaccional y seguimiento público ya existen en código.
2. **La operación shopper todavía no está resuelta.** Campañas, BOM ejecutable, DAG productivo, lotes cuantitativos, calidad/reproceso, kits, packing, multidestino y logística son dominios nuevos; no son simples pantallas sobre las tablas actuales.

La conclusión práctica es:

> Grafoprint no está “a una tanda de formularios” de cubrir Visual Ilusión, pero tampoco está frente a una reescritura. Está frente a una expansión modular importante sobre un núcleo correcto.

### Evaluación sintética

| Dimensión | Evaluación | Lectura |
|---|---:|---|
| Base comercial: cliente, presupuesto, OT, cobro | 8/10 | Sólida y separada correctamente por entidades y snapshots. |
| Catálogo, costeo y multitecnología | 8/10 | Es uno de los activos más fuertes del sistema. |
| Ejecución productiva lineal | 7/10 | Pasos reales, estaciones, tiempos, bloqueos, terceros y ETA ya operan. |
| Ejecución productiva en grafo, componentes y lotes | 2/10 | La secuencia lineal es hoy una invariante explícita. |
| Inventario y abastecimiento | 4/10 | Stock/Kardex existen; reservas, MRP y OC no. |
| Calidad, incidencias y reprocesos | 1/10 | Hay bloqueo/reapertura de pasos, pero no modelo de calidad o no conformidades. |
| Shopper fulfillment: kits, packing y multidestino | 1/10 | Prácticamente nuevo. |
| Logística e instalación de campo | 2/10 | Entrega de mostrador y proceso de instalación existen de forma parcial, no el dominio logístico. |
| Extensibilidad técnica sin romper clientes actuales | 8/10 | Alta, si lo nuevo es opcional y relacional, y se preservan snapshots y rutas lineales. |
| Ajuste funcional actual a Visual Ilusión | 4/10 | Buen cotizador/MIS gráfico, aún no plataforma end-to-end de campañas retail. |

### Qué tan cerca / qué tan lejos

- **Cerca:** catálogo industrial, materiales, máquinas, costeo, múltiples tecnologías, rutas alternativas, pasos opcionales/condicionales, tercerización por paso, ejecución en tablero, calendarios, capacidad y ETA.
- **A distancia media:** campaña/proyecto, aprobación genérica, versionado de arte, planificación visual, reservas de stock, compras vinculadas, orden de instalación.
- **Lejos:** DAG productivo real, subproductos ejecutables, lotes parciales con yield, incidencias/retrabajo, kits serializados, picking/packing, distribución multidestino y trazabilidad logística por bulto.

## 2. Qué existe realmente hoy

El diagnóstico no se basó sólo en documentos de diseño. Se contrastaron schema, servicios, endpoints, UI y pruebas.

### 2.1 Arquitectura general

El sistema es un **monolito modular**, adecuado para esta etapa:

- Next.js 16 / React 19 en frontend.
- NestJS 11 en API.
- PostgreSQL + Prisma.
- Módulos separados para comercial, presupuestos, OT, producción, inventario, maquinaria, costos, proveedores, administración, archivos, ETA, reportes e integraciones.
- Aislamiento multi-tenant reforzado por una extensión de Prisma que inyecta/verifica `tenantId`.
- Snapshots inmutables al cotizar y materialización separada al ejecutar.

Esta forma es favorable: los nuevos dominios pueden agregarse como módulos dentro del mismo producto sin convertirlos en microservicios ni bifurcar la aplicación.

### 2.2 Fortalezas estructurales relevantes

1. **Cotización y OT ya son conceptos diferentes.** La cotización conserva el snapshot económico/productivo y la OT vive su propio ciclo. Es exactamente la clase de separación que permite agregar Campaña por encima sin deformar ninguna de las dos.
2. **Una OT ya admite múltiples ítems.** Cada ítem referencia el snapshot de su línea cotizada y materializa sus pasos de ejecución.
3. **El catálogo ya funciona como receta de costeo.** Las rutas contienen pasos; los pasos tienen materiales por roles (`SUSTRATO`, `COMPONENTE`, `CONSUMIBLE`, `PACKAGING`), máquinas candidatas, tiempos, centros de costo, cargos y tercerización.
4. **Las rutas tienen versionado.** Un cambio futuro de ruta no altera lo ya cotizado/emitido.
5. **Los pasos opcionales y condicionales existen.** `modoActivacion`, `condicionActivacionJson` y dependencias de activación permiten “lleva laminado / no lleva laminado” y arrastre de opcionales.
6. **La ejecución del taller es real.** Cada paso materializado tiene estado, bloqueos, operador/mesa, tramos de tiempo, máquina, estimado, realizado y fuente del tiempo.
7. **La tercerización está bien ubicada.** Es una propiedad del paso, no del producto entero. El paso tiene proveedor, plazo y un ciclo de compra simplificado.
8. **La capacidad y ETA ya superan un tablero decorativo.** Existen estaciones, puestos concurrentes, calendarios, feriados, simulación con capacidad finita, competencia por máquina, lead time de terceros y métricas históricas de precisión.
9. **El inventario base es transaccional.** Existen almacenes, ubicaciones, saldo, movimientos, transferencias y Kardex con costo promedio.
10. **Archivos, QR y links públicos ya tienen infraestructura.** Hay almacenamiento local/R2, archivos vinculables a varias entidades, QR de OT y flujo de entrega de mostrador por escaneo.

### 2.3 Limitaciones estructurales que importan

1. **La ruta de ejecución es lineal por diseño.** `OrdenTrabajoItemPaso.indice` y `pasoEjecutable()` exigen que todos los índices anteriores estén hechos. No se pueden ejecutar ramas paralelas ni hacer una convergencia A+B+C → armado.
2. **Los “componentes” actuales son consumos, no subórdenes.** Un slot COMPONENTE permite costear/descontar una estructura, pero no crea un componente con cantidad, ruta, estado, lote, archivos y convergencia propios.
3. **No existe unidad de lote productivo.** “Completar lote” en el tablero significa completar varios trabajos juntos en una tanda de máquina; no equivale a dividir una OT de 5.000 unidades en cuatro lotes trazables.
4. **El stock sólo conoce disponible físico.** No hay reservas, compromisos, en compra, asignaciones por OT/campaña ni demanda calculada.
5. **Tercerización no es todavía compras completas.** Hay seguimiento del paso (`pendiente → pedido → recibido → entregado`), pero no solicitud de compra, OC, recepción parcial, conciliación o vínculo contable completo.
6. **Archivo no tiene semántica industrial de versión/aprobación.** Hay adjuntos y existe revisión para recorridos vectoriales, pero no un `ArchivoMaestro → Revisiones → Aprobada → Liberada a producción` genérico.
7. **No hay fulfillment retail.** Kit, destino, caja, pallet, picking, packing, transportista, POD e instalación de campo no están modelados.

## 3. Matriz de brechas por requerimiento

Leyenda:

- **Verde:** base implementada y extensión localizada.
- **Amarillo:** base parcial; necesita nueva persistencia/reglas, pero reutiliza mucho.
- **Rojo:** dominio nuevo o cambio transversal.

| # | Capacidad solicitada | Estado | Qué se reutiliza | Brecha principal | Complejidad |
|---:|---|---|---|---|---|
| 1 | Mantener el corazón de Grafo | Verde | Cliente, cotización, OT, producción, entrega, cobro ya están separados | Hacer todos los agregados opcionales y evitar estados “shopper” dentro de OT base | Baja como decisión; alta disciplina |
| 2 | Proyecto / campaña | Amarillo | Cliente, archivos, cotizaciones, OT, reportes | Nueva entidad agregadora, permisos, dashboard, hitos y métricas | Media |
| 3 | Múltiples órdenes por campaña | Amarillo | Una cotización ya relaciona OTs y una OT varios ítems | Relación flexible campaña↔cotización↔OT, ampliaciones/revisiones sin imponer cardinalidad 1:1 | Media |
| 4 | BOM / receta avanzada | Amarillo/Rojo | Ruta, slots de materiales, máquinas, tiempos, tercerización, archivos de producto | BOM versionada y ejecutable; distinguir material consumible, componente comprado y subproducto fabricado | Alta |
| 5 | Rutas dinámicas/condicionales | Verde/Amarillo | Rutas alternativas, pasos opcionales/condicionales, JsonLogic, dependencias de activación | Mejorar autoría/validación; hoy la ruta resultante sigue siendo lineal | Media |
| 6 | Paralelismo y convergencia | Rojo | Pasos, estados, estaciones, ETA y snapshots | Reemplazar precedencia por índice con aristas; scheduler, tablero y transiciones deben entender DAG | Muy alta |
| 7 | Subproductos/componentes | Rojo | Patrón de slots COMPONENTE y productos compuestos simples | Nodo productivo hijo con ruta, cantidad, estado, costos, archivos y relación de ensamble | Muy alta |
| 8 | Prototipos y muestras | Amarillo | Archivos, eventos, usuarios, links públicos | Entidad de desarrollo/revisión, comentarios, estados y aprobación; bloqueo de producción | Media |
| 9 | Versionado de archivos | Amarillo | Storage, metadatos, hashes, adjuntos; precedente `RecorridoVectorialRevision` | Archivo maestro, revisiones, roles, estado aprobada/obsoleta y puntero liberado | Media/Alta |
| 10 | Motor genérico de aprobaciones | Amarillo | Aprobación de presupuesto por umbral, roles, eventos | Aprobaciones polimórficas, reglas por tipo, múltiples aprobadores y gates productivos | Alta |
| 11 | Mesa de corte como centro productivo | Verde/Amarillo | Estaciones, máquinas, perfiles, cola, duración, nesting, recorrido SVG→TAP | Job de corte específico con herramienta/pasadas/metros; telemetría y planificación propia | Media |
| 12 | Plan de nesting persistente | Amarillo | Motores de nesting, métricas, revisiones vectoriales, consolidación | Entidad genérica de plan, revisión, piezas, placas/rollos, scrap y vínculo con consumo real | Media/Alta |
| 13 | Lotes productivos | Rojo | OT ítem y pasos | Lote con cantidad, genealogía, estado por paso, ubicación, división/fusión y entregabilidad parcial | Muy alta |
| 14 | Producción parcial / yield | Rojo | Paso, tramos, eventos | Entradas, buenas, rechazo, rehacer, scrap, balance cuantitativo e invariantes | Muy alta |
| 15 | Incidencias / reproceso | Rojo | Bloqueos, reapertura, eventos y costos estimados | No conformidad, causa, acción, rama de retrabajo, costo real y reincorporación | Alta/Muy alta |
| 16 | Calidad / QC | Amarillo | Familia de paso `control_calidad`, archivos/eventos | Plantillas de checklist, inspección por lote/muestra, resultados y gates | Media |
| 17 | Variantes con matriz | Rojo/Amarillo | Variantes de materia prima y atributos JSON | Curva cantidad por talle/color que costee cada blank y consolide procesos comunes | Alta |
| 18 | Kits | Rojo | Ítems de OT y rol PACKAGING | Definición de kit, requerimiento por campaña/destino, serialización y disponibilidad por componentes | Muy alta |
| 19 | Distribución multidestino | Rojo | Direcciones del cliente y entrega simple por ítem | Destinos de campaña, asignaciones, cantidades/kits, estados y entregas parciales | Alta |
| 20 | Picking / packing | Rojo | Inventario/QR/entrega por escaneo | Orden de picking, unidad logística, validación de completitud, caja/pallet y cierre | Muy alta |
| 21 | Etiquetas y QR multinivel | Amarillo | Librería QR, QR de OT, scanner global, links públicos | Identidad estable para lote/pieza/caja/kit/pallet y resolución segura por tipo | Media después de crear entidades |
| 22 | Logística | Rojo/Amarillo | Fecha de entrega, cargos por bulto/km, archivos y tracking público | Envío, transportista, ventanas, bultos, tracking, remito, POD, costo y estados | Alta |
| 23 | Instalaciones | Amarillo/Rojo | Familia `instalacion_in_situ`, empleados, calendario, archivos | Orden de instalación, cuadrilla, agenda, materiales, checklist, fotos, firma y cierre | Alta |
| 24 | Stock físico/reservado/disponible/en compra | Amarillo | Stock por ubicación, ledger, Kardex, variantes | Reserva/asignación y oferta futura; disponibilidad debe ser derivada transaccionalmente | Alta |
| 25 | Estados de stock comprometido | Amarillo/Rojo | Movimiento de inventario y referencias genéricas | Ledger de reservas/allocations y consumo por lote/OT, scrap y recuperación | Alta |
| 26 | Compras vinculadas a proyecto | Rojo/Amarillo | Proveedores, egresos/CxP, tercerización y movimientos con origen COMPRA | Requisición, OC, líneas, recepción parcial, asignación a demanda y conciliación | Muy alta |
| 27 | Tercerizaciones | Verde/Amarillo | Implementada por paso, proveedor, costo y plazo; seguimiento operativo | Envío/recepción parcial, documentación, OC y costo real conciliado | Media |
| 28 | Capacidad productiva | Verde/Amarillo | Calendarios, puestos, estaciones, máquinas, list-scheduling, históricos | Plan de mano de obra por skill/turno, mantenimiento y capacidad comprometida por campaña | Media |
| 29 | Planificador visual | Amarillo | El motor ya devuelve un plan trazado con fechas/estaciones | Persistir escenarios/decisiones, edición y replanificación; Gantt es la vista, no el núcleo | Media/Alta |
| 30 | Planificación hacia atrás | Amarillo | ETA hacia adelante, calendarios, lead times y capacidad | Backward scheduling desde instalación/entrega, buffers y propagación de fechas objetivo | Alta |

## 4. Análisis de compatibilidad: cómo agregarlo sin romper Grafo

### 4.1 Proyecto/Campaña debe ser un agregado opcional

Modelo conceptual recomendado:

```text
Cliente
  └─ Proyecto/Campaña (opcional)
       ├─ Cotizaciones (0..n)
       ├─ Órdenes de trabajo (0..n)
       ├─ Entregables/productos de campaña
       ├─ Archivos y aprobaciones
       ├─ Demanda/reservas/compras
       ├─ Destinos y kits
       └─ Costos, facturación y rentabilidad agregados
```

Para una gráfica chica, `proyectoId = null` y el flujo actual permanece idéntico. Para una operación avanzada, el proyecto agrupa, no reemplaza.

No conviene que Campaña sea una OT gigante ni que la OT se convierta en campaña. Eso dañaría numeración, estados, facturación, entregas parciales y trazabilidad ya existentes.

### 4.2 Separar definición de producto de ejecución

Hay tres niveles distintos que hoy están parcialmente solapados:

1. **Receta maestra versionada:** cómo se fabrica normalmente un producto.
2. **Snapshot cotizado/ordenado:** qué se vendió y con qué receta/costo congelado.
3. **Ejecución:** lotes, consumos reales, tareas, incidencias y resultados.

La evolución debe conservar esta separación. La BOM maestra no puede mutar una OT en vuelo; la OT debe materializar una revisión inmutable, como hoy hace con rutas y costos.

### 4.3 Introducir DAG sin romper las rutas lineales

No conviene reemplazar de golpe `indice` por un grafo. La estrategia segura es:

- Mantener rutas existentes como `topologia = LINEAL`.
- Agregar una revisión de ruta con `nodos` y `aristas` para `topologia = DAG`.
- Compilar una ruta lineal a aristas triviales `A→B→C`; así ambos modelos usan el mismo ejecutor futuro.
- Materializar en la OT el snapshot de nodos y dependencias.
- Definir “ejecutable” como: nodo pendiente + todos sus predecesores satisfechos + gates materiales/aprobaciones/proveedor cumplidos.
- Actualizar ETA y tablero para varias fronteras activas por ítem.

El punto de mayor riesgo no es dibujar el grafo; es cambiar las invariantes de ejecución, reabrir, finalizar, medir progreso, programar capacidad y tratar retrabajos.

### 4.4 No usar JSON como sustituto de dominios operativos

El repositorio usa JSON correctamente para snapshots, configuraciones variables y atributos técnicos. No debería usarse para esconder entidades con concurrencia y ciclo propio.

Deben ser relacionales, como mínimo:

- proyecto/campaña;
- revisión de receta/BOM y nodos/aristas;
- lote productivo y movimientos/divisiones;
- inspección de calidad/no conformidad/reproceso;
- reserva/asignación de material;
- requisición/OC/recepción;
- kit, unidad logística y contenido;
- destino, envío e instalación.

Si estas piezas se guardan como grandes JSON dentro de OT o campaña, aparecerán problemas de actualización concurrente, consultas, auditoría, integridad cuantitativa y reporting.

### 4.5 El progreso no puede seguir siendo sólo “pasos hechos / pasos totales”

Con lotes y producción parcial se necesitan al menos tres ejes:

- progreso de precedencia: nodos terminados;
- progreso cuantitativo: unidades buenas / objetivo;
- progreso de fulfillment: unidades o kits completos/despachados/entregados.

El porcentaje de campaña debe declarar de qué eje habla o usar un resumen por dimensión. Un único `progresoPct` se volvería engañoso.

## 5. Arquitectura de módulos recomendada

Todo dentro del mismo repositorio/producto, con límites de dominio claros:

### 5.1 Núcleo que se conserva

- CRM / clientes.
- Catálogo y motor universal de costeo.
- Presupuestos.
- OT comercial/administrativa.
- Facturación, cobros, egresos y reportes.
- Archivos, usuarios, permisos y multi-tenancy.

### 5.2 Extensiones industriales compartidas por cualquier gráfica

- Proyectos/campañas.
- Recetas/BOM versionadas.
- Rutas DAG y gates.
- Lotes y producción parcial.
- Calidad, incidencias y reproceso.
- Reservas de material y compras.
- Planificación/capacidad.
- Instalaciones.

Estas no son exclusivamente shopper: sirven para cartelería, packaging, textil, stands, señalética y producción gráfica compleja.

### 5.3 Paquete funcional “Shopper / Retail Operations”

- Kits.
- Matriz destino × entregable × cantidad.
- Picking/packing.
- Unidades logísticas (caja/pallet).
- Distribución multidestino.
- Etiquetas retail y QR.
- Prueba de entrega e instalación por local.

Este paquete puede habilitarse por capacidades/plan/configuración del tenant y aparecer sólo cuando se usa. Es una vertical dentro de Grafoprint, no otro sistema.

## 6. Orden recomendado de construcción

### Fase 0 — Validación operacional con Visual Ilusión

Antes de modelar, pedir ejemplos reales anonimizados:

- una campaña completa;
- planilla de productos/destinos;
- BOM o despiece de un exhibidor;
- revisiones y aprobación de arte/muestra;
- orden o cola de producción;
- packing list/remito;
- incidencia/reimpresión real;
- compra o tercerización vinculada.

El objetivo es validar vocabulario, cardinalidades y excepciones. En especial: qué llaman proyecto, campaña, pedido, OT, lote, kit, bulto y entrega.

### Fase 1 — Campaña como capa de coordinación

Entregar valor sin tocar el motor productivo:

- Proyecto/Campaña opcional.
- Vinculación n:n o relaciones explícitas con cotizaciones y OTs.
- Hitos, fecha compromiso, responsables, archivos y timeline.
- Dashboard agregado usando datos ya existentes.
- Ampliaciones/revisiones comerciales dentro de campaña.

Esta fase permite que Visual Ilusión deje de mirar 37 OTs aisladas, aun antes de tener kits o lotes.

### Fase 2 — Liberación segura a producción

- Archivo maestro y revisiones.
- Tipos de archivo (print, cut, render, plano, instructivo).
- Aprobaciones configurables de diseño/muestra/ingeniería/liberación.
- Gates que impiden iniciar nodos mientras falte una aprobación.
- Prototipo/muestra como flujo previo a producción.

Es de alto valor porque reduce errores caros sin exigir todavía un MES completo.

### Fase 3 — BOM ejecutable y DAG

- Receta versionada con materiales, componentes fabricados/comprados y recursos.
- Nodos/aristas y múltiples fronteras activas.
- Convergencia de componentes a ensamble.
- Adaptación del tablero, finalización, reapertura y ETA.
- Plan de nesting persistido como resultado versionado de un nodo.

Es el cambio técnico más delicado y debe tener migración compatible con rutas lineales.

### Fase 4 — Lotes, calidad y reproceso

- División/fusión de lotes.
- Cantidades de entrada/buenas/rechazadas/retrabajo.
- Checklist QC versionado.
- Incidencias, causa, costo y rutas de reproceso.
- Trazabilidad de material/lote si el negocio realmente la necesita.

### Fase 5 — Materiales y abastecimiento

- Reservas y asignaciones.
- Demanda por campaña/OT/lote.
- Déficit y propuestas de compra.
- Requisición, OC, recepción parcial y asignación.
- Extender tercerizaciones con documentación y costo real.

### Fase 6 — Fulfillment shopper

- Definición y demanda de kits.
- Destinos y matriz de distribución.
- Picking/packing con control de completitud.
- Caja/pallet/etiqueta/QR.
- Envíos, tracking, remito y comprobante.
- Órdenes de instalación y prueba de ejecución.

No conviene empezar por esta fase sin lotes/unidades disponibles: el packing necesita saber qué unidades buenas existen y dónde están.

## 7. Riesgos principales

### 7.1 Romper el flujo simple por convertir todo en obligatorio

Mitigación: relaciones opcionales, módulos habilitables y defaults equivalentes al comportamiento actual. Una OT sin campaña, BOM DAG, lote explícito ni kit debe seguir funcionando como hoy.

### 7.2 Doble fuente de verdad entre snapshot y receta viva

Mitigación: toda OT congela la revisión exacta de receta, ruta, aprobaciones requeridas y BOM. Cambiar el maestro sólo afecta trabajos futuros o una migración explícita/auditada.

### 7.3 Contabilidad de cantidades inconsistente

Con lotes, scrap, reproceso y kits, una suma mal diseñada hace que existan más unidades que las fabricadas.

Mitigación: ledger cuantitativo e invariantes duras; cada división conserva cantidad, cada consumo/resultado es auditable y una unidad no puede estar simultáneamente en dos estados físicos incompatibles.

### 7.4 Mezclar “lote de máquina” con “lote productivo”

La tanda actual de nesting/consolidación agrupa trabajos para ejecutar una máquina. El lote solicitado divide la cantidad física de una orden. Deben ser entidades diferentes que pueden vincularse.

### 7.5 Planificador visual sin un scheduler confiable

Un Gantt editable construido antes de definir dependencias, capacidad, calendarios y estados se vuelve una segunda verdad manual.

Mitigación: el Gantt debe ser una proyección del plan calculado; las decisiones manuales se guardan como restricciones/prioridades, no como barras desconectadas.

### 7.6 Crear demasiado alcance antes de validar la operación real

El informe describe una plataforma amplia que combina MIS, ERP, MES ligero, WMS ligero, compras, logística e instalaciones. Implementarla entera sin observar casos reales puede producir un sistema conceptualmente elegante pero operativo en el vocabulario equivocado.

Mitigación: pilotear cada bloque con una campaña real y mantener un “walking skeleton” end-to-end.

## 8. Estimación de magnitud

Estas cifras son rangos de planificación, no compromisos, y suponen un equipo estable de **dos desarrolladores full-stack fuertes**, participación continua de producto/UX y QA, más acceso semanal a usuarios de Visual Ilusión.

| Alcance | Rango orientativo |
|---|---:|
| Campaña + dashboard + agrupación de cotizaciones/OT | 6–10 semanas |
| Versionado de arte + aprobaciones + prototipo/muestra | 8–12 semanas |
| BOM ejecutable + DAG + adaptación de tablero/ETA | 14–22 semanas |
| Lotes + parcialidad + QC + incidencias/reproceso | 14–22 semanas |
| Reservas + demanda + compras/recepciones | 10–16 semanas |
| Kits + multidestino + packing + logística básica | 14–22 semanas |
| Instalaciones de campo completas | 6–10 semanas |

Hay solapamientos, pero no todos pueden paralelizarse porque comparten invariantes de OT, cantidades y ejecución.

- **Piloto de alto valor para Visual Ilusión:** 4–6 meses si se acota a campaña, archivos/aprobaciones, dashboard, destinos simples y visibilidad; sin prometer todavía DAG/lotes/packing completo.
- **Núcleo industrial robusto:** 8–12 meses.
- **Cobertura amplia del informe, endurecida para producción:** 12–18 meses.

Con una sola persona, el plazo no se duplica de manera perfectamente lineal: aumenta también el riesgo y el costo de contexto. Con más de tres o cuatro personas antes de cerrar el modelo, la coordinación puede reducir el beneficio de paralelizar.

## 9. Grafoprint ampliado vs. GrafoShopper separado

### Recomendación: un solo producto, con una vertical modular

No recomiendo duplicar el proyecto. Recomiendo:

- una sola base de código;
- un solo modelo de cliente/producto/cotización/OT/costos/cobros;
- módulos de operaciones avanzadas habilitables;
- navegación y onboarding por perfil de negocio;
- presets/plantillas shopper;
- una edición o paquete comercial “Shopper / Retail Operations”, si comercialmente conviene.

### Por qué un fork sería perjudicial

Un “GrafoShopper” clonado heredaría inmediatamente todo lo que ambos productos necesitan:

- autenticación, tenants y permisos;
- clientes y proveedores;
- inventario y materiales;
- motor de costeo;
- productos y rutas;
- presupuestos y OT;
- archivos;
- estaciones, máquinas, tiempos y ETA;
- administración, facturación, cobros y reportes.

Cada corrección de costeo, seguridad, facturación o inventario tendría que replicarse. Con el tiempo, migraciones y contratos divergirían y una mejora industrial útil para ambos quedaría atrapada en una rama de producto.

### Cuándo sí separar algo

Separar sólo si aparece alguno de estos hechos, no por anticipación:

1. Producto, pricing, ventas y roadmap tienen equipos/mercados realmente independientes.
2. Los dominios compartidos bajan a una porción pequeña del total.
3. Hay requerimientos regulatorios o de despliegue incompatibles.
4. La carga de procesamiento necesita un servicio especializado.

Incluso en esos casos, la primera separación razonable sería un worker de cálculo/nesting o una aplicación móvil de piso/instalación consumiendo la misma API; no clonar todo Grafoprint.

### Decisión sugerida de naming

- **Producto:** Grafoprint / Grafo.
- **Capacidad o edición:** Operaciones avanzadas, Campañas Retail o Shopper Operations.
- **Plantillas:** POP, exhibidores, campañas multidestino, textil promocional.

Así el sistema se amplía sin obligar a una gráfica pequeña a ver complejidad que no usa.

## 10. Recomendación final

1. **No bifurcar.** La base existente justifica construir encima.
2. **No atacar las 30 capacidades como una lista plana.** Son cuatro programas: coordinación de campaña, ejecución industrial, abastecimiento y fulfillment shopper.
3. **Empezar por Campaña + liberación de arte/aprobaciones.** Es valor visible, riesgo moderado y usa gran parte del sistema actual.
4. **Diseñar juntos BOM, DAG y lotes antes de programarlos.** Son el núcleo que condiciona calidad, reproceso, capacidad, kits y packing.
5. **Tratar kits/packing/multidestino como una vertical modular.** Deben consumir producción e inventario, no reinventarlos.
6. **Pilotear con datos reales de Visual Ilusión.** Una campaña completa vale más para el diseño que diez pantallas conceptuales.

La posición actual de Grafoprint es favorable: ya resolvió varias de las piezas difíciles y generalizables. El salto pendiente es grande, pero es una evolución coherente del producto, no una desviación que obligue a empezar otro sistema.

## 11. Evidencia técnica principal revisada

- `apps/api/prisma/schema.prisma`: modelos de productos, rutas, pasos, materiales, stock, cotizaciones, OT, pasos ejecutables, ETA, archivos y tercerización.
- `apps/api/src/ordenes-trabajo/ordenes-trabajo.service.ts`: materialización, secuencia, estados, tramos, compra tercerizada, completado por tanda y tracking.
- `apps/api/src/eta/`: simulación con capacidad finita, snapshots e indicadores históricos.
- `apps/api/src/inventario/`: stock, movimientos, transferencias y Kardex.
- `apps/api/src/productos-servicios/` y `apps/api/src/motor-universal/`: configuración de pasos, rutas, materiales, máquinas, tercerización, costeo y nesting.
- `apps/api/src/archivos/`: adjuntos, storage local/R2, visibilidad y seguridad.
- Documentación de diseño sobre tablero, estaciones, capacidad, ETA, inventario, productos compuestos, tercerización, merchandising y pasos componibles.

### Verificación ejecutada

- Build del API NestJS: correcto.
- 5 suites focalizadas: correcto.
- 124 pruebas pasaron sobre OT, rutas versionadas, ETA/capacidad e inventario.

