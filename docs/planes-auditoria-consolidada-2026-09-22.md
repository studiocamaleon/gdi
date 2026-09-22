# Auditoría consolidada de planes

Fecha: 22/09/2026. Rama: `codex/rediseno-backoffice-plataforma`.

## Resultado y alcance

El editor está conectado con publicaciones inmutables, contratos asignados, controles de capacidades, permisos, cupos y contratación mensual y anual en Paddle sandbox. Las 65 entradas del catálogo tienen implementación y evidencia por bloque, detallada abajo. No se encontró una función del catálogo que siga siendo únicamente una casilla visual.

**Cierre comercial confirmado:** anuales equivalentes a diez mensualidades, dos meses bonificados. Versiones 3 activas en sandbox, con pago anual y adicionales comprobados. La activación de cobros reales se difirió expresamente al lanzamiento de Grafo. Ver [importes, ofertas y evidencia anual](planes-anuales-cierre-sandbox-2026-09-22.md).

Esta revisión consolida los incrementos anteriores. Sus apartados «siguiente etapa» describen el momento en que se escribieron: no son una lista acumulativa de trabajo pendiente. Por ejemplo, publicación, CAD, continuidad financiera, recuperación de contrataciones y precios especiales ya fueron abordados después de aparecer como pendientes en documentos anteriores.

La aceptación técnica se basa en entradas protegidas, dependencias explícitas, alternativas al retirar complementos, continuidad de antecedentes y recorridos representativos con contratos persistidos. No equivale a probar todas las combinaciones posibles de 65 funciones ni a certificar los servicios externos en producción.

## Criterios de aceptación y evidencia

| Criterio | Evidencia actual |
| --- | --- |
| El borrador no concede derechos | Publicación y asignación separadas; evaluador lee versión asignada o contrato histórico compatible. Pruebas de borradores, versiones y asignación. |
| Una versión publicada no cambia al editar | Protección del servicio y de PostgreSQL, revisión, auditoría e historial. |
| Menú, API y operaciones usan el contrato | Matrices de capacidades comerciales, maestros, fabricación, copiado, operación y ejecución; pruebas de rutas e interfaz. Ocultar un botón no sustituye el control del servidor. |
| El permiso personal sigue siendo necesario | Pruebas de Plataforma, reportes, catálogos y operaciones con función incluida pero permiso denegado. |
| Los complementos se pueden retirar | Cotizar sin reservas/compras/impresión, presupuestar sin enlace/PDF, entregar sin tablero y calcular con precio general sin excepciones de cliente. |
| Se conserva el trabajo existente | Políticas por bloque: consulta histórica, cierre de compromisos, advertencia con aceptación o impedimento de retirada, según el caso. |
| El cambio se revalida al escribir | Asignación bajo lock de empresa, diagnóstico con huella y revalidación operativa; casos concurrentes reales en compras, finanzas, reservas, avisos, arte y emisión fiscal. Otros bloques fuerzan el cambio entre lectura y guardado en la transacción de prueba. |
| Los límites tienen efectos reales | Usuarios activos/invitaciones/adicionales; bytes guardados/reservas de subida; menor cupo durante contratación pendiente. |
| La oferta mensual y anual llega al contrato | Alta y checkout sandbox, webhooks firmados, Esencial mensual +2, cambio a Pro +3, retirada de adicionales y cancelaciones comprobados. El cierre anual agrega Esencial +2 por USD 2.200/año, versión 3, cupo de cinco y baja al finalizar el ensayo. Founder y contratos anteriores preservados. |
| Esencial, Pro y Avanzado recorren el sistema | Publicación/asignación reales en `gdi_saas_test`, cotización → presupuesto → OT → producción → cobro → entrega, además de A4/CAD y transiciones específicas. |

## Inventario de las 65 funciones

Cada fila remite a la política y las pruebas del bloque. «Verificado» en esos documentos siempre está limitado a los escenarios que se describen; las pruebas de servicios, de contratos persistidos, de concurrencia y de navegador se identifican por separado.

