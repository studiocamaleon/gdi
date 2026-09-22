# Planes: desacople de copiado e impresión

Fecha: 21/09/2026. Rama: `codex/rediseno-backoffice-plataforma`.

## Resultado de este bloque

Centro de copiado consulta las capacidades resueltas para la empresa. Cotizar y guardar documentos no depende de CAD, terminaciones ni impresión conectada. La emisión normal de la OT continúa disponible sin abrir el asistente de impresión.

| Operación | Capacidad requerida | Si no está incluida |
| --- | --- | --- |
| Cotizar y guardar documentos, con páginas, rangos, copias, color y faz | `centro_copiado` | Se ocultan las entradas nuevas y la API rechaza nuevas cargas. |
| Cotizar planos por rollo y configurar páginas CAD | `centro_copiado` + `cotizacion_cad` | No se consulta el catálogo CAD ni se ofrece su pestaña para cargas nuevas. Un PDF identificado como plano grande se rechaza con explicación, sin reducirlo automáticamente. |
| Terminaciones y agrupaciones en tomos | `centro_copiado` + `terminaciones_copiado` | No se ofrecen terminaciones ni agrupaciones nuevas. La configuración guardada se conserva. |
| Configurar conexiones, impresoras, bandejas, perfiles, pruebas y enviar etiquetas | `impresion_directa` | No se ofrecen estas acciones y la API las rechaza. |
| Emitir e imprimir documentos de OT; solicitar, liberar y enviar trabajos desde el asistente | `impresion_directa` + `colas_impresion` | Se mantiene la emisión normal de la OT sin el asistente. |
| Registrar estados y confirmar un envío ya creado | Sesión autorizada, empresa operativa y pertenencia del envío | La retirada de impresión no impide registrar su resultado; esta vía no genera firmas ni nuevos envíos. |

La descarga manual de etiquetas conserva su independencia de QZ. El control individual de `etiquetas_pdf` pertenece al cierre pendiente de órdenes, PDF y QR; este bloque no lo presenta como terminado.

## Controles del servidor

- `CapacidadesEmpresaService.exigirTodas()` resuelve una sola vez el contrato para verificar un conjunto de funciones. No recibe derechos desde el navegador.
- Las cargas se clasifican por su contenido completo: documentos, CAD, terminaciones y grupos. Un lote mixto con una función excluida se rechaza antes de calcular, guardar o reutilizar una respuesta idempotente.
- `CentroCopiadoService` controla cotización, construcción de ítems, alta en borrador, guardado de tomos y configuración. `CentroCopiadoCadService` exige Documentos y CAD antes de consultar o calcular.
- El motor general controla los metadatos `_centroCopiado` al cotizar y guardar. También reconoce la plantilla reservada de copiado aunque se omitan esos metadatos, y controla sus pasos opcionales de terminación.
- Los endpoints de colas y documentos exigen conexión y colas. El servicio vuelve a comprobarlas antes de preparar, firmar, solicitar o liberar trabajos.
- Actualizar el resultado de un envío existente conserva las comprobaciones de orden, empresa, intento y permisos. No habilita una reimpresión. Una suscripción suspendida sigue sometida al control global de acceso.

No se cambia el contrato de los productos generales de impresión: la función CAD de este bloque corresponde al recorrido especializado de Centro de copiado.

## Interfaz e históricos

La navegación de Configuración, sus accesos por URL, el modal de copiado, los botones de emisión y el proveedor del asistente usan el mapa común de capacidades. Cuando ese mapa está presente, tiene prioridad sobre la bandera histórica de impresión.

Los documentos, archivos, tomos y configuraciones existentes no se borran al retirar una función. Una carga histórica que contiene CAD o terminaciones excluidas muestra el motivo y bloquea el recálculo y guardado mientras conserve esa configuración. No elimina silenciosamente esos datos para convertirla en una carga más básica.

La configuración de terminaciones se conserva deshabilitada y se omite de las actualizaciones de otros ajustes cuando está fuera del plan. Esto permite seguir configurando Documentos sin sobrescribir los datos de anillado.

La continuidad de envíos anteriores implementada aquí es del lado del servidor. No equivale a una política completa de cambio de plan: todavía falta ofrecer y aplicar la transición con operaciones abiertas, incluida la revisión de colas por un operario. El servidor no confirma la salida física del papel.

## Verificación

- 136 pruebas focales de API en nueve suites, completadas entre la corrida conjunta y la reejecución de las dos suites de copiado/colas. Cubren rechazo de lotes mixtos, tomos sin anillo, metadatos históricos, plantilla reservada sin metadatos, acceso por controlador y servicio, y separación de conexión frente a colas.
- PostgreSQL: documentos construidos y guardados con CAD, terminaciones, conexión y colas desactivados; regresión del recorrido básico de cotización y OT; concurrencia, aislamiento de empresas, páginas CAD y continuidad de envíos al retirar impresión.
- Interfaz: 27 pruebas en cinco suites. Incluyen carga mixta de PDF sin CAD, conservación de cargas históricas, navegación y montaje del asistente según ambas capacidades.
- Chrome autenticado: revisión del modal con Founder, pestañas Documentos y Planos CAD, catálogo CAD y presencia del asistente. Sin emitir una OT ni enviar papel a una impresora.
- TypeScript web, API con `tsconfig.build.json`, comprobación focal de tipos de las seis pruebas API modificadas/nuevas y control de CSS correctos. La comprobación completa de tipos de API incluye otras pruebas con errores pendientes; no se presenta como limpia.
- Lint web focal correcto. Comparación del lint API con HEAD: sin errores nuevos; permanecen diez errores previos en los archivos revisados, excluyendo la regla de formato de esa comparación.

## Lo que todavía falta para usar las casillas con empresas reales

El resolvedor vigente sigue leyendo `Suscripcion.plan.featuresJson` mediante `contratoCompatible()`. Las pruebas de combinaciones individuales sustituyen el contrato resuelto; los borradores del editor **todavía no se publican ni se asignan a empresas**.

Por tanto, este bloque agrega los controles y alternativas operativas que necesitarán los contratos publicados, conservando el comportamiento de las cuentas actuales. No aplica las propuestas Esencial, Pro o Avanzado a clientes existentes.

El siguiente bloque es fabricación/geometría y MCP; después se completa el resto de funciones seleccionables. La publicación inmutable, asignación con diagnóstico y continuidad, migración de una empresa de prueba y contratación comercial siguen el orden del [estado real y camino de cierre](planes-estado-real-y-cierre-2026-09-21.md).
