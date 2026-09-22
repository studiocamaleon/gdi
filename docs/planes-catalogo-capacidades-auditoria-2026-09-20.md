# Planes de Grafo: catálogo de capacidades y auditoría

**Fecha:** 20 de septiembre de 2026.  
**Estado:** relevamiento estático y propuesta de catálogo; distribución comercial pendiente.  
**Rama relevada:** `codex/rediseno-backoffice-plataforma`.  
**Documentos relacionados:** [diseño del editor y etapas](planes-editor-visual-diseno-2026-09-20.md), [inventario técnico](planes-inventario-superficies-2026-09-20.md), [plan de Backoffice](backoffice-profesional-investigacion-y-plan-2026-09-20.md).

## 1. Resultado y decisiones

**Grafo puede tener un editor que permita construir los planes sin fijar en código sus paquetes comerciales.** El código debe definir las funciones reales, sus dependencias y cómo se restringen. El editor define qué incluye cada versión de un plan, sus cupos y su presentación comercial.

Decisiones expresadas por el usuario:

- Tres planes con **3, 20 y 40 usuarios incluidos**.
- Posibilidad de usuarios adicionales pagos. Falta definir en qué planes, precio, máximo y condiciones.
- Revisar todo el sistema antes de distribuir funciones.
- Conservar la posibilidad de probar funciones en Founder antes de ofrecerlas comercialmente.

Permanecen abiertos nombres, precios, funciones por nivel, almacenamiento, posibles adicionales de funciones y condiciones de prueba. Los nombres y precios existentes en código o marketing son antecedentes, **no decisiones para la nueva oferta**.

La propuesta permite paquetes distintos por funciones, además de sus cupos. No exige que cada plan sea un superconjunto del anterior; esa relación podrá elegirse y validarse en el editor.

## 2. Alcance y calidad de la evidencia

Se inventariaron **67 controladores y 606 declaraciones de rutas API**, **57 módulos Nest**, **120 páginas y 3 handlers Next**, y **16 entradas de procesos de fondo**. Se inspeccionaron navegación, configuración, permisos, suscripciones, cuotas, modelos de datos, cobro, registro y oferta de marketing, además de puntos de entrada de las áreas operativas.

El anexo permite rastrear esos archivos. Las cifras cuentan declaraciones estáticas; no equivalen a 606 funciones comerciales ni certifican que cada ruta esté activa, completa o probada en producción. La lectura de servicios se concentró en restricciones, cuotas y dependencias. **Este relevamiento no es una prueba funcional integral ni de carga.** No incluye el desarrollo independiente de la rama Grafo3D ni una auditoría de infraestructura desplegada.

### Cómo leer el catálogo

- **Base técnica:** infraestructura o protección transversal que recomendamos conservar para todas las cuentas. No se presenta como una función opcional de pago.
- **Candidata:** capacidad existente o agrupación útil para diseñar paquetes. Su presencia no significa que ya pueda bloquearse por plan.
- **Control actual:** sólo se indica cuando se encontró una restricción comercial explícita. Los permisos de un usuario y el bloqueo general de una suscripción son controles diferentes.
- **Dependencia dura:** una función necesita otra para operar. **Complemento:** enriquece el resultado, pero debería existir un camino útil sin contratarlo.

Los identificadores de las tablas son referencias de esta propuesta, no nuevas claves desplegadas. No se recomienda convertir cada fila en un interruptor visible: el editor agrupará capacidades por una tarea que el cliente entienda, con detalle expandible.

## 3. Catálogo completo por áreas

### B. Base de la cuenta

