# Planes: estado real y camino de cierre

Actualizado: 21/09/2026. Rama de trabajo: `codex/rediseno-backoffice-plataforma`.

## Resumen

El editor permite diseñar una oferta y diagnosticar su impacto. **Todavía no publica contratos que gobiernen las 65 funciones en empresas reales.** No basta con asignar el JSON de un borrador: primero hay que completar los controles individuales y la continuidad de los trabajos existentes.

Esta revisión contrasta el catálogo con el evaluador, los servicios, controladores, navegación, pruebas y modelos actuales. La presencia de un permiso de usuario o una función en pantalla no cuenta como control comercial. Las búsquedas de referencias sirvieron para localizar código; no se usan como porcentaje de cobertura.

## Lo que ya tenemos

- Catálogo cerrado de 65 funciones, seis de ellas base, con dependencias y complementos. El editor valida combinaciones y guarda borradores con revisión.
- Evaluador común que distingue función contratada, permiso personal y estado de acceso de la empresa.
- Controles individuales y desacoples en compras, reservas, previsión, tesorería, valores, egresos, reportes, proyectos, mensajería y partes de producción. El recorrido básico de cotización y OT tiene pruebas con funciones complementarias desactivadas.
- Cupo de usuarios con invitaciones pendientes y adicionales; cupo de archivos con reservas de subidas, confirmación de bytes y limpieza. Los ajustes manuales de adicionales no realizan cobros.
- Diagnóstico previo de cambios: cupos, funciones retiradas y operaciones abiertas. Detectar un problema no equivale todavía a resolver una migración.
- MFA personal y opción de recordar el navegador durante 30 días. La seguridad de acceso es base, no un adicional de un plan.

Detalle de incrementos y verificaciones anteriores: [evaluador y desacople](planes-evaluador-desacople-2026-09-21.md) y [MFA recordada](mfa-dispositivos-recordados-2026-09-21.md).

## La conexión que falta

`CapacidadesEmpresaService.actual()` lee `Suscripcion.plan.featuresJson` y construye `contratoCompatible()`. No lee ni asigna `PlanBorrador`.

El contrato compatible preserva el comportamiento anterior. Sólo traduce los grupos históricos `centroCopiado`, `impresionDirecta`, `afip` y `whatsapp`; el resto de las funciones conocidas se mantiene habilitado. `contratoPropuesto()` se usa para comparar y probar, no como contrato vigente.

Por eso un control nuevo puede estar implementado y probado sin que desmarcar su casilla en el editor cambie todavía una empresa real. Es una transición deliberada, pero debe terminar antes de comercializar estos planes.

Referencias: `apps/api/src/suscripciones/{evaluador-capacidades.ts,capacidades-empresa.service.ts,capacidad.guard.ts}`, `apps/api/src/plataforma/planes/`, `apps/api/prisma/schema.prisma` (`PlanBorrador`, `Plan`, `Suscripcion`).

## Hallazgos concretos pendientes

### 1. Cerrar el control individual de todas las opciones

- **Copiado y CAD:** `CentroCopiadoController.tenantHabilitado()` pregunta por `centroCopiado`. CAD y terminaciones no se habilitan por separado. Hay que validar también el contenido de los documentos y tomos enviados al cotizar, construir ítems o guardar, no sólo ocultar una pestaña.
- **Impresión:** impresión directa y asistente comparten el grupo histórico. Hay que definir y aplicar el significado de contratar impresión sin su asistente, o convertir esa relación en obligatoria en el catálogo si no tiene sentido operativo separarlas.
- **Geometría y fabricación:** `ExportarFabricacionController` verifica permisos y pertenencia de archivos, pero no la capacidad comercial `exportacion_fabricacion`. El resto del bloque requiere revisar análisis vectorial, geometrías guardadas, aprovechamiento y recorridos en sus entradas reales. El chequeo de recorridos dentro de OT no cierra por sí solo todo el bloque.
- **MCP:** el transporte y las credenciales tienen autenticación y permisos, pero falta el control comercial `mcp` tanto para crear credenciales como para utilizarlas. Revocar credenciales debe seguir disponible.
- **Funciones básicas seleccionables:** cotización, presupuestos, aprobación pública, PDF, órdenes, QR, clientes y catálogo no tienen cerrado el apagado individual. También quedan existencias, equipos productivos y separación de cuentas por cobrar. No deben anunciarse como casillas independientes totalmente aplicadas.
- **Pantallas y automatismos:** el mapa `src/lib/capacidades.ts` cubre sólo parte de las rutas. Cada capacidad necesita revisar acceso por URL, API, servicios internos y trabajos en segundo plano; esconder el menú no alcanza.

