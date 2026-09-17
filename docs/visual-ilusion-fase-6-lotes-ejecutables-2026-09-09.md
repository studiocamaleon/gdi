# F6 — Lotes ejecutables, rutas y archivos

Fecha: 09/09/2026. Rama: `codex/f6-entregas-planificacion`.

## Resultado

Una distribución aceptada de 200 exhibidores en cuatro entregas de 50 genera
cuatro lotes de fabricación completa. Cada lote tiene cantidad, fecha, ruta,
componentes y layouts propios. La OT conserva un único ítem comercial de 200 y
su precio; los trabajos técnicos no suman una segunda venta.

En borrador se guardan los lotes y sus cálculos. Al emitir se incorporan los pasos
al taller. En una OT pendiente, guardar la distribución adopta las rutas en la
misma transacción que registra la elección. No se ejecuta otra búsqueda de
nesting durante ese guardado.

La pestaña Producción permite seleccionar lote y ampliar su plan. Carga sólo la
geometría del seleccionado, con sus cantidades y descargas. Impresión no ofrece
SVG/DXF de corte. El nombre exportado identifica el lote y las copias del layout.

El tablero identifica cada tarjeta con el lote y su cantidad, diferenciando la
ruta del producto de sus componentes. Las dependencias pendientes nombran la
operación, el trabajo y el lote real del predecesor; no infieren relaciones a
partir del nombre ni asumen que una entrega dependa de la anterior. El mismo
contexto se conserva en Kanban, por ítems, por estación y en el detalle. La cola de cada estación conserva la prioridad operativa y ordena tareas del mismo estado por fecha de entrega; ante igualdad usa el inicio planificado y un desempate estable. Mi mesa y pendientes compartidas utilizan el mismo orden.

## Persistencia y consistencia

- `FuenteProduccionEntrega`: cálculo y contexto congelados por cantidad y
  revisión, usando compresión y referencias compartidas de F4.
- `LoteProduccionEntrega`: vincula ese cálculo con el producto comercial,
  cantidad, fecha y trabajos técnicos. Un cálculo de 50 puede servir a cuatro
  lotes de 50 sin guardar cuatro fuentes idénticas.
- Rutas y dependencias se materializan con el mecanismo existente de recetas y
  componentes anidados. La geometría coincide con la aceptada por el usuario.
- Los inicios de la propuesta quedan como límites inferiores del ETA. No
  constituyen reservas firmes: cambios del taller pueden desplazar las fechas.
- El ETA del producto agrega todos sus lotes; acabar el primero no finaliza el
  pedido completo. Las condiciones documentales del producto alcanzan sus lotes.
- Reintentar no duplica lotes ni pasos. Comenzar otra propuesta conserva los
  lotes adoptados hasta guardar una nueva elección.
- Reemplazar o retirar exige producción pendiente, sin ejecución ni condiciones
  manuales/adjuntos que se perderían. Retirar restaura la fabricación original.
- Se mantiene la aceptación explícita cuando la distribución cambia layouts.
  Las propuestas anteriores sin cálculos durables requieren recalcularse una vez.
- El worker calcula sin cargar el módulo completo de órdenes; la adopción sólo
  se habilita en el API.

## Validación

- 108 pruebas de backend en 14 suites: planificación, cantidades, layouts,
  vinculación previa, lotes, ETA, documentación y regresión de componentes.
- 30 pruebas de frontend: distribución, fechas y ETA comercial.
- Compilación API, TypeScript frontend, lint de archivos nuevos y `css:guard`.
- Caso con capturas reales del exhibidor y recetas aisladas: cuatro lotes,
  cuatro componentes, 16 pasos y 12 dependencias internas. Cada lote conserva
  32 placas, cinco layouts y 450 piezas; el importe comercial no se multiplica.
- Reintento, borrador/emisión, restauración, rechazo sin aceptación/fuente o con
  receta distinta y bloqueo de sustitución con trabajo iniciado.
- Navegación en Chrome sobre un borrador temporal: selección del lote B,
  ampliación conservando selección, rutas, fechas y descargas.
- DXF descargado: 92 entidades, capas `CORTE_PARCIAL`, `HENDIDO`, `CORTE_3` y
  `GRAFICA`; auditoría de ezdxf sin errores. SVG válido de 860 × 564 mm.
  Estos archivos representan un layout que debe repetirse 25 veces, no 25
  layouts superpuestos. Datos de QA retirados después de la comprobación.

## Consulta del flujo por lote en la simulación

- Hover y selección de un paso enfocan el ID de lote, compartido por el
  producto y sus componentes. Los otros lotes de la misma OT quedan atenuados
  y sus dependencias no se dibujan. Sin lotes se conserva el foco por OT.
- Barras, tooltip, inspector y proyección identifican el lote. La búsqueda
  ofrece cada lote y permite mantener un flujo seleccionado por su ID.
- El foco sólo cambia la presentación: la simulación sigue considerando toda
  la cola, con las mismas fechas, recursos y capacidades.
- Validación en Chrome con OT-2026-0054: Lote B y Lote C muestran cuatro
  operaciones y tres dependencias cada uno, sin mezclar los otros lotes.
  La proyección filtrada muestra sólo las cuatro operaciones del Lote C.
- 72 pruebas de frontend aprobadas (simulación, flujo por lote y orden de
  estación), TypeScript, lint y guardia CSS.

## Lo que sigue pendiente

**Cambio de prioridad del 10/09/2026:** el usuario posterga avances cuantitativos
y transferencias internas. El siguiente objetivo es ofrecer reprogramaciones
ejecutables de otros trabajos desde Distribuir entregas cuando la cola impida
cumplir las fechas. [Propuesta y límites](visual-ilusion-fase-6-reprogramacion-asistida-2026-09-10.md).

F6 continúa abierta. Falta registrar unidades buenas, rechazadas, reprocesos y
saldo por lote; habilitar entregas físicas parciales y sus documentos; y validar
la integración cuantitativa con inventario. No se implementó F5 ni una reserva
firme de capacidad. Los tiempos y estaciones deben calibrarse antes de tratar
las fechas orientativas del exhibidor como compromisos garantizados.