| ID | Capacidad y alcance observado | Tratamiento propuesto | Evidencia |
|---|---|---|---|
| B01 | Identidad, login, contraseña, perfil, foto, MFA, recuperación y sesiones | Base técnica; seguridad disponible en todos los planes | [Auth](../apps/api/src/auth/auth.controller.ts), [perfil](../apps/api/src/auth/perfil.controller.ts) |
| B02 | Aislamiento de empresa, pertenencias, roles, permisos y restricciones de acceso | Base técnica; el plan nunca concede un permiso personal | [usuarios](../apps/api/src/usuarios/usuarios.service.ts), [guard](../apps/api/src/auth/auth.guard.ts) |
| B03 | Datos y marca de la empresa, país y configuración general | Base técnica; requisitos fiscales y regionales separados de la oferta | [tenants](../apps/api/src/tenants/tenants.controller.ts) |
| B04 | Archivos, versiones, descarga, papelera y restauración | Base compartida con cupo independiente; política de conservación explícita | [archivos](../apps/api/src/archivos/archivos.controller.ts) |
| B05 | Notificaciones internas, eventos y resumen de actividad | Base compartida; no confundir con mensajería externa paga | [eventos](../apps/api/src/eventos-sistema/eventos-sistema.controller.ts), [panel](../apps/api/src/panel-general/panel-general.controller.ts) |
| B06 | Alta, suscripción, medios de gestión del cobro SaaS y acceso a soporte | Base técnica; Backoffice y Paddle son operación de Grafo | [registro](../apps/api/src/registro/registro.controller.ts), [suscripción](../apps/api/src/suscripciones/suscripcion.controller.ts) |

### C. Venta y relación con el trabajo

| ID | Capacidad y alcance observado | Dependencias y separación propuesta | Evidencia |
|---|---|---|---|
| C01 | Cotización, varios ítems, cálculo y recotización | Catálogo y costos T01–T05. Stock S03 puede enriquecer la fecha, sin impedir cotizar por falta de material | [motor](../apps/api/src/motor-universal/motor.controller.ts) |
| C02 | Presupuestos, emisión, respuesta comercial y conversión a OT | C01; separar la gestión del presupuesto de sus canales de envío | [presupuestos](../apps/api/src/presupuestos/presupuestos.controller.ts) |
| C03 | Presupuesto público y aprobación del cliente | C02; conservar la trazabilidad y definir continuidad de enlaces al cambiar de plan | [presupuestos](../apps/api/src/presupuestos/presupuestos.controller.ts) |
| C04 | Documentos PDF del negocio | Recurso transversal a presupuesto, OT, recibo y factura. La tecnología del generador no es una prestación comercial | [worker PDF](../apps/api/src/documentos-pdf/documentos-pdf.worker.ts) |
| C05 | Órdenes, ítems, emisión, modificaciones, cancelación y entrega | C01; puede operar con cobro básico F01 y sin impresión directa | [OT](../apps/api/src/ordenes-trabajo/ordenes-trabajo.controller.ts) |
| C06 | Seguimiento público, identificación QR y entrega por escaneo | C05; distinguir QR interno de entrega y enlace público de seguimiento | [OT](../apps/api/src/ordenes-trabajo/ordenes-trabajo.controller.ts) |
| C07 | Campañas/proyectos: equipo, hitos y agrupación de presupuestos y OT | C02/C05; son proyectos de trabajo, no campañas de email marketing | [campañas](../apps/api/src/campanas/campanas.service.ts) |
| C08 | Desarrollo documental, revisiones de arte, solicitudes, aprobación y liberación | B04/C05; incluye controles que pueden condicionar producción | [desarrollo documental](../apps/api/src/desarrollo-documental/desarrollo-documental.controller.ts) |

Estas capacidades tienen rutas y permisos de negocio; **no se encontró una clave comercial independiente para cada una** en el resolvedor actual de planes.

### R. Clientes y registros