La matriz al final distingue los controles encontrados de lo que queda por completar. “Control parcial” no certifica cobertura exhaustiva de todos sus caminos.

### 2. Publicar versiones y asignar contratos

Crear una versión inmutable de cada propuesta validada. Una empresa debe apuntar a esa versión; editar el siguiente borrador no debe cambiarle condiciones silenciosamente.

El resolvedor de capacidades deberá leer la versión asignada, sus adicionales y sus excepciones, conservando el contrato compatible para las cuentas que todavía no se migraron. Los accesos administrativos, el diagnóstico y los cupos tienen que usar la misma resolución.

### 3. Aplicar cambios sin dejar operaciones inconclusas

Definir una política por función retirada: bloquear nuevas operaciones, permitir finalizar las existentes, mantener consulta histórica, migrar o exigir resolución previa. Ejemplos: recibir una compra ya emitida, cerrar valores pendientes, tratar reservas activas, detener avisos aún no enviados y conservar trazabilidad de impresiones.

La aplicación debe volver a validar el estado actual, ejecutarse con control de concurrencia, registrar versión anterior/nueva y motivo, ser idempotente y tener reversión definida. El diagnóstico actual es el punto de partida, no el mecanismo de aplicación.

### 4. Completar la contratación comercial

Definir almacenamiento incluido, precios, condiciones de adicionales y vigencias. Vincular las versiones a los precios mensual/anual de Paddle y reflejar esas cantidades en altas, cambios, renovaciones y cancelaciones.

El registro, la web comercial, el checkout y la pantalla de suscripción deben mostrar el mismo catálogo publicado. Hoy persiste el catálogo anterior. Founder puede conservar condiciones propias explícitas mientras dure el piloto de impresión.

### 5. Validar combinaciones sobre contratos realmente asignados

Las pruebas de desacople actuales son útiles, pero varias simulan capacidades propuestas. Falta repetir los recorridos asignando versiones reales: Esencial, Pro, Avanzado y combinaciones que el editor permita. Cubrir usuario sin permiso, función no contratada, empresa bloqueada, límites concurrentes, URLs directas, enlaces públicos y workers.

Cada función se considera cerrada cuando su entrada está controlada, sus efectos complementarios se pueden retirar sin romper el recorrido base, sus antecedentes siguen siendo consultables según la política y tiene evidencia de esa combinación.

## Independencia no significa eliminar todas las dependencias

Un cotizador necesita materiales, productos y reglas para calcular. Lo que debe ser opcional es, por ejemplo, reservar stock, abrir compras o enviar el resultado a una impresora. La impresión no debería ser requisito para cotizar, y una compra no debería ser requisito para guardar un presupuesto.

El editor ya conoce relaciones obligatorias. Durante el cierre hay que contrastarlas con el código: cuando una relación sea indispensable, debe validarse; cuando sea un complemento, debe tener una alternativa operativa explícita.

## Orden propuesto para continuar

1. **Cobertura:** empezar por Copiado/CAD/terminaciones, impresión, fabricación y MCP; después cerrar el resto de funciones seleccionables, sin activar contratos nuevos todavía.
2. **Contratos:** publicación inmutable y asignación interna con diagnóstico, continuidad, auditoría y reversión.
3. **Prueba real:** migrar una empresa de prueba, recorrer los tres planes y probar cambios de plan con operaciones abiertas.
4. **Venta:** decisiones comerciales, Paddle, adicionales, registro y catálogo público unificado.

