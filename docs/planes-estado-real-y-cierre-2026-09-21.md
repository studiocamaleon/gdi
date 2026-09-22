# Planes: estado real y camino de cierre

Actualizado: 22/09/2026. Rama de trabajo: `codex/rediseno-backoffice-plataforma`.

## Resumen

El editor permite diseñar una oferta, **publicar versiones inmutables y conectarlas con contratos manuales o Paddle**, con diagnóstico obligatorio, revalidación e historial. Funciones, usuarios y almacenamiento leen el mismo contrato. Los recorridos principales de Esencial, Pro y Avanzado se probaron con versiones asignadas. También se completó una contratación real de sandbox, cambios de plan/adicionales y cancelación con webhooks auténticos. Plataforma incorpora recuperación auditada de contrataciones por consulta o referencia.

**Estado consolidado del 22/09:** ver [auditoría de las 65 funciones y regresión completa](planes-auditoria-consolidada-2026-09-22.md) y [cierre mensual/anual en sandbox](planes-anuales-cierre-sandbox-2026-09-22.md). Esa revisión sustituye las listas genéricas de «otras combinaciones» de los incrementos anteriores. El anual ya fue definido y probado; la homologación fiscal y las revisiones visuales específicas están documentadas. Los cobros reales se activarán al lanzamiento por decisión del usuario. Los casos sin evidencia remota conservan el bloqueo según la política definida.

Esta revisión contrasta el catálogo con el evaluador, los servicios, controladores, navegación, pruebas y modelos actuales. La presencia de un permiso de usuario o una función en pantalla no cuenta como control comercial. Las búsquedas de referencias sirvieron para localizar código; no se usan como porcentaje de cobertura.

## Lo que ya tenemos

- Catálogo cerrado de 65 funciones, seis de ellas base, con dependencias y complementos. El editor valida combinaciones y guarda borradores con revisión.
- Publicación interna con revisión previa, almacenamiento definido, historial paginado, autor, motivo y auditoría. El contenido publicado y su catálogo quedan inmutables también en PostgreSQL. Ver [versiones de planes](planes-versiones-publicadas-2026-09-21.md).
- Evaluador común que distingue función contratada, permiso personal y estado de acceso de la empresa.
- Controles individuales y desacoples en compras, reservas, previsión, tesorería, valores, egresos, reportes, proyectos, mensajería y partes de producción. El recorrido básico de cotización y OT tiene pruebas con funciones complementarias desactivadas.
- Cupo de usuarios con invitaciones pendientes y adicionales; cupo de archivos con reservas de subidas, confirmación de bytes y limpieza. Los ajustes manuales de adicionales no realizan cobros.
- Diagnóstico previo de cambios: cupos, funciones retiradas y operaciones abiertas. Detectar un problema no equivale todavía a resolver una migración.
- MFA personal y opción de recordar el navegador durante 30 días. La seguridad de acceso es base, no un adicional de un plan.

Detalle de incrementos y verificaciones anteriores: [evaluador y desacople](planes-evaluador-desacople-2026-09-21.md) y [MFA recordada](mfa-dispositivos-recordados-2026-09-21.md).

## Conexión entre editor y contrato vigente

`contratoSuscripcion()` resuelve `Suscripcion.planVersion` si está asignada; en caso contrario mantiene `contratoCompatible(Suscripcion.plan)`. Se utiliza en capacidades, sesión, límites de usuarios y archivos, diagnóstico y vistas administrativas. Los borradores nunca se leen como contrato vigente.

La asignación conserva el plan comercial, estado de acceso, adicionales y cuota personalizada. Volver al contrato anterior restaura las condiciones del plan comercial conservado, previa evaluación actual. Las empresas con Paddle quedan fuera de la asignación interna manual. Ver [asignación y validación](planes-asignacion-versiones-2026-09-21.md).

## Bloques de continuidad verificados