| ID | Capacidad | Dependencias / límites de alcance | Evidencia |
|---|---|---|---|
| R01 | Clientes, contactos, importación y consulta de su actividad | Registro compartido por ventas y administración | [clientes](../apps/api/src/clientes/clientes.controller.ts) |
| R02 | Cupones, validación y uso | Se integra al cálculo comercial; revisar cotización y emisión, no sólo CRUD | [cupones](../apps/api/src/cupones/cupones.controller.ts) |
| R03 | Fidelización, configuración, ajustes y simulación | R01; una futura restricción debe incluir los efectos automáticos | [fidelización](../apps/api/src/fidelizacion/fidelizacion.controller.ts) |
| R04 | Empleados, vinculación a usuarios, capacidades y remuneraciones | Registro de personal/costos; no implica un sistema completo de liquidación de sueldos | [empleados](../apps/api/src/empleados/empleados.controller.ts) |

### T. Catálogo, costos y definición del producto

| ID | Capacidad | Dependencias / separación propuesta | Evidencia |
|---|---|---|---|
| T01 | Materiales, variantes, unidades, presentaciones, costos y biblioteca | Base del cálculo; independiente de contratar gestión operativa de stock | [inventario de materiales](../apps/api/src/inventario/inventario.controller.ts) |
| T02 | Productos, formularios y configuración comercial | Usa materiales y procesos; conservar lectura de productos históricos | [productos](../apps/api/src/productos-servicios/productos-servicios.controller.ts) |
| T03 | Recetas, componentes, revisiones y publicación del producto | T02; evaluar la composición avanzada como paquete, sin romper componentes ya utilizados | [productos](../apps/api/src/productos-servicios/productos-servicios.controller.ts) |
| T04 | Procesos reutilizables, familias, flujos y alternativas de producción | Compartido entre cotización y ejecución; una familia técnica no equivale automáticamente a un adicional comercial | [familias](../apps/api/src/productos-servicios/pasos/familias.ts) |
| T05 | Centros de costo, tarifas, capacidades e historial | Base de costos y planificación; separar mantenimiento del costo de herramientas avanzadas de planificación | [costos](../apps/api/src/costos/costos.controller.ts) |
| T06 | Maquinaria, perfiles, consumos e historial | T05; maquinaria productiva e impresora conectada I04 son conceptos diferentes | [maquinaria](../apps/api/src/maquinaria/maquinaria.controller.ts) |
| T07 | Cargos, impuestos, comisiones, reglas de precio y tipos de cambio | Recurso común del cálculo; configuración regional independiente de ARCA | [aplicaciones de precio](../apps/api/src/productos-servicios/precio/aplicaciones/precio-aplicaciones.controller.ts), [cotizaciones de moneda](../apps/api/src/cotizaciones/cotizaciones.controller.ts) |
| T08 | Precios especiales por cliente/producto | R01/T02; posible agrupación comercial avanzada | [precios especiales](../apps/api/src/productos-servicios/precio/precios-especiales-clientes/precios-especiales-clientes.controller.ts) |

### G. Geometría y preparación de fabricación

| ID | Capacidad | Dependencias / separación propuesta | Evidencia |
|---|---|---|---|
| G01 | Análisis y preparación vectorial, medidas y geometrías | Puede alimentar C01; no apagar primitivas compartidas al retirar una herramienta avanzada | [motor](../apps/api/src/motor-universal/motor.controller.ts), [jobs](../apps/api/src/workers/geometria/geometria-jobs.controller.ts) |
| G02 | Geometrías del producto e interpretación por lotes | T02/G01; diferenciar mantenimiento de geometrías de exportación fabril | [geometrías](../apps/api/src/productos-servicios/geometrias/geometrias-producto.controller.ts) |
| G03 | Nesting y preparaciones guardadas para aprovechamiento del material | G01/T01; revisar consumo desde cotización y colas de producción | [preparaciones](../apps/api/src/workers/cotizacion/preparaciones-nesting.controller.ts) |
| G04 | Exportación de fabricación y capas DXF | G02; candidata a herramienta avanzada, con permisos y formatos explícitos | [exportación](../apps/api/src/productos-servicios/geometrias/exportar-fabricacion.controller.ts) |
| G05 | Recorridos, revisiones y archivos de fabricación/plantillas | G01/G02; listar formatos soportados en el contrato futuro, sin prometer compatibilidad universal CNC | [recorridos](../apps/api/src/recorridos-vectoriales/preparaciones-recorrido.controller.ts) |