| IDs | Funciones | Evidencia principal |
| --- | --- | --- |
| B01–B06 | Identidad/MFA, roles, empresa, archivos, notificaciones y cuenta | [Evaluador, usuarios y almacenamiento](planes-evaluador-desacople-2026-09-21.md), [MFA recordada](mfa-dispositivos-recordados-2026-09-21.md), [contratos asignados](planes-recorridos-asignados-2026-09-21.md) |
| C01–C06 | Cotizador, presupuestos, aprobación comercial, PDF, OT/entrega y seguimiento | [Circuito comercial](planes-comercial-pdf-enlaces-2026-09-21.md), [recorridos asignados](planes-recorridos-asignados-2026-09-21.md) |
| C07 | Campañas y proyectos | [Continuidad de finanzas y proyectos](planes-continuidad-finanzas-proyectos-2026-09-22.md) |
| C08 | Arte y revisiones | [OT independiente, revisiones y gates](planes-arte-continuidad-2026-09-22.md) |
| R01, R04 | Clientes y empleados | [Catálogos maestros](planes-catalogos-maestros-2026-09-21.md) |
| R02 | Cupones | [Compromisos y continuidad](planes-cupones-continuidad-2026-09-22.md) |
| R03 | Fidelización | [Puntos, canjes y continuidad](planes-fidelizacion-continuidad-2026-09-22.md) |
| T01–T07 | Materiales, productos/recetas, procesos, costos, maquinaria y precios generales | [Catálogos maestros](planes-catalogos-maestros-2026-09-21.md) |
| T08 | Precios especiales por cliente | [Configuración, cálculo y continuidad](planes-precios-especiales-2026-09-22.md) |
| G01–G05 | Análisis vectorial, geometrías, aprovechamiento, exportación y recorridos | [Fabricación y workers](planes-geometria-fabricacion-mcp-2026-09-21.md) |
| I01–I03 | Documentos, terminaciones/tomos y planos CAD | [Copiado](planes-copiado-impresion-2026-09-21.md), [CAD con contratos asignados](planes-cad-contrato-asignado-2026-09-22.md) |
| I04–I05 | Impresión conectada y asistente/colas | [Admisión e historial de impresión](planes-continuidad-impresion-2026-09-22.md) |
| I06 | Etiquetas descargables | [Etiquetas independientes de QZ](planes-stock-equipos-cuentas-etiquetas-2026-09-21.md) |
| P01–P02 | Tablero, tareas, estaciones y calendarios | [Ejecución y continuidad](planes-ejecucion-cobros-2026-09-21.md), [recorridos asignados](planes-recorridos-asignados-2026-09-21.md) |
| P03 | Equipos productivos | [Equipos y operación histórica](planes-stock-equipos-cuentas-etiquetas-2026-09-21.md) |
| P04 | Asignación automática | [Personal independiente de ETA](planes-asignacion-personal-2026-09-22.md) |
| P05 | Estimación según capacidad | [ETA y referencias históricas](planes-eta-reportes-2026-09-22.md) |
| P06 | Escenarios y reprogramación | [Planificación y cambios de contrato](planes-continuidad-reservas-planificacion-2026-09-22.md) |
| P07 | Optimización de colas productivas | [Colas productivas](planes-colas-productivas-2026-09-22.md) |
| S01 | Existencias y movimientos | [Stock](planes-stock-equipos-cuentas-etiquetas-2026-09-21.md) |
| S02–S03 | Reservas y previsión | [Reservas y previsión independientes](planes-continuidad-reservas-planificacion-2026-09-22.md) |
| S04–S06 | Proveedores, compras y recepciones | [Controles](planes-evaluador-desacople-2026-09-21.md), [historial y compras concurrentes](planes-cierre-comercial-2026-09-21.md) |
| F01–F02 | Cobros y cuentas por cobrar | [Cobros de OT anteriores](planes-ejecucion-cobros-2026-09-21.md), [cuentas por cobrar](planes-stock-equipos-cuentas-etiquetas-2026-09-21.md) |
| F03–F07 | Tesorería, valores, egresos, recurrentes y gastos fijos | [Control individual](planes-evaluador-desacople-2026-09-21.md), [continuidad](planes-continuidad-finanzas-proyectos-2026-09-22.md), [historial financiero](planes-historial-financiero-2026-09-22.md) |
| F08 | Comprobantes y ARCA | [Integración](planes-integracion-arca-2026-09-22.md), [admisión y recuperación fiscal](planes-emision-fiscal-2026-09-22.md) |
| A01–A04 | Resumen y reportes financieros/comerciales/productivos | [Permisos y planes de reportes](planes-reportes-permisos-2026-09-22.md), [ETA y reportes](planes-eta-reportes-2026-09-22.md) |
| X01–X02 | WhatsApp automático y Web | [Avisos, continuidad y recuperación](planes-continuidad-avisos-2026-09-22.md) |
| X03 | MCP | [Autenticación, uso y revocación](planes-geometria-fabricacion-mcp-2026-09-21.md) |