En cada bloque actualizar la matriz y adjuntar las pruebas. Evitar porcentajes globales: una sola entrada sin control puede invalidar la separación de una función.

## Revisión visual de Plataforma realizada en este incremento

- Activación del ámbito HeroUI en el contenedor de Plataforma y retiro de ámbitos `legacy` en las superficies migradas. Se corrigió también el uso ambiguo del token `muted`, que podía volver casi invisible el texto del catálogo actual.
- Botones Grafo y campos compartidos en Empresas, Suscripciones, Equipo, invitaciones, editor/comparación de planes e Impersonación. Selectores de empresa/plan detectables y con navegación por teclado.
- Encabezados, tablas, identidad, cupos e historial alineados con el grafito, acento y superficies del sistema. Se preservó el scroll interno y el pie separado del editor.
- Suscripciones ahora divide **Resumen / Usuarios y cupos / Eventos de Paddle / Historial de consultas**. Los historiales se consultan al abrir su pestaña.
- Formularios con contenido desplazable y pie de acciones separado, incluido el estado de error de consulta a Paddle.
- Corrección de etiquetas deformadas o recortadas en gráficos, contraste de los filtros de período y posición inicial al cambiar de sección/ficha.

Verificación: 40 pruebas de interfaz en ocho suites, TypeScript web, lint focal y control de CSS. Recorrido autenticado en Chrome por las siete secciones, pestañas de empresas/equipo/planes/suscripciones y formularios de alta, invitación, consulta y soporte, sin enviar esas operaciones. La suscripción de prueba no tiene eventos ni consultas manuales: allí se verificaron los estados vacíos; las tablas con registros se comprobaron en Empresas y Equipo.

Los cambios de esta revisión son de interfaz y documentación; no publican planes, no asignan versiones ni cambian condiciones comerciales.

## Matriz de las 65 funciones

Leyenda: **Base** = capacidad compartida que no se vende por separado; **Control parcial** = se encontraron controles del nuevo evaluador, falta cierre integral y contrato publicado; **Grupo anterior** = habilitación histórica compartida; **Pendiente** = falta completar el control individual. Estas etiquetas describen la separación por plan, no si el módulo existe o puede utilizarse hoy.