La presencia de declaraciones de familias como impresión 3D, CNC, láser o transfer no certifica por sí sola un producto comercial terminado. La rama independiente Grafo3D queda fuera de este relevamiento. Antes de vender paquetes por tecnología hace falta una prueba de recorrido completo de cada familia elegida.

### I. Centro de copiado e impresión

| ID | Capacidad | Control comercial actual y separación propuesta | Evidencia |
|---|---|---|---|
| I01 | Cotización de documentos: PDF, páginas/rangos, copias, orientación, color, faz y papel | `centroCopiado`; puede funcionar sin envío a impresora | [centro de copiado](../apps/api/src/centro-copiado/centro-copiado.controller.ts) |
| I02 | Terminaciones, agrupación y tomos | Comparte `centroCopiado`; no tiene interruptor comercial propio | [centro de copiado](../apps/api/src/centro-copiado/centro-copiado.controller.ts) |
| I03 | Cotización CAD por rollo, tamaños grandes y configuración por página | Comparte `centroCopiado` con documentos. Separarlos comercialmente exige nuevos controles | [centro de copiado](../apps/api/src/centro-copiado/centro-copiado.controller.ts) |
| I04 | Impresión directa: conexión QZ, impresoras, bandejas y perfiles | `impresionDirecta` explícito; hoy agrupa láser, CAD y térmica | [guard](../apps/api/src/impresion/impresion-directa.guard.ts), [impresión](../apps/api/src/impresion/impresion.controller.ts) |
| I05 | Asistente, colas por máquina, preparación del operario, envíos y confirmaciones | I04; distinguir estado de cola y validación física | [impresión](../apps/api/src/impresion/impresion.controller.ts) |
| I06 | Etiquetas QR y descarga para impresión manual | C05/C06; la vía manual está exceptuada mediante `ImpresionManual` | [guard](../apps/api/src/impresion/impresion-directa.guard.ts) |

### P. Producción y promesa de entrega

| ID | Capacidad | Dependencias / separación propuesta | Evidencia |
|---|---|---|---|
| P01 | Tablero, lista, tareas, tramos y progreso del trabajo | C05/T04; base de ejecución | [producción](../apps/api/src/produccion/produccion.controller.ts) |
| P02 | Estaciones, recursos, calendarios y disponibilidad | T05/T06; insumo para planificación, además de configuración operativa | [producción](../apps/api/src/produccion/produccion.controller.ts) |
| P03 | Equipos productivos y capacidades | R04/P02; empleados sin login no equivalen automáticamente a usuarios de licencia | [equipos](../apps/api/src/produccion/equipos-produccion.controller.ts) |
| P04 | Asignación de personal: simulación, confirmación y reconciliación | P01/P03; cubrir también ejecución automática | [asignación](../apps/api/src/ordenes-trabajo/asignacion-personal.controller.ts), [scheduler](../apps/api/src/eta/eta-snapshot.scheduler.ts) |
| P05 | ETA, contexto y estimaciones de capacidad/entrega | P01/P02; S03 complementa faltantes. Una fecha estimada debe explicar sus supuestos | [ETA](../apps/api/src/eta/eta.controller.ts) |
| P06 | Escenarios de planificación, elección y reprogramación | P05; incluye trabajos en segundo plano y evaluación antes de emitir | [planificación](../apps/api/src/planificacion-entregas/planificacion.controller.ts), [cotización](../apps/api/src/planificacion-entregas/planificacion-cotizacion.controller.ts) |
| P07 | Colas productivas, agrupación y acciones sobre trabajos | P01; G03 cuando usa nesting conjunto. No confundir con cola de impresión I05 | [colas](../apps/api/src/produccion/colas/colas.controller.ts), [acciones](../apps/api/src/ordenes-trabajo/acciones-cola.controller.ts) |