- **Colas productivas (P07):** consultas, simulación y acciones tienen controles en servicios; las escrituras revalidan bajo el lock de empresa. Retirar P07 conserva la ejecución de OT existentes por el tablero. Se verificaron los tres contratos publicados, la retirada antes de guardar y las rutas HTTP. Ver [política, evidencia y límites](planes-colas-productivas-2026-09-22.md).
- **Asignación de personal (P04):** reparto y reasignación supervisada usan su propia función, independiente de ETA. Revalidan al escribir y se detienen durante un checkout que retire P04. El diagnóstico identifica las asignaciones abiertas y exige revisar su continuidad. Las tareas existentes conservan responsables y ejecución. Ver [contrato, pruebas y límites](planes-asignacion-personal-2026-09-22.md).
- **ETA y reportes operativos (P05/A04):** las nuevas promesas y fotos diarias revalidan contrato y checkout pendiente dentro de su escritura atómica. Al retirar ETA se conserva el cierre real de las OT y de sus promesas anteriores. Reportes puede consultar ese historial sin contratar nuevas proyecciones; los umbrales tienen su propio control. Ver [alcance, pruebas y límites](planes-eta-reportes-2026-09-22.md).
- **Reportes y permisos (A01–A04):** catálogo, menú, enlaces, rutas y API comparten las condiciones de plan y permiso personal. Se probaron los cuatro grupos por separado y sin módulos opcionales de gestión; el historial financiero y productivo sigue consultable. El resumen conserva su permiso de lectura integral; las alertas operativas no filtran rentabilidad por el texto. Ver [matriz, evidencia y límites](planes-reportes-permisos-2026-09-22.md).
- **Cupones (R02):** las escrituras revalidan el contrato y las contrataciones pendientes bajo lock. El diagnóstico identifica descuentos comprometidos en presupuestos, conversiones parciales y OT abiertas antes de retirar la función. Concluidos esos compromisos, se conserva el historial en API e interfaz. Se corrigió además la validación del cupón al emitir una OT desde borrador. Ver [política, recorridos y límites](planes-cupones-continuidad-2026-09-22.md).
- **Fidelización (R03):** historial y saldos conservados al retirar la función; escrituras revalidadas dentro de la transacción y frente a checkouts pendientes. El diagnóstico exige resolver canjes y puntos prometidos antes del cambio. Liberación, transferencia parcial, acreditación y reversos protegen los saldos; ver [política, recorridos concurrentes y límites](planes-fidelizacion-continuidad-2026-09-22.md).
- **Arte y revisiones (C08):** disponible desde Archivos de una OT independiente, sin contratar campañas. Las escrituras revalidan el contrato; solicitudes pendientes y controles productivos incumplidos impiden retirar la función. El historial sigue consultable y las acciones de cierre siguen disponibles. Ver [recorrido, concurrencia y límites](planes-arte-continuidad-2026-09-22.md).
- **Precios especiales (T08):** reglas conservadas para consulta al retirar la función; el motor usa el precio general para nuevos cálculos y revalida el contrato antes de guardarlos. Los precios ya guardados se mantienen en presupuestos y OT, incluso al emitir o convertirlos. Su editor no queda bloqueado por retirar T07. Ver [política, recorrido y límites](planes-precios-especiales-2026-09-22.md).

### 1. Cerrar el control individual de todas las opciones