| ID | Función | Separación por plan |
| --- | --- | --- |
| B01 | Identidad, perfil y MFA (`identidad`) | Base |
| B02 | Usuarios, roles y permisos (`roles`) | Base |
| B03 | Empresa y marca (`empresa`) | Base |
| B04 | Archivos y versiones (`archivos`) | Base |
| B05 | Notificaciones internas (`notificaciones`) | Base |
| B06 | Cuenta y suscripción (`cuenta`) | Base |
| C01 | Cotizador completo (`cotizacion`) | Pendiente |
| C02 | Presupuestos (`presupuestos`) | Pendiente |
| C03 | Aprobación pública de presupuestos (`aprobacion_presupuestos`) | Pendiente |
| C04 | Documentos PDF (`documentos_pdf`) | Pendiente |
| C05 | Órdenes y entrega (`ordenes`) | Pendiente |
| C06 | Seguimiento y QR (`seguimiento_qr`) | Pendiente |
| C07 | Campañas y proyectos (`proyectos`) | Control parcial |
| C08 | Aprobación de arte y revisiones (`aprobacion_arte`) | Control parcial |
| R01 | Clientes y contactos (`clientes`) | Pendiente |
| R02 | Cupones (`cupones`) | Control parcial |
| R03 | Fidelización (`fidelizacion`) | Control parcial |
| R04 | Registro de empleados (`empleados`) | Pendiente |
| T01 | Materiales, variantes y costos (`materiales`) | Pendiente |
| T02 | Productos y formularios (`productos`) | Pendiente |
| T03 | Productos compuestos y recetas (`productos_compuestos`) | Pendiente |
| T04 | Procesos y flujos (`procesos`) | Pendiente |
| T05 | Centros de costo y tarifas (`centros_costo`) | Pendiente |
| T06 | Maquinaria y consumos (`maquinaria`) | Pendiente |
| T07 | Precios, impuestos y monedas (`reglas_precio`) | Pendiente |
| T08 | Precios especiales por cliente (`precios_especiales`) | Control parcial |
| G01 | Medición y análisis vectorial (`analisis_vectorial`) | Pendiente |
| G02 | Geometrías del producto (`geometrias`) | Pendiente |
| G03 | Aprovechamiento para cotizar (`aprovechamiento_cotizacion`) | Pendiente |
| G04 | Exportación de fabricación DXF (`exportacion_fabricacion`) | Pendiente |
| G05 | Recorridos y plantillas de fabricación (`recorridos_fabricacion`) | Control parcial |
| I01 | Centro de copiado: documentos (`centro_copiado`) | Grupo anterior: `centroCopiado` |
| I02 | Terminaciones y tomos (`terminaciones_copiado`) | Grupo anterior: `centroCopiado` |
| I03 | Cotización de planos CAD (`cotizacion_cad`) | Grupo anterior: `centroCopiado` |
| I04 | Impresión conectada (`impresion_directa`) | Grupo anterior: `impresionDirecta` |
| I05 | Asistente y colas de impresión (`colas_impresion`) | Grupo anterior: `impresionDirecta` |
| I06 | Etiquetas descargables (`etiquetas_pdf`) | Pendiente |
| P01 | Tablero y tareas (`tablero`) | Pendiente |
| P02 | Estaciones y calendarios (`estaciones`) | Pendiente |
| P03 | Equipos productivos (`equipos_produccion`) | Pendiente |
| P04 | Asignación automática de personal (`asignacion_automatica`) | Control parcial |
| P05 | Estimación según capacidad (`eta_capacidad`) | Control parcial |
| P06 | Escenarios y reprogramación (`planificacion_avanzada`) | Control parcial |
| P07 | Optimización de colas productivas (`colas_produccion`) | Control parcial |
| S01 | Existencias y movimientos (`existencias`) | Pendiente |
| S02 | Reservas automáticas por OT (`reservas`) | Control parcial |
| S03 | Previsión de faltantes (`prevision_materiales`) | Control parcial |
| S04 | Proveedores y reposición (`proveedores`) | Control parcial |
| S05 | Compras y abastecimiento (`compras`) | Control parcial |
| S06 | Recepciones de materiales (`recepciones`) | Control parcial |
| F01 | Cobros, señas y recibos (`cobros`) | Pendiente |
| F02 | Saldos y cuentas por cobrar (`cuentas_cobrar`) | Pendiente |
| F03 | Tesorería y conciliación (`tesoreria`) | Control parcial |
| F04 | Valores y cheques (`valores`) | Control parcial |
| F05 | Egresos y cuentas por pagar (`cuentas_pagar`) | Control parcial |
| F06 | Gastos recurrentes (`gastos_recurrentes`) | Control parcial |
| F07 | Gastos fijos y costos (`gastos_fijos`) | Control parcial |
| F08 | Comprobantes y ARCA (Argentina) (`fiscal_argentina`) | Grupo anterior: `afip` |
| A01 | Resumen comercial y operativo (`reportes_resumen`) | Control parcial |
| A02 | Análisis financiero y márgenes (`reportes_finanzas`) | Control parcial |
| A03 | Análisis de productos y clientes (`reportes_comerciales`) | Control parcial |
| A04 | Análisis de capacidad y equipo (`reportes_produccion`) | Control parcial |
| X01 | WhatsApp: avisos automáticos (`whatsapp_automatico`) | Control parcial |
| X02 | WhatsApp Web y contexto comercial (`whatsapp_web`) | Control parcial |
| X03 | Cotización mediante MCP (`mcp`) | Pendiente |