## Regresión completa del repositorio

Se ejecutaron las suites completas de API, web y marketing. La API utilizó exclusivamente `gdi_saas_test`.

- **API:** 4.038 casos detectados; 12 omitidos por sus condiciones preexistentes. El barrido inicial encontró 60 fallos en 13 archivos. Se corrigió la preparación de esas pruebas y se repitieron los 13 archivos: 156/157 aprobados. El último archivo PDF pasó luego sus 14 casos. Resultado consolidado: **4.026 casos habilitados aprobados**.
- **Web:** 1.731 casos iniciales; tres fallos en una prueba de Estaciones que no proporcionaba el contrato a la página. Se corrigió esa preparación y se agregó la exclusión de Estaciones con permiso personal presente. Los cinco casos de la página y los doce del helper pasaron: **1.732 casos habilitados aprobados**, combinando el barrido y la repetición focal.
- **Marketing:** **8/8** aprobados con su configuración propia de Vitest.

No se repitió todo el repositorio después de modificar únicamente pruebas. Los resultados anteriores son la consolidación del barrido y las repeticiones focales, no una afirmación de una segunda ejecución completa sin fallos.

También pasaron TypeScript de producción de API, TypeScript web, lint de los archivos de pruebas modificados y `git diff --check`. Se comprobaron los enlaces locales de este documento. No se hizo commit, merge ni push en este incremento.

Las correcciones conservaron las expectativas de negocio. Las pruebas de integración de OT/lotes/reservas/PDF ahora construyen los servicios de arte y fidelización reales; las unitarias proporcionan sus dependencias explícitas. La prueba de aislamiento de compras usa una segunda empresa existente, para comprobar el acceso a una compra ajena en lugar de detenerse ante una empresa inexistente. No se debilitó ningún control de producción para lograr que pasaran.

Los 12 casos omitidos corresponden a fixtures locales de catálogo (5), benchmarks de nesting (3), integración optativa del worker Redis (1) y motor externo OpenNest/Puma (3). Este barrido no aporta evidencia nueva de esos escenarios.

## Revisión de navegador y límites pendientes

Chrome vuelve a estar disponible. Se verificaron el historial de versiones y la tabla de contrataciones de la empresa ficticia, con sus cuatro intentos y el detalle del checkout aplicado. El modal aplicado muestra antecedentes y cierre, sin acciones de recuperación ni cobro. API y Backoffice responden HTTP 200. No se modificaron empresas operativas ni se reabrió el túnel.

La [revisión visual y homologación posterior](planes-qa-visual-homologacion-2026-09-22.md) completó los tres estados específicos con componentes reales y respuestas simuladas en Chrome, y un envío/recuperación real en homologación fiscal. También corrigió dos detalles de presentación y reforzó la caché local de tickets (56 pruebas API y 11 web focales aprobadas). Son evidencias distintas: la revisión visual aislada no se presenta como una sesión autenticada de empresa y el ensayo externo no se presenta como certificación de producción.