- **Copiado y CAD:** incorporado el control individual en cargas, tomos, servicios y guardado por el motor general. Las opciones y configuración respetan el contrato resuelto. Ver [cierre de este bloque](planes-copiado-impresion-2026-09-21.md). Cotización A4 y CAD verificadas en los tres planes asignados, sin impresión directa. CAD llega a una OT con rangos y copias por página; el guardado revalida cambios de contrato. Ver [evidencia CAD y límites](planes-cad-contrato-asignado-2026-09-22.md). Quedan otras combinaciones y transiciones.
- **Impresión:** conexión/perfiles/etiquetas directas usan `impresion_directa`; las etiquetas descargables tienen control propio I06; enviar documentos de OT y operar la cola exige también `colas_impresion`. Envíos, intenciones y liberación de lotes revalidan el contrato dentro de su transacción. La OT conserva historial paginado y verificación de salidas al retirar la función, sin cargar QZ. El diagnóstico de asignación y contratación distingue solicitudes sin envío y salidas sin verificar, exige aceptar su continuidad e invalida revisiones cuando cambian los pendientes. Ver [continuidad de impresión, pruebas y límites](planes-continuidad-impresion-2026-09-22.md). Las cuentas anteriores siguen bajo compatibilidad hasta que se les asigne una versión.
- **Geometría y fabricación:** controles incorporados en análisis, interpretación y edición de geometrías, preparación/nesting, exportación y recorridos, incluyendo workers y UI. Los recorridos guardados siguen consultables y descargables; el cálculo interno de costos se conserva. Ver [alcance y pruebas del bloque](planes-geometria-fabricacion-mcp-2026-09-21.md).
- **MCP:** creación y uso de credenciales verifican el plan vigente, incluso con autenticación cacheada. La persona conserva listado y revocación; se mantienen scopes, permisos e IP.
- **Circuito comercial:** C01–C06 tienen controles individuales de nuevas operaciones y continuidad histórica. Ver [alcance y pruebas](planes-comercial-pdf-enlaces-2026-09-21.md).
- **Etiquetas, stock, equipos y cuentas por cobrar:** I06/S01/P03/F02 tienen controles operativos y pruebas de desacople. Ver [alcance, continuidad y límites](planes-stock-equipos-cuentas-etiquetas-2026-09-21.md).
- **Clientes, empleados y catálogo técnico:** incorporado el control de configuración R01/R04/T01–T07, conservando lectura, versiones simples y continuidad de OT. Ver [alcance y pruebas](planes-catalogos-maestros-2026-09-21.md).
- **Tablero, estaciones y cobro básico:** P01/P02/F01 incorporan condiciones operativas al emitir y continuidad de trabajos anteriores. Ver [alcance y pruebas](planes-ejecucion-cobros-2026-09-21.md). Ninguna casilla se debe anunciar como completamente aplicada hasta validar todos sus recorridos y asignar contratos reales.
- **ARCA:** la verificación, activación y configuración de puntos de venta usan `fiscal_argentina`, revalidan bajo el lock de empresa y respetan cambios pendientes. Se preservan la consulta y desconexión al retirar la función; cambiar el CUIT obliga a verificar de nuevo. La creación/emisión y notas también revalidan F08. Se persiste la admisión antes de la red y se recuperan resultados inciertos sin reenviar; el diagnóstico reconoce sus pendientes. Ver [integración](planes-integracion-arca-2026-09-22.md) y [emisión, evidencia y límites](planes-emision-fiscal-2026-09-22.md). Quedan homologación externa, revisión visual, resolución de casos sin evidencia y migraciones entre emisores/ambientes.
- **Pantallas y automatismos:** el mapa `src/lib/capacidades.ts` cubre sólo parte de las rutas. Cada capacidad necesita revisar acceso por URL, API, servicios internos y trabajos en segundo plano; esconder el menú no alcanza.

La matriz al final distingue los controles encontrados de lo que queda por completar. “Control parcial” no certifica cobertura exhaustiva de todos sus caminos.

### 2. Publicar versiones y asignar contratos

Publicación y asignación interna implementadas. Los cupos definidos por el usuario son 250 GB / 500 GB / 1500 GB para Esencial / Pro / Avanzado. Editar un borrador posterior no modifica el contrato asignado.

El diagnóstico verifica usuarios, archivos, adicionales y compromisos detectados. Sólo un administrador con sesión personal y MFA puede confirmar. Se conserva el historial y se puede volver al contrato anterior.

### 3. Aplicar cambios sin dejar operaciones inconclusas

Definir una política por función retirada: bloquear nuevas operaciones, permitir finalizar las existentes, mantener consulta histórica, migrar o exigir resolución previa. Ejemplos: recibir una compra ya emitida, cerrar valores pendientes, tratar reservas activas, detener avisos aún no enviados y conservar trazabilidad de impresiones.

La asignación ya revalida al confirmar, serializa cambios de contrato/cupos y registra anterior, destino y motivo. Es idempotente y admite reversión. Bloquea la retirada de funciones con compromisos que requieren cierre previo; impresión tiene una vía de continuidad explícita y admite el cambio tras reconocer sus pendientes. Los casos sin conteo automático requieren revisión manual. Falta validar todas las transiciones y carreras con operaciones iniciadas simultáneamente en otros módulos.