### S. Stock, proveedores y compras

| ID | Capacidad | Dependencias / separación propuesta | Evidencia |
|---|---|---|---|
| S01 | Almacenes, ubicaciones, existencias, transferencias y movimientos | T01; catálogo de materiales y existencias son niveles diferentes | [stock](../apps/api/src/inventario/inventario-stock.controller.ts) |
| S02 | Reservas de materiales por OT y consumo | S01/C05; la OT también llama al servicio internamente: proteger sólo las rutas de stock no alcanza | [reservas](../apps/api/src/inventario/reservas-material.controller.ts), [OT](../apps/api/src/ordenes-trabajo/ordenes-trabajo.service.ts) |
| S03 | Previsión de materiales durante cotización | T01/S01; complemento de C01/P05. Cotizar debe seguir siendo posible con faltantes o sin este módulo | [previsión](../apps/api/src/inventario/prevision-materiales.controller.ts) |
| S04 | Proveedores, ofertas/costos y plazos de reposición | T01; registro de proveedor reutilizable en egresos y compras | [proveedores](../apps/api/src/proveedores/proveedores.controller.ts), [compras](../apps/api/src/compras/compras.controller.ts) |
| S05 | Necesidades de abastecimiento, borradores y pedidos de compra | S04/T01; conectar S02 cuando una necesidad proviene de una OT | [compras](../apps/api/src/compras/compras.controller.ts) |
| S06 | Recepciones y actualización de stock, incluidas recepciones parciales | S05/S01; conservar trazabilidad de operaciones iniciadas ante cambios de plan | [compras](../apps/api/src/compras/compras.controller.ts) |

Este flujo existe, pero el usuario dejó su revisión operativa pendiente. **No considerarlo certificado para una oferta comercial sólo porque figure en el catálogo.** El editor debe separar madurez funcional y capacidad de restricción.

### F. Administración y finanzas

| ID | Capacidad | Dependencias / separación propuesta | Evidencia |
|---|---|---|---|
| F01 | Cobros, señas, imputaciones, métodos de pago y recibos | C05/R01; definir un cobro básico compatible con entregar una OT, sin exigir tesorería avanzada | [administración](../apps/api/src/administracion/administracion.controller.ts), [recibos](../apps/api/src/administracion/recibos.controller.ts) |
| F02 | Cuentas por cobrar, deudores y estado de cuenta | F01/R01; independiente de emitir fiscalmente con ARCA | [administración](../apps/api/src/administracion/administracion.controller.ts) |
| F03 | Tesorería, cuentas, movimientos, transferencias, arqueos y conciliación | F01; posible agrupación avanzada | [administración](../apps/api/src/administracion/administracion.controller.ts) |
| F04 | Valores y cheques: depósito, acreditación, rechazo y reversión | F03; contemplar acreditaciones programadas | [administración](../apps/api/src/administracion/administracion.controller.ts), [scheduler](../apps/api/src/administracion/acreditaciones.scheduler.ts) |
| F05 | Egresos, cuentas por pagar y órdenes de pago | S04/F03 según operación; compra y pago son dominios distintos | [egresos](../apps/api/src/egresos/egresos.controller.ts) |
| F06 | Gastos recurrentes y generación programada | F05; comprobar tanto alta como ejecución del scheduler | [recurrentes](../apps/api/src/egresos/recurrentes.scheduler.ts) |
| F07 | Gastos fijos y estructura de costos | T05/R04; no retirar los insumos necesarios del cálculo básico por una decisión de packaging | [gastos fijos](../apps/api/src/gastos-fijos/gastos-fijos.controller.ts) |
| F08 | Comprobantes, notas y facturación electrónica argentina | Existe `afip` para integración/emisión fiscal. Separar comprobantes manuales, gestión financiera y servicio fiscal; país/configuración también aplican | [AFIP](../apps/api/src/administracion/afip-integracion.service.ts), [comprobantes](../apps/api/src/administracion/comprobantes.service.ts) |