Decisiones finales del usuario y alcance de lanzamiento:

1. **Precio anual resuelto y probado:** USD 1.900 / 2.900 / 6.900, adicional USD 150/año. Las ofertas vigentes son versiones 3 y ofrecen ambos ciclos. [Evidencia del cierre anual](planes-anuales-cierre-sandbox-2026-09-22.md).
2. **Venta en producción diferida al lanzamiento de Grafo:** configurar y verificar precios, dominio/checkout, webhook y correo del entorno real. Queda fuera del cierre actual por decisión del usuario. La evidencia externa disponible es sandbox.

La API de AFIP SDK ya conserva/renueva los tickets del lado del proveedor; se corrigió el supuesto anterior de que esta integración necesitaba obligatoriamente un Redis propio. El alcance y la fuente están en el documento de homologación. La numeración y los envíos siguen coordinándose en la base de Grafo. Los borradores fiscales antiguos numerados sin evidencia conservan revisión manual; no se reenvían automáticamente.

Un resultado remoto incierto sin evidencia no debe marcarse como fallido ni liberarse por tiempo. Conservar su bloqueo es la política implementada, no un motivo para volver a enviar un cobro o comprobante durante las pruebas.

## Compilación y mensajes finales del editor

Se compilaron la aplicación (Next 16.1.6/Turbopack), marketing (Next 16.3.3/Turbopack) y la API. Los tres comandos terminaron correctamente. En la API se corrigió el empaquetado:

- `build` permite hasta 4 GB de heap: el límite automático de aproximadamente 2 GB agotó memoria en la compilación limpia del modelo. La aplicación privada no genera declaraciones de biblioteca y compila sólo `src`; los scripts de mantenimiento siguen ejecutándose por separado.
- Se fijó la raíz de salida para conservar `dist/src` y se verificaron los diez recursos de fuentes, Python y Lua contra sus archivos fuente.
- El seguimiento de recursos queda en los comandos de desarrollo; un build de producción termina sin mantener watchers.
- `start:prod` apunta a `dist/src/main.js` y precarga la configuración antes de los módulos que validan secretos. `dotenv` quedó declarado como dependencia directa con su lock.

El paquete compilado arrancó con la configuración **local** existente: `/api` respondió 200 y la sesión autenticada de Plataforma cargó el editor y su revisión. Esto verifica el artefacto; no equivale a desplegar en un host de producción ni a activar credenciales live.

El catálogo distingue ahora controles **implementados** de estados parciales/pendientes. Se actualizaron las notas antiguas que anunciaban como pendientes etapas ya documentadas en esta auditoría. Esta etiqueta se refiere al control por plan en el sistema, no a certificar cualquier configuración de un proveedor externo. Se conservaron las limitaciones de canales externos, pilotos y adicionales. Las versiones históricas y sus snapshots no se reescribieron.

La revisión comercial evalúa únicamente las funciones incluidas, no pide completar otra vez los recorridos ya implementados y distingue un mensual configurado de un anual opcional sin definir. Dirige a Versiones para consultar la oferta vigente; no asegura desde el borrador que un precio esté o no vinculado a Paddle. Se comprobó el texto final en Chrome.

Verificación focal: **44 pruebas API** de borradores, versiones y ofertas; **18 pruebas web** de editor y comparación; lint focal y `git diff --check` aprobados. Los builds incorporan el chequeo de tipos; el último ajuste de textos se verificó con las pruebas web y la vista en desarrollo. Las ofertas vigentes se consultaron directamente: versión 2 de Esencial/Pro/Avanzado, sólo mensual, en sandbox, con los importes autorizados. No se hicieron cambios comerciales ni publicaciones durante esta comprobación.