Compras ya coordina sus escrituras con ese lock y restringe nuevos compromisos cuando un checkout pendiente retira sus funciones. Se verificaron ambos órdenes de confirmación con conexiones PostgreSQL independientes y un checkout que aparece mientras la compra espera. El incremento de finanzas y proyectos extiende la protección a egresos, recurrentes, valores y campañas, incluyendo una transferencia SERIALIZABLE y carreras reales de creación/reapertura de campañas. El incremento posterior incorpora reservas/necesidades, previsión independiente y planificación, con revalidación del worker, historial HTTP y carreras de reservas entre conexiones. Ver [evidencia de reservas y planificación](planes-continuidad-reservas-planificacion-2026-09-22.md). El siguiente incremento incorpora avisos Wati/WhatsApp Web, recuperación sin duplicados y resolución manual auditada: [alcance de avisos](planes-continuidad-avisos-2026-09-22.md). La consulta histórica de Egresos, Tesorería, Valores y Recurrentes se completó en el [incremento financiero](planes-historial-financiero-2026-09-22.md), sin conceder su gestión. Siguen pendientes otras combinaciones y recorridos del cierre global. Ver [evidencia y alcance](planes-continuidad-finanzas-proyectos-2026-09-22.md). Los accesos rápidos de creación del panel también respetan plan y estado de acceso. Ver [incremento y pruebas del 22/09](planes-cierre-comercial-2026-09-21.md).

### 4. Contratación comercial: sandbox verificado, producción pendiente

El almacenamiento y los precios están definidos: mensual USD 190 / 290 / 690, anual USD 1.900 / 2.900 / 6.900; adicional USD 15/mes o USD 150/año. Las versiones 3 tienen ambos ciclos activos en Paddle sandbox. Se probaron Esencial mensual con dos adicionales, cambio a Pro con tres, retirada de adicionales y cancelación programada e inmediata. El cierre agrega Esencial anual con dos adicionales por USD 2.200/año. Los webhooks aplicaron versiones, ciclos y cupos correctos. Ver [evidencia anual y cierre](planes-anuales-cierre-sandbox-2026-09-22.md).

Registro, web comercial, checkout y suscripción usan el catálogo publicado. Taller, Producción y Enterprise se retiraron de nuevas altas conservando contratos y precios históricos. Founder permanece interno. La cuenta sintética quedó dada de baja y el túnel temporal se cerró; no hubo cobros reales ni cambios en empresas operativas. Producción necesita sus propios precios, dominio y webhook, y verificación del correo real.

### 5. Validar combinaciones sobre contratos realmente asignados

Se agregaron doce escenarios con publicación y asignación reales en `gdi_saas_test`: cotización → presupuesto → aprobación comercial → OT → producción → cobro → entrega en los tres planes; copiado con rangos; transiciones de compras y producción; asignación por HTTP; empresa bloqueada; worker PDF y consulta de MFA. Ver [evidencia y límites de los recorridos](planes-recorridos-asignados-2026-09-21.md). Pasaron 129 pruebas en trece suites, incluida la regresión de los bloques afectados.

CAD con contratos asignados está comprobado en el [incremento del 22/09](planes-cad-contrato-asignado-2026-09-22.md). Faltan otras combinaciones permitidas por el editor, transiciones por función, carreras con operaciones de otros módulos y recorridos completos de navegador. La lectura histórica de Compras tras retirar esa función ya se habilitó y verificó por HTTP e interfaz, sin permitir nuevas operaciones.

Cada función se considera cerrada cuando su entrada está controlada, sus efectos complementarios se pueden retirar sin romper el recorrido base, sus antecedentes siguen siendo consultables según la política y tiene evidencia de esa combinación.

## Independencia no significa eliminar todas las dependencias

Un cotizador necesita materiales, productos y reglas para calcular. Lo que debe ser opcional es, por ejemplo, reservar stock, abrir compras o enviar el resultado a una impresora. La impresión no debería ser requisito para cotizar, y una compra no debería ser requisito para guardar un presupuesto.

El editor ya conoce relaciones obligatorias. Durante el cierre hay que contrastarlas con el código: cuando una relación sea indispensable, debe validarse; cuando sea un complemento, debe tener una alternativa operativa explícita.

## Orden concreto para continuar

La QA visual específica y un envío/recuperación fiscal real en homologación se completaron en el [cierre del 22/09](planes-qa-visual-homologacion-2026-09-22.md). AFIP SDK ya administra los tickets en su API; Grafo conserva una caché local validada y agrupa solicitudes simultáneas. Los envíos antiguos sin evidencia concluyente mantienen revisión manual.