### A. Análisis y reportes

| ID | Capacidad | Dependencias / separación propuesta | Evidencia |
|---|---|---|---|
| A01 | Resumen, evolución comercial y embudo | C02/C05; separar resumen operativo de análisis avanzado | [reportes](../apps/api/src/reportes/reportes.controller.ts) |
| A02 | Análisis financiero y márgenes | F01–F07; los permisos para ver márgenes siguen aplicando aun con la función contratada | [reportes](../apps/api/src/reportes/reportes.controller.ts) |
| A03 | Productos, mezcla de categorías y clientes | R01/T02/C05; validar experiencia con módulos opcionales ausentes | [reportes](../apps/api/src/reportes/reportes.controller.ts) |
| A04 | Producción, equipo, alertas, umbrales y salud de ETA | P01–P06 según informe; no hacer depender todos los reportes de planificación avanzada | [reportes](../apps/api/src/reportes/reportes.controller.ts) |

### X. Integraciones y automatización externa

| ID | Capacidad | Control comercial actual / pendientes | Evidencia |
|---|---|---|---|
| X01 | WhatsApp oficial/WATI, plantillas, notificaciones, recordatorios y reseñas | Existe la clave `whatsapp`, pero no se encontró verificación en los caminos de envío inspeccionados. Requiere cierre de cobertura | [integraciones](../apps/api/src/integraciones/integraciones.controller.ts), [scheduler](../apps/api/src/integraciones/notificaciones/notificaciones.scheduler.ts) |
| X02 | Asistencia por WhatsApp Web, contexto de cliente y cola de automáticos | Dependencias y restricción propia por definir; no asumir que el flag de WATI cubre la extensión | [contexto](../apps/api/src/clientes/whatsapp-contexto.controller.ts), [automáticos](../apps/api/src/integraciones/whatsapp-web/automaticos.controller.ts) |
| X03 | Herramientas de cotización por MCP y credenciales | C01 y permisos del actor. El catálogo debe evaluar también este acceso; no equivale a ofrecer una API pública general de todo el ERP | [MCP](../apps/api/src/mcp/mcp.controller.ts), [credenciales](../apps/api/src/mcp/credenciales-mcp.controller.ts) |

### L. Cupos y recursos

| ID | Límite | Implementación encontrada | Decisión pendiente |
|---|---|---|---|
| L01 | Usuarios habilitados por empresa | `usuariosMax`; cuenta membresías activas al crear/reactivar | Fijar contrato de conteo, concurrencia segura y usuarios adicionales pagos |
| L02 | Almacenamiento | `storageGb` y excepción `Tenant.cuotaBytesArchivos`; reserva de bytes en subida | Unidad, alcance de versiones/papelera, excepciones y experiencia sobre cuota |
| L03 | Órdenes por período | `ordenesMesMax` declarado y expuesto; no se encontró aplicación en emisión | Decidir primero si se ofrecerá este límite. No mostrarlo como restricción lista |

No se propone inventar topes de clientes, materiales, impresoras o máquinas sólo porque el editor pueda soportarlos. Cada cupo nuevo necesita unidad de medición, punto de consumo, devolución, concurrencia y pruebas.

## 4. Hallazgos que condicionan el editor

### H01 — Hay cuatro claves comerciales, no un catálogo integral

El [contrato actual](../apps/api/src/suscripciones/capacidades-plan.ts) sólo reconoce `afip`, `whatsapp`, `centroCopiado` e `impresionDirecta`. El resto usa permisos o reglas del dominio, además del acceso general de la suscripción. Ocultar un menú no impediría operar por API, por una acción interna o por un worker.