El cierre actual está completado en desarrollo/sandbox: los anuales tienen diez mensualidades, las ofertas v3 están activas y se verificó un checkout anual con adicionales. La suscripción de prueba quedó cancelada y el túnel cerrado.

Al lanzamiento de Grafo, según decisión expresa del usuario, configurar y verificar el entorno comercial de producción con correo, precios, dominio y webhook propios. Sandbox no certifica ese entorno; esa activación queda fuera del cierre actual.

No usar «todas las combinaciones» como una fase indefinida. Cada nuevo hallazgo debe identificar operación, condición de contrato, resultado esperado y prueba que falta. La [auditoría consolidada](planes-auditoria-consolidada-2026-09-22.md) mantiene los criterios de aceptación y la evidencia por bloque.

## Revisión visual de Plataforma realizada en este incremento

- Activación del ámbito HeroUI en el contenedor de Plataforma y retiro de ámbitos `legacy` en las superficies migradas. Se corrigió también el uso ambiguo del token `muted`, que podía volver casi invisible el texto del catálogo actual.
- Botones Grafo y campos compartidos en Empresas, Suscripciones, Equipo, invitaciones, editor/comparación de planes e Impersonación. Selectores de empresa/plan detectables y con navegación por teclado.
- Encabezados, tablas, identidad, cupos e historial alineados con el grafito, acento y superficies del sistema. Se preservó el scroll interno y el pie separado del editor.
- Suscripciones ahora divide **Resumen / Usuarios y cupos / Eventos de Paddle / Historial de consultas**. Los historiales se consultan al abrir su pestaña.
- Formularios con contenido desplazable y pie de acciones separado, incluido el estado de error de consulta a Paddle.
- Corrección de etiquetas deformadas o recortadas en gráficos, contraste de los filtros de período y posición inicial al cambiar de sección/ficha.

Verificación: 40 pruebas de interfaz en ocho suites, TypeScript web, lint focal y control de CSS. Recorrido autenticado en Chrome por las siete secciones, pestañas de empresas/equipo/planes/suscripciones y formularios de alta, invitación, consulta y soporte, sin enviar esas operaciones. La suscripción de prueba no tiene eventos ni consultas manuales: allí se verificaron los estados vacíos; las tablas con registros se comprobaron en Empresas y Equipo.

Los cambios de aquella revisión visual fueron de interfaz y documentación. Los incrementos comerciales posteriores del 22/09 sí publicaron y activaron las ofertas de sandbox, según la evidencia enlazada arriba.

## Matriz de las 65 funciones

Leyenda: **Base** = capacidad compartida que no se vende por separado; **Control parcial** = existen controles y contratos publicados, pero falta evidencia integral de todos los caminos y transiciones; **Grupo anterior** = habilitación histórica compartida; **Pendiente** = falta completar el control individual. Estas etiquetas describen la separación por plan, no si el módulo existe o puede utilizarse hoy.