| Clave | Evidencia de control encontrada | Trabajo antes de declararla publicable en el nuevo editor |
|---|---|---|
| `centroCopiado` | Comprobación compartida en sus rutas | Pruebas de vías alternativas de cotización, guardado y emisión |
| `impresionDirecta` | Guard de impresión y perfiles CAD, opt-in y UI; excepción explícita para impresión manual | Conservar pruebas existentes y ampliar escenarios de cambio de plan y tareas en curso |
| `afip` | Integración y habilitación de facturación fiscal | Revisar todos los caminos de emisión, lotes y servicios internos; separar administración general |
| `whatsapp` | Consulta en catálogo de permisos; no se encontró consumo equivalente en envío/schedulers | Aplicar política en conexión, envío manual, automático, reintentos y tareas pendientes |

La tabla describe cobertura localizada, no una certificación de ausencia de otras rutas. La condición «lista para restringir» del editor requerirá pruebas específicas por capacidad.

### H02 — `todo` también elimina los cupos

En [SuscripcionesService.limites](../apps/api/src/suscripciones/suscripciones.service.ts), `todo: true` transforma usuarios, OT y almacenamiento en `null` (sin límite). Por eso no sirve para expresar «todas las funciones y 40 usuarios». Impresión directa conserva, correctamente, opt-in explícito incluso con `todo`.

**Cambio necesario:** expansión explícita y versionada de funciones, con límites independientes. Founder tampoco debe recibir automáticamente todas las futuras funciones experimentales por una wildcard.

### H03 — Administración aparece ligada a AFIP en el editor de permisos

[UsuariosService.catalogo](../apps/api/src/usuarios/usuarios.service.ts) calcula `enElPlan` del módulo Administración usando `afip`. Eso mezcla cobros, tesorería y cuentas corrientes con facturación electrónica argentina. El catálogo comercial debe separar esos conceptos y conservar el filtro de país donde corresponda.

### H04 — Los cupos requieren contratos diferentes

- **Usuarios:** el conteo actual usa `Membership.activa`, sin filtrar `User.activo`. No mide sesiones simultáneas. Las verificaciones previas a la escritura pueden competir entre altas concurrentes; hace falta una reserva/bloqueo transaccional compartido. La revisión identifica el riesgo por lectura, sin haber ejecutado una prueba de carrera.
- **Almacenamiento:** [ArchivosService](../apps/api/src/archivos/archivos.service.ts) contempla una excepción por empresa y reserva de bytes con condición. La semántica de cero y `null` debe ser explícita: hay verificaciones por valor verdadero que no distinguen cero de ausencia. Revisar todos los productores de archivos, no sólo subida desde UI.
- **Órdenes:** la búsqueda del símbolo `ordenesMesMax` no encontró un consumo en emisión. Antes de aplicarlo hay que definir período, zona horaria, borradores, conversiones, cancelaciones, lotes y reintentos.

### H05 — No hay versión inmutable de las funciones contratadas

El modelo [Plan](../apps/api/prisma/schema.prisma) tiene `featuresJson`, y la suscripción referencia ese plan mutable. `PlanPrecioLegacy` conserva reconocimiento de precios antiguos, **no una versión de capacidades**. Editar el JSON podría cambiar condiciones a todas las empresas vinculadas.

**Cambio necesario:** borradores, versiones publicadas inmutables y asignación explícita de versión. La migración inicial debe reproducir el acceso existente antes de proponer nuevos paquetes.

### H06 — La oferta está repetida en tres lugares

La [web comercial](../apps/marketing/src/app/page.tsx) define Print/Sign/Industrial en código; el [registro](../src/components/registro/registro-form.tsx) y la [vista de suscripción](../src/components/suscripcion/suscripcion-view.tsx) tienen sus propias presentaciones de funciones y planes. El editor actual de Plataforma se centra en metadatos y vinculación de precios.