| ID | Función | Separación por plan |
| --- | --- | --- |
| B01 | Identidad, perfil y MFA (`identidad`) | Base |
| B02 | Usuarios, roles y permisos (`roles`) | Base |
| B03 | Empresa y marca (`empresa`) | Base |
| B04 | Archivos y versiones (`archivos`) | Base |
| B05 | Notificaciones internas (`notificaciones`) | Base |
| B06 | Cuenta y suscripción (`cuenta`) | Base |
| C01 | Cotizador completo (`cotizacion`) | Control parcial |
| C02 | Presupuestos (`presupuestos`) | Control parcial |
| C03 | Aprobación pública de presupuestos (`aprobacion_presupuestos`) | Control parcial |
| C04 | Documentos PDF (`documentos_pdf`) | Control parcial |
| C05 | Órdenes y entrega (`ordenes`) | Control parcial |
| C06 | Seguimiento y QR (`seguimiento_qr`) | Control parcial |
| C07 | Campañas y proyectos (`proyectos`) | Control parcial |
| C08 | Aprobación de arte y revisiones (`aprobacion_arte`) | OT independiente, contrato y continuidad verificados; ver alcance C08 |
| R01 | Clientes y contactos (`clientes`) | Control parcial |
| R02 | Cupones (`cupones`) | Control individual + compromisos e historial; recorridos y límites documentados |
| R03 | Fidelización (`fidelizacion`) | Control individual + compromisos e historial; recorridos y límites documentados |
| R04 | Registro de empleados (`empleados`) | Control parcial |
| T01 | Materiales, variantes y costos (`materiales`) | Control parcial |
| T02 | Productos y formularios (`productos`) | Control parcial |
| T03 | Productos compuestos y recetas (`productos_compuestos`) | Control parcial |
| T04 | Procesos y flujos (`procesos`) | Control parcial |
| T05 | Centros de costo y tarifas (`centros_costo`) | Control parcial |
| T06 | Maquinaria y consumos (`maquinaria`) | Control parcial |
| T07 | Precios, impuestos y monedas (`reglas_precio`) | Control parcial |
| T08 | Precios especiales por cliente (`precios_especiales`) | Configuración, cálculo, guardado y continuidad verificados; ver alcance T08 |
| G01 | Medición y análisis vectorial (`analisis_vectorial`) | Control parcial |
| G02 | Geometrías del producto (`geometrias`) | Control parcial |
| G03 | Aprovechamiento para cotizar (`aprovechamiento_cotizacion`) | Control parcial |
| G04 | Exportación de fabricación DXF (`exportacion_fabricacion`) | Control parcial |
| G05 | Recorridos y plantillas de fabricación (`recorridos_fabricacion`) | Control parcial |
| I01 | Centro de copiado: documentos (`centro_copiado`) | Control parcial |
| I02 | Terminaciones y tomos (`terminaciones_copiado`) | Control parcial |
| I03 | Cotización de planos CAD (`cotizacion_cad`) | Control parcial |
| I04 | Impresión conectada (`impresion_directa`) | Control parcial |
| I05 | Asistente y colas de impresión (`colas_impresion`) | Control parcial |
| I06 | Etiquetas descargables (`etiquetas_pdf`) | Control parcial |
| P01 | Tablero y tareas (`tablero`) | Control parcial |
| P02 | Estaciones y calendarios (`estaciones`) | Control parcial |
| P03 | Equipos productivos (`equipos_produccion`) | Control parcial |
| P04 | Asignación automática de personal (`asignacion_automatica`) | Control parcial |
| P05 | Estimación según capacidad (`eta_capacidad`) | Control parcial |
| P06 | Escenarios y reprogramación (`planificacion_avanzada`) | Control parcial |
| P07 | Optimización de colas productivas (`colas_produccion`) | Control parcial |
| S01 | Existencias y movimientos (`existencias`) | Control parcial |
| S02 | Reservas automáticas por OT (`reservas`) | Control parcial |
| S03 | Previsión de faltantes (`prevision_materiales`) | Control parcial |
| S04 | Proveedores y reposición (`proveedores`) | Control parcial |
| S05 | Compras y abastecimiento (`compras`) | Control parcial |
| S06 | Recepciones de materiales (`recepciones`) | Control parcial |
| F01 | Cobros, señas y recibos (`cobros`) | Control parcial |
| F02 | Saldos y cuentas por cobrar (`cuentas_cobrar`) | Control parcial |
| F03 | Tesorería y conciliación (`tesoreria`) | Control parcial |
| F04 | Valores y cheques (`valores`) | Control parcial |
| F05 | Egresos y cuentas por pagar (`cuentas_pagar`) | Control parcial |
| F06 | Gastos recurrentes (`gastos_recurrentes`) | Control parcial |
| F07 | Gastos fijos y costos (`gastos_fijos`) | Control parcial |
| F08 | Comprobantes y ARCA (Argentina) (`fiscal_argentina`) | Control individual + admisión y recuperación persistida; límites de homologación y casos sin evidencia documentados |
| A01 | Resumen comercial y operativo (`reportes_resumen`) | Control parcial |
| A02 | Análisis financiero y márgenes (`reportes_finanzas`) | Control parcial |
| A03 | Análisis de productos y clientes (`reportes_comerciales`) | Control parcial |
| A04 | Análisis de capacidad y equipo (`reportes_produccion`) | Control parcial |
| X01 | WhatsApp: avisos automáticos (`whatsapp_automatico`) | Control parcial |
| X02 | WhatsApp Web y contexto comercial (`whatsapp_web`) | Control parcial |
| X03 | Cotización mediante MCP (`mcp`) | Control parcial |