**Cambio necesario:** una proyección pública del catálogo publicado para web, registro y autogestión; catálogo privado completo para Backoffice. Esa proyección debe excluir Founder, pilotos internos y detalles operativos. La referencia comercial a 3D requiere revisar la disponibilidad real antes de republicarla.

### H07 — Las dependencias atraviesan módulos y procesos de fondo

Las reservas se invocan desde OT; la asignación de personal, los avisos de WhatsApp y los gastos recurrentes se ejecutan sin que haya un usuario abriendo su pantalla. Cotización, geometría y planificación también tienen workers. Los límites de concurrencia configurados por entorno son protección técnica y no cupos comerciales del cliente.

**Cambio necesario:** inventariar y controlar los puntos de efecto de cada función, incluyendo encolado, ejecución y reintentos. Higiene, autenticación, recepción de webhooks de cobro y reconciliación de pagos deben seguir funcionando aunque el cliente no tenga un módulo comercial.

### H08 — “Disponible”, “incluido” y “permitido” no son lo mismo

Ejemplo: impresión directa puede estar incluida, pero el usuario no tiene permiso, la estación no está configurada o el piloto no está habilitado. La UI debe explicar la condición concreta. De manera similar, una función existente de compras puede requerir más revisión operativa antes de ofrecerse públicamente.

## 5. Dependencias que hay que preservar

| Combinación | Comportamiento esperado |
|---|---|
| Cotización sin inventario operativo | Materiales, costos y cantidades utilizables; sin inventar reservas ni afirmar disponibilidad física |
| Cotización con faltante | Cotiza; muestra previsión y supuestos de reposición cuando están disponibles |
| Centro de copiado sin impresión directa | Carga, configura, cotiza, guarda y emite OT normalmente |
| Impresión manual sin QZ | Descarga de etiquetas/documentos y flujo manual conservados |
| Finanzas sin ARCA o empresa fuera de Argentina | Cobros/cuentas habilitados según su propio paquete; fiscal electrónico sujeto a país e integración |
| Plan sin planificación avanzada | Puede registrar fecha y ejecutar OT por el flujo básico definido; no prometer cálculo avanzado |
| Función contratada sin permiso personal | Se deniega la operación; comprar una función no transforma al operario en administrador |
| Menor plan con historial avanzado | No borrar datos; definir por capacidad consulta, exportación y cierre de operaciones pendientes |
| Founder o piloto | Acceso comercial y piloto explícitos; no conceder acceso a Plataforma ni saltar controles de usuario |

## 6. Priorización y salida de esta etapa

1. **Catálogo y simulador sin efecto sobre cuentas:** integrar esta taxonomía a un contrato tipado, registrar madurez/cobertura y mantener compatibilidad con las cuatro claves existentes.
2. **Editor de borradores y matriz comparativa:** tres borradores con 3/20/40 usuarios; funciones abiertas, precios y adicionales pendientes. Mostrar dependencias y trabajo necesario para publicar.
3. **Restricciones por bloques y pruebas:** primero los controles existentes, separación de límites y Administración/AFIP; después los módulos elegidos comercialmente. Cada capacidad nueva incluye HTTP, servicios, workers, UI y migración.
4. **Publicación versionada:** vista previa de efectos, historial, permisos de staff y asignación controlada a empresas. Marketing sólo consume versiones públicas habilitadas.
5. **Usuarios adicionales y cobro:** cantidades confirmadas, previsualización del cargo, reconciliación y experiencia cuando se supera un cupo.

No hace falta cerrar la distribución comercial para empezar los puntos 1 y 2. Sí hace falta terminar sus controles antes de vender exclusiones que el sistema todavía no puede hacer cumplir.

### Validación de esta entrega

Inventario estático, revisión de las referencias locales, coherencia de identificadores y formato del diff. No se ejecutaron nuevas pruebas funcionales de aplicación para esta entrega documental. La certificación por capacidad y las pruebas de migración forman parte de las siguientes etapas.
