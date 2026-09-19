# Impresión operativa: configuración, envío y preparación

**Documento vivo · 18/09/2026 · v0.16**

**Estado:** etapas 1 y 2 implementadas en `codex/mejoras-lista-produccion`, junto con el envío CAD desde OT y el asistente visual aprobado. Hay perfiles compartidos, preparación por selección, cola persistida, reserva contra envíos duplicados, columnas por máquina y seguimiento simultáneo de impresoras del mismo puesto QZ. Centro de copiado conserva rangos, medidas y cantidades por página CAD; el servidor prepara los originales al 100%.

El usuario ya confirmó pruebas físicas de B/N, Color, bandeja y lámina fija del HP T950 con rollo de 914 mm. **La nueva integración OT → cola → planos reales necesita la prueba física de aceptación** indicada más abajo. El conector residente sigue planificado: el navegador ejecuta los envíos y recibe eventos; cerrar la pestaña conserva los pendientes, pero interrumpe su ejecución y seguimiento.

## Disponibilidad por plan y cotización independiente (v0.16)

- `impresionDirecta` es una capacidad explícita del plan. La migración la habilita sólo en Founder. `todo: true`, el plan Trial y las cuentas legacy no la heredan. Se puede habilitar en otro plan más adelante sin cambiar el circuito comercial.
- `centroCopiado` conserva sus reglas actuales. Cotizar, cargar archivos/rangos/copias, emitir OT y descargar originales no requieren QZ. La descarga manual de etiquetas conserva el QR de entrega y el tamaño de 100 × 150 mm.
- El catálogo CAD comercial se obtiene de las recetas activas, las máquinas PLOTTER_CAD y los materiales de rollo compatibles. El selector muestra producto, papel y máquina. No consulta conexiones, bandejas ni pruebas físicas. Mantiene las restricciones actuales del piloto (receta simple con material fijo, rollos hasta 914,4 mm y 5 mm de margen).
- Las nuevas cotizaciones guardan una selección comercial y su revisión. Al enviar, se busca un perfil de impresión compatible con máquina, receta, variante, color, gramaje y ancho. Cambiar QZ no invalida una cotización; una modificación comercial requiere recalcular.
- La migración traslada al material el gramaje guardado sólo en perfiles CAD cuando todos coinciden y el material no tiene uno definido. Si un rollo no declara gramaje, puede cotizarse por su variante exacta sin inferir el valor de su nombre.
- Las OT anteriores conservan sus datos e historial. Un adaptador permite recotizar las selecciones históricas; al editar una carga antigua la UI puede pedir actualizar la configuración comercial. La verificación de versiones de los envíos históricos sigue vigente.
- Sin la capacidad, la emisión ofrece sólo Emitir OT, no se monta el asistente ni se consulta su cola y no se ofrece Configuración → Impresoras. El SDK QZ se importa al usar una acción de conexión/impresión. Los endpoints de impresión directa y configuración validan el plan en cada solicitud; la vista manual de etiquetas permanece disponible con sus permisos habituales.
- Desactivar la capacidad conserva configuraciones y eventos, impide preparar nuevos envíos y no cancela trabajos ya aceptados por Windows. Los permisos del usuario y la suscripción activa siguen siendo requisitos adicionales.

**Validación del desacople:** TypeScript y lint de los archivos modificados; pruebas de sesión, autorización HTTP por plan, catálogo y cotización CAD sin acceso a tablas de impresión, compatibilidad de destinos, navegación, cola y etiquetas manuales. Migraciones aplicadas en desarrollo y en la base aislada de pruebas. Cotización visual del PDF CAD de Grafo con tamaños mixtos, sin emitir una OT ni imprimir durante esta validación.

## 1. Objetivo y recorrido

Que el comercial emita una OT y envíe los documentos que pueden imprimirse con la configuración disponible. Los que requieren cargar papel quedan identificados para el operario, conservando parámetros, archivos y trazabilidad.

1. Cotizar y adjuntar originales en Centro de copiado, con rangos, copias, papel, gramaje, formato, color, faz y terminaciones.
2. Elegir **Emitir e imprimir**. Revisar una tabla compacta de archivos, configuración, destino y acción prevista.
3. Guardar la OT y confirmar sus archivos. Registrar los trabajos de impresión en forma durable; una falla de impresión no revierte ni vuelve a emitir la OT.
4. Enviar los que tienen un destino validado y preparado. Los demás permanecen pendientes con un motivo y una acción concreta.
5. Seguir los envíos desde un panel compacto; el operario prepara y libera los pendientes desde **Producción → Colas de trabajo**.

La distinción central es **capacidad de la máquina**, **configuración del envío** y **preparación actual**. Una Ricoh puede admitir cierto papel, pero eso no significa que ese papel esté cargado, que la bandeja lo admita a doble faz ni que el controlador esté configurado para él.

## 2. Qué existe hoy (etapas 1 y 2)

| Tema | Implementación actual | Siguiente validación/ampliación |
| --- | --- | --- |
| Destinos | Documentos, CAD y etiquetas; perfiles compartidos vinculados a máquinas y bandejas. | Instalación asistida mediante conector. |
| Elegibilidad | A4 B/N/Color y CAD a tamaño real; perfil probado, material, preparación y reglas de producción. | Prueba física de OT mixta en las tres máquinas. |
| Preparación | Selección del mismo perfil entre distintas OT; confirmación de papel con usuario y versión. | Política operativa de reposición y cambios de turno. |
| Cola | Intenciones persistidas por documento/página, orden por fecha de entrega, OT, paso y página. | Outbox de emisión, cancelación individual y ejecutor residente. |
| Impresión | PDF y opciones firmados; reserva de un intento por trabajo, reimpresión explícita. | Workers/cache de derivados y métricas de carga. |
| Seguimiento | Varias impresoras del mismo QZ, estados e intentos persistidos; panel minimizable. | Conectores para seguimiento continuo y varios puestos independientes. |
| Confirmación | Verificación física por documento/página, separada del estado de Windows y del cierre de producción. | Aceptación operativa del recorrido completo. |

Referencias de implementación:

- `src/lib/impresora-puesto.ts` y `src/components/impresion/impresora-puesto-form.tsx`: destinos locales.
- `src/components/impresion/documentos-impresion-provider.tsx`: coordinación del navegador; consulta la cola persistida y conserva la escucha al minimizar.
- `apps/api/src/impresion/documentos-orden.domain.ts`: restricciones actuales de elegibilidad.
- `apps/api/src/impresion/documentos-orden.service.ts`: preparación, reserva de intentos, auditoría y firma.
- `apps/api/src/impresion/impresion.service.ts`: identidad de firma configurada en el servidor.
- [Flujo QZ implementado](etiquetas-qz.md).
- [Colas vigentes](../produccion-colas-completar-seleccion-2026-09-11.md) y [estaciones](../produccion-estaciones-asignacion-2026-09-10.md).

Los documentos antiguos de tandas fueron sustituidos. Esta propuesta agrega envío de documentos seleccionados; no reactiva sugerencias de tandas, nesting ni optimizaciones de ETA retiradas.

## 3. Interfaz implementada

### Antes de emitir

Una sola tabla, sin tarjetas por archivo:

| Archivo | Configuración | Destino | Acción prevista |
| --- | --- | --- | --- |
| Apuntes.pdf | A4 · B/N · Obra 75 g · Doble · 2 copias | Ricoh 9003 · Bandeja 1 | Imprimir |
| Fichas.pdf | A4 · B/N · Ilustración mate 150 g · Simple · 1 copia | Ricoh 9003 · Bypass | Preparar papel |
| Plano.pdf | A2 · Color · 1 copia | Sin perfil directo | Revisar destino |

Son ejemplos de configuración, no capacidades certificadas de la Ricoh. Las combinaciones deben probarse antes de habilitarlas.

- Título: **Emitir orden de trabajo**. Resumen: «1 envío directo · 1 requiere preparación · 1 para revisar».
- Acciones: **Volver**, **Emitir sin imprimir**, **Emitir e imprimir (1)**. Si nada puede enviarse, ofrecer **Emitir y dejar en cola**, sin prometer impresión inmediata.
- Cada fila puede desplegar rangos, páginas seleccionadas, orientación, hojas físicas, terminaciones y motivo detallado. La configuración se lee del trabajo cotizado.
- Mostrar impresora amigable y bandeja. Host, certificados y eventos técnicos quedan en Configuración o diagnóstico.
- Si el archivo todavía se está subiendo, mostrar «Validando archivo»; la aptitud es provisional hasta verificarlo en servidor.

### Después de emitir: asistente Grafo

**Implementado a partir de la propuesta aprobada.** Un panel minimizable con una columna por máquina física. La muestra interactiva incluye un asistente visual de Grafo, despacho a tres máquinas, preparación de bypass y confirmación de salida. No envía trabajos reales.

- Encabezado de cada columna: nombre amigable, estado y cantidad de trabajos. Colas de Windows alternativas de la misma máquina no se presentan como máquinas independientes.
- Trabajos compactos ordenados según la cola de producción y sus dependencias. Archivo, OT, configuración breve, copias y estado; diagnóstico e historial al desplegar detalles.
- El asistente representa la coordinación real: preparar, enviar y esperar. No decide destinos ni altera prioridades mediante IA. Animaciones breves ligadas a transiciones; no porcentajes ni hojas impresas inventadas.
- Separar **En espera**, **Enviando**, **Recibido en cola**, **Imprimiendo** (sólo con evento), **Finalizado en cola**, **Salida verificada** y **Revisar**. QZ informa estados de CUPS/Winspool; la calidad y salida física requieren verificación del operario.
- Archivos que requieren papel conservan su lugar y una acción **Papel cargado · Enviar**, vinculada a la selección que el operario preparó. No liberar automáticamente trabajos posteriores incompatibles.
- Despacho ordenado por máquina y actividad concurrente entre máquinas. La secuencia de Grafo no controla trabajos externos enviados por otras aplicaciones ni prioridades cambiadas en Windows.
- Minimizado: acceso global **Colas de impresión** con pendientes. Al recargar recupera la cola, sin repetir envíos ni conectar automáticamente a QZ. **Consultar impresora**, dentro de Detalles, permite retomar la escucha.
- **Verifiqué la salida** guarda actor, fecha e intento. No completa automáticamente el paso de producción ni entrega la OT.
- **Verificar varios** permite elegir archivos, seleccionar enviados de una máquina o todos los enviados cargados en el panel. **Verifiqué los seleccionados (N)** guarda la revisión humana por OT. Los trabajos sin envío, ya verificados, con error o resultado incierto no entran en la selección múltiple; estos últimos conservan la revisión individual. La selección está ligada al ID del intento: una reimpresión posterior no queda verificada por una selección anterior. Si falla una OT, conserva las verificaciones exitosas y deja seleccionados los fallidos para reintentar.
- El asistente minimizado aplica el tema de marca en su propia superficie: fondo grafito, bot naranja, estado breve y cantidad pendiente. Minimizar conserva el seguimiento activo.

### CAD real desde la OT

1. Se resuelve un destino compatible con la configuración CAD cotizada y se revalidan máquina, color, variante de rollo y preparación. Las OT históricas conservan además la comprobación de versión del perfil original. El resumen previo muestra el plotter y el motivo si requiere preparación.
2. Al enviar, se lee el PDF persistido y se contrastan cantidad de páginas y medidas visibles con el snapshot. Se aplica CropBox ∩ MediaBox, UserUnit y Rotate; sólo giro/traslación a escala 100%. La salida usa ancho de rollo, largo calculado y márgenes de 5 mm. Un PDF cifrado o con anotaciones que no se pueden preservar queda bloqueado con una explicación; las anotaciones deben integrarse al exportar el original.
3. Cada página seleccionada es un trabajo con sus copias efectivas. El orden es por número de página original: primero todas las copias de una página, luego la siguiente; no se crean juegos intercalados entre páginas. Un fallo parcial permite reimprimir explícitamente sólo la página afectada.
4. QZ recibe PDF vectorial, tamaño personalizado, orientación preparada, sin ajuste ni rasterización, simple faz y color cotizado. La calidad Fast sigue configurada en Windows.
5. La aceptación física pendiente debe cubrir A1/A0, rango, copias distintas, medición, B/N/Color y fallo parcial. La prueba fija anterior no certifica originales arbitrarios.

El monitor escucha las impresoras autorizadas del **mismo puesto QZ** y correlaciona sus eventos por trabajo. Los comandos se firman y envían en serie, alternando máquinas; no se espera la salida física antes de despachar al siguiente equipo. Para otro host QZ se cambia la conexión y deja de escucharse el anterior. El conector residente resolverá esa limitación. [Estados QZ](https://qz.io/docs/printer-status).

### Cola del operario

El asistente global **Colas de impresión** reúne los trabajos solicitados desde las OT, también al trabajar en Producción → Colas de trabajo. Conserva las reglas de disponibilidad del paso productivo.

1. El operario abre la Ricoh y ve grupos por **preparación compatible**.
2. Ejemplo: «Ilustración mate 150 g · A4 · Bypass»: cinco documentos de distintas OT.
3. Selecciona los trabajos del mismo perfil que preparó. Ve archivo, OT, copias y papel en su columna, ordenados por prioridad de entrega.
4. Carga el papel y pulsa **Papel preparado · Imprimir 5**.
5. Se revalidan la selección, el destino y la preparación; se reservan los trabajos y se envían conservando cada documento como trabajo separado.

No juntar automáticamente los PDF de distintas OT: hay que conservar copias, rangos, orden de juegos y trazabilidad. Un fallo parcial debe identificar qué salió y qué quedó pendiente.

El permiso para enviar una selección no autoriza futuros trabajos que lleguen al mismo grupo. La carga confirmada se aplica a esa selección en el bypass; ampliar el lote exige una nueva confirmación.

## 4. Configuración de impresoras y reglas

### Modelo para el usuario

**Máquina → conexión de impresión → bandejas → perfiles de trabajo.**

- **Máquina:** la identidad física ya existente en Grafo, con su estación y permisos. No crear otra Ricoh por cada cola de Windows.
- **Puesto de impresión:** computadora con QZ/conector, nombre amigable, sucursal, conexión y última comunicación. Es un dispositivo, no una nueva estación productiva.
- **Destino:** cola del controlador instalada en ese puesto, asociada a la máquina física. Una máquina puede tener varias colas con configuraciones diferentes.
- **Bandeja:** identificador del controlador, nombre amigable, formatos y materiales habilitados. La disponibilidad y el material preparado son datos distintos de su capacidad.
- **Perfil:** una combinación probada, por ejemplo «Obra 75 g · A4 · B/N · bandeja 1» o «Ilustración mate 150 g · A4 · bypass · requiere preparación».

### Datos de cada perfil

| Dato | Regla propuesta |
| --- | --- |
| Material | Identidad del catálogo y, cuando corresponda, variante/acabado. No comparar sólo textos o gramajes. |
| Formato de salida | A4/A3/etc. con dimensiones efectivas; distinto del tamaño original del PDF. |
| Gramaje | Valor o conjunto probado para esa bandeja y tipo de soporte. |
| Color y faz | Combinaciones admitidas; validar restricciones conjuntas, no listas independientes que habiliten combinaciones inexistentes. |
| Orientación, giro y encuadernación | Preservar orientación por página; explicitar borde de doble faz y escalado. Probar documentos mixtos. |
| Controlador | Cola/perfil de Windows, bandeja exacta y opciones que se hayan verificado físicamente. |
| Terminaciones | Distinguir impresión de anillado/corte posterior. Una terminación manual no impide imprimir el cuerpo si está preparado. Un tomo con papeles mixtos requiere planificación adicional. |
| Modo de envío | Automático con preparación vigente / confirmación de operario / proceso externo o manual. |
| Disponibilidad | Activo, pausado, desconectado, preparación desconocida o incidencia. |
| Prioridad | Destino preferido y alternativas explícitas compatibles, sin alterar silenciosamente la máquina y costos cotizados. |

QZ permite consultar datos de impresoras y bandejas y elegir `printerTray`; esto ayuda a completar el formulario. No garantiza detectar material cargado ni parametrizar todos los modos de papel del fabricante. El gramaje en Grafo no configura por sí solo el fusor/controlador. Si un modo no puede enviarse con garantías, usar una cola de Windows preconfigurada y probada o exigir preparación. [QZ Pixel](https://qz.io/docs/pixel), [opciones de configuración](https://qz.io/api/qz.configs).

### Resolución de un documento

1. Validar original, páginas/rangos y parámetros congelados de la OT.
2. Aplicar permisos, aprobaciones y dependencias productivas. Emitir no saltea pasos previos.
3. Encontrar perfiles compatibles con el trabajo y la máquina prevista. Si ninguno coincide: **Revisar destino**, con motivo.
4. Si hay varios destinos equivalentes, usar una preferencia configurada. Sin preferencia inequívoca, pedir elección. Un cambio productivo que afecte costos o planificación usa el flujo correspondiente, no una sustitución silenciosa.
5. Si el perfil requiere preparar papel, queda **Preparar papel**. Si se desconoce la carga, también requiere revisión aunque el perfil sea técnicamente compatible.
6. Sólo enviar automáticamente con perfil habilitado para eso, preparación vigente, recurso disponible y archivo verificado. Revalidar justo antes del despacho.

**Estado físico declarado:** registrar material/formato cargado, quién lo confirmó y una versión de preparación. Cambiar el papel invalida reservas de la preparación anterior. Para bandejas habituales, la empresa puede declarar una carga estable con revisión ante cambios/incidencias; eso no implica medir cuántas hojas quedan. Sin telemetría, el sistema conoce lo confirmado por el operario, no el contenido real de la bandeja.

La compatibilidad para seleccionar varios se calcula por máquina, perfil, bandeja y preparación. Las copias, rangos y faz pueden variar entre documentos sólo si no exigen un cambio físico y el perfil admite esas opciones. Se mantienen los juegos separados y las prioridades visibles.

## 5. Cola durable y relación con producción

Separar tres registros relacionados:

1. **Trabajo de impresión:** evento `cola_impresion` único por tenant, OT y `itemId:pagina` (página 0 para documentos en hojas). Conserva máquina, paso, intento actual y preparación. La configuración cotizada se consulta desde el ítem vigente; el snapshot efectivo se guarda en cada intento.
2. **Intento de envío:** cada despacho o reimpresión, con perfil y preparación usados, usuario, puesto, identificador y eventos del spooler. Reutilizar el historial existente y mantener una referencia estable al nuevo trabajo.
3. **Estado de producción:** el paso canónico existente. Se conserva su lógica de permisos, mesa, dependencias, tiempos y cierre.

La cola operativa vive en la base de datos. La cola de Windows sólo conoce lo que ya se le envió. Cerrar la pestaña no debe borrar pendientes ni decisiones; la continuidad del envío/seguimiento depende del ejecutor de la etapa instalada.

### Concurrencia y recuperación

- Actualmente la OT se emite y sus archivos se guardan antes de registrar la intención mediante una solicitud idempotente. Si esa solicitud falla, la UI lo informa y se recupera al abrir **Imprimir documentos** desde la OT. La transacción/outbox conjunta con emisión queda pendiente para el conector.
- Una reserva por trabajo e intento, con versión de perfil y preparación. Bloquear doble clic y dos operadores intentando enviar lo mismo.
- Los envíos físicos no son una transacción reversible. Una interrupción después de entregar al spooler puede dejar un resultado incierto: **Revisar**, nunca reimprimir automáticamente.
- Una reserva `PREPARADO` o un resultado incierto bloquea nuevos envíos de esa máquina hasta revisión; las demás máquinas pueden avanzar. No hay repetición automática tras recargar. Una reserva no demuestra si hubo salida física.
- La confirmación de papel cambia la versión de preparación e invalida autorizaciones anteriores. La selección conserva el orden de la máquina: no salta pendientes anteriores. Antes de cambiar físicamente el papel, el operario debe esperar que termine la carga anterior, incluso trabajos externos a Grafo.
- Reimpresión explícita ligada al intento anterior, con auditoría. Cancelar la OT excluye sus pendientes. La cancelación individual de trabajos y del spooler no forma parte de esta entrega.
- Separar **Finalizado en cola** de **Verificado**. El primero es telemetría; el segundo es revisión humana.

### Rendimiento y operación SaaS — objetivos de la siguiente etapa

En esta entrega los PDF se preparan bajo demanda dentro de la API; la cola general pagina de a 100 trabajos y no carga binarios al abrir. Hay índices por trabajo, máquina/estado e intento. Workers, caché y ejecución residente aún no están implementados:

- Preparar PDF bajo demanda en workers con límites de memoria, tamaño y concurrencia por empresa y global; no cargar todos los originales al abrir la tabla.
- Cachear derivados privados por hash del original, rangos y opciones que cambien el PDF; caducidad y aislamiento por tenant. Las copias no requieren duplicar el PDF en memoria.
- Base de datos para metadatos; almacenamiento de archivos para binarios. Enviar sólo trabajos reclamados por el puesto autorizado.
- Una secuencia de despacho por recurso; varias máquinas pueden trabajar en paralelo con límites. Aplicar contrapresión si el puesto deja de responder.
- Listas paginadas, resúmenes y eventos incrementales. Retención definida para derivados, logs y eventos; medir tiempo de preparación, tamaño y tasa de errores antes de prometer capacidad.

## 6. Certificados: dos funciones distintas

| Elemento | Para qué sirve | Dónde se configura |
| --- | --- | --- |
| Certificado público de Grafo y firma de mensajes | QZ reconoce que la solicitud fue autorizada por Grafo. La clave privada de firma permanece en el backend. | Confianza de la aplicación en cada equipo que ejecuta QZ; actualmente `override.crt`. |
| Certificado TLS de QZ y su `root-ca.crt` | El cliente reconoce al equipo QZ al abrir una conexión segura. | Confianza de la conexión en los equipos/navegadores que se conectan a ese host. |

No son intercambiables. El `override.crt` que permitió imprimir sin avisos no reemplaza al certificado TLS. La identidad de firma actual es de la instalación del backend; el aislamiento por empresa depende de la autorización de cada operación, no de ese certificado.

Para el esquema actual **Mac → QZ en Windows por IP**, la CA privada TLS debe ser confiable en cada cliente y el certificado debe cubrir ese host/IP. Una alternativa es un certificado de una CA ya confiable para un nombre apropiado, con su gestión de DNS y renovación. [Servidor de impresión QZ](https://qz.io/docs/print-server).

QZ documenta tanto certificados de firma propios como aprovisionamiento de confianza. Podemos automatizar su instalación mediante software local: el cliente no necesita generar certificados ni usar una terminal. La web por sí sola no puede concederse permisos de administrador ni instalar confianza en el sistema. [Firma de mensajes](https://qz.io/docs/signing), [aprovisionamiento QZ](https://qz.io/docs/provisioning).

Recomendación inicial: administrar certificados desde Grafo, con rotación, aviso de vencimiento y recuperación desde el instalador. No incluir claves privadas de firma en el navegador, instalador ni PC del cliente. La confianza local del certificado público no sustituye emparejamiento, permisos ni validación del trabajo.

El mecanismo propio ya probado permite seguir el piloto sin adquirir Premium. Comparar el costo de mantener instalación/renovación con un certificado comercial antes de distribuir masivamente; contratarlo tampoco elimina la configuración TLS del esquema remoto. Para empaquetar o redistribuir QZ, verificar las condiciones aplicables de su distribución, componentes y marca. [Licencias QZ](https://qz.io/docs/licensing).

## 7. Onboarding y conexión recomendados

### Transporte actual y siguiente piloto de onboarding

Se mantiene el transporte probado con perfiles y cola persistida. Indicar claramente que el navegador ejecuta los envíos y recibe eventos: persistir la cola no lo convierte en un servicio residente.

Asistente propuesto:

1. **Agregar puesto:** nombre, empresa y sucursal.
2. **Conectar:** detectar instalación/versión de QZ y diagnosticar conectividad y confianza con mensajes accionables.
3. **Elegir impresora:** descubrir colas y vincularlas con una máquina existente.
4. **Definir bandejas y perfiles:** asistencia con datos del controlador; confirmar papel habitual y combinaciones que requieren operario.
5. **Probar:** hoja identificable; simple/doble faz, orientación y selección real de bandeja. Confirmación física antes de habilitar automático.
6. **Activar:** resumen de perfiles probados, responsables y cómo corregir una incidencia.

### Objetivo SaaS: conector instalado en la computadora de impresión

Propuesta de arquitectura, todavía no implementada:

**Grafo en cualquier navegador → cola del backend → conector en Windows → QZ local → impresora.**

El conector inicia una conexión saliente autenticada a Grafo, reclama los trabajos autorizados y reporta estados. El comercial no necesita conectarse a la IP de Windows ni instalar la CA de ese Windows en cada Mac. El enlace local con QZ sigue requiriendo confianza, instalada y verificada en ese puesto.

Esto requiere desarrollar y mantener software adicional. QZ por sí solo no consulta nuestra cola en la nube. Evaluar primero un prototipo de conector y la cuenta de Windows bajo la que ve drivers, impresoras y eventos; no asumir que una configuración del usuario funciona automáticamente como servicio.

Experiencia buscada: **descargar instalador → aceptar instalación → ingresar código de vinculación → elegir impresoras → imprimir prueba**. Código de un solo uso, credenciales de dispositivo revocables, comprobación de tenant, actualización firmada, heartbeat y desinstalación ordenada. Los permisos de instalación siguen existiendo, pero el usuario no copia certificados ni ejecuta comandos.

QZ ofrece mecanismos de aprovisionamiento desde 2.2.4; el tipo `ca` para confianza propia requiere 2.2.5. Probar y fijar una versión soportada del instalador, SDK y conector, incluyendo renovación y convivencia con otras aplicaciones que usen QZ. [Aprovisionamiento](https://qz.io/docs/provisioning).

## 8. Secuencia de implementación aprobada

| Etapa | Entrega | Criterio de cierre |
| --- | --- | --- |
| 1. Perfiles y resumen compacto | Configuración compartida de destinos/perfiles; tabla antes/después de emitir; reglas de aptitud y preparación. Transporte QZ actual. | Una OT mixta sólo envía los documentos del perfil probado y preparado; los motivos restantes se entienden sin leer texto técnico. |
| 2. Pendientes y liberación | Cola durable, vínculo con Colas de trabajo, selección compatible, confirmación de papel y reservas. | Dos operadores no duplican el envío; recargar conserva pendientes; un fallo parcial conserva los resultados conocidos. |
| 3. Instalación asistida | Prototipo y luego instalador/conector, vinculación, certificados y actualización. | Instalación en una PC limpia sin terminal; impresión desde otra computadora sin configurar la CA remota en ella; continuidad sin pestaña abierta. |
| 4. Ampliación validada | Nuevos formatos, perfiles de soportes y otros controladores. Color A4 ya está implementado en perfiles, sujeto a prueba física por equipo. | Cada combinación habilitada pasa prueba física; lo no verificado permanece pendiente/manual. |

La identidad durable es `tenantId + ordenId + itemId + pagina`; cada intento tiene su propio UUID. La investigación del conector puede avanzar durante las primeras etapas; no debe bloquear la mejora de interfaz ni confundirse con una función ya disponible.

### Etapa 1 implementada — alcance y puesta en marcha

1. En **Configuración → Impresoras**, agregar un destino de documentos. Se puede reutilizar el host y nombre de cola del navegador, pero el alta compartida es explícita. Vincular la máquina de producción correcta.
2. En **Agregar bandeja**, Grafo consulta automáticamente QZ en el equipo del destino y ofrece las bandejas de esa impresora. Elegir una y darle un nombre visible; ya no hace falta copiar nombres del controlador. Las bandejas ya agregadas quedan deshabilitadas. Si QZ no responde o el controlador no informa bandejas, se muestra el motivo y se puede volver a consultar.
3. Crear un perfil por combinación de material, gramaje, **B/N o Color** y faz, en A4. Una impresora color puede tener perfiles separados para ambos modos. Cada documento debe coincidir con el color cotizado y la máquina de producción; nunca se sustituye Color por B/N ni se cobra B/N enviando en color. La prioridad mayor elige entre perfiles compatibles; un empate exige revisión.
4. Imprimir la prueba del perfil y verificar **físicamente** papel, bandeja, color y faz; luego marcar la prueba como correcta en Editar. La prueba Color incluye muestras cian, magenta, amarillo y negro en ambas páginas. Cambiar papel, gramaje, color, faz, host o cola invalida la verificación correspondiente.
5. Para envío automático, confirmar qué papel está cargado en la bandeja. Sólo se envía si coincide material y gramaje. No se infiere la cantidad disponible ni que alguien no haya cambiado el papel físicamente.

**Límites explícitos:**

- Un destino activo por máquina en esta etapa, para evitar declaraciones contradictorias de la misma carga en colas de controlador diferentes.
- Los perfiles «Con preparación» esperan selección y confirmación de papel en el asistente. Esa liberación sólo autoriza los trabajos elegidos; no autoriza futuros trabajos del mismo perfil.
- Se exige un único paso de impresión identificable y la máquina de ese paso. Se respetan bloqueos, dependencias y aprobaciones de producción. Configuraciones ambiguas se revisan.
- El resumen previo es provisional por configuración. Después de guardar se revalidan archivos reales, reglas y disponibilidad; el servidor vuelve a verificar el perfil y su versión al reservar el intento.
- Cambiar la impresora o bandeja después de guardar la configuración requiere verificar otra vez la prueba. La preparación tiene usuario, fecha y versión para rechazar cambios concurrentes.
- El navegador escucha varias impresoras del mismo puesto QZ; cambiar de host desconecta el seguimiento anterior. Minimizar conserva la escucha; cerrar o recargar la pestaña la interrumpe.
- Intenciones, intentos, preparación y verificaciones persisten en la base de datos, con índice único por trabajo. La reserva valida prioridad, configuración y disponibilidad bajo bloqueo de OT/destino; dos operadores no obtienen dos envíos iniciales del mismo trabajo.
- Sin migrar la selección local a un perfil explícito no se envían documentos automáticamente. Las etiquetas mantienen su configuración y flujo anteriores.

**Validación de esta entrega:** pruebas de resolución de perfiles, envío y rangos/orientación; pruebas con base aislada de tenant y concurrencia; UI de confirmación parcial y transporte con SDK QZ simulado. Revisión visual con una OT existente de tres documentos, sin enviar papel ni modificar la OT. La prueba física de los nuevos perfiles/bandejas queda para la Ricoh real.

### Primeros casos de aceptación

- Una OT con obra A4 B/N preparado, ilustración 150 g por bypass y un documento fuera de perfil: destinos y acciones correctos, sin envío prematuro.
- Cinco trabajos compatibles de distintas OT: selección explícita, carga confirmada, juegos/copias separados y rastreables.
- Dos papeles de 150 g con distinto material/acabado: no se agrupan para la misma carga.
- Bypass que no admite doble faz con ese soporte: revisión requerida aunque la máquina tenga dúplex.
- Cambiar papel, perfil o máquina entre vista previa y despacho: revalidación sin cambios silenciosos.
- Rangos, PDF rotado/mixto, doble faz impar y tomo: conservar los resultados de las pruebas actuales.
- Desconexión antes, durante y después del envío: pendientes persistidos, resultado incierto visible, sin duplicado automático.
- Una OT parcialmente impresa: verificar sólo los documentos revisados; restantes visibles en Colas, sin completar toda la producción.
- Cambio de tenant, permisos, dependencia productiva o vinculación revocada: no enviar documentos fuera del alcance vigente.

## 9. Decisiones por cerrar al comenzar la implementación

- Validar la correspondencia física de las bandejas de la Ricoh y sus perfiles; probar especialmente bypass y tipo de papel. La consulta real del controlador devolvió `Automatic-Feeder`, `top`, `middle`, `bottom` y `manual`. Estos nombres no establecen por sí solos la numeración de las bandejas físicas.
- Política de confirmación para bandejas habituales, cambios de turno y papel agotado. No inferir stock físico a partir de una casilla.
- Identidad exacta del paso productivo al que se vincula cada trabajo del Centro de copiado, incluidos tomos y terminaciones posteriores.
- Ubicación final de la vista de documentos dentro de Colas y criterio para mostrar simultáneamente la operación y sus envíos sin duplicar trabajo.
- Empaquetado del conector, modelo de confianza y alcance inicial de sistemas operativos. Recomendación: comenzar por Windows, que es el entorno probado.

## 10. Prueba de aceptación de esta entrega

1. Crear una OT con un PDF A4 para Ricoh y un PDF CAD de dos páginas, con cantidades distintas por página; elegir **Emitir e imprimir**.
2. Comprobar las columnas correctas, parámetros y secuencia. Si el HP requiere preparación, cargar el rollo/papel, seleccionar sus páginas y usar **Papel cargado · enviar**.
3. Verificar que las máquinas trabajan simultáneamente, los planos mantienen tamaño real, el rango excluye las páginas no elegidas y se imprimen las cantidades cotizadas.
4. Minimizar durante el envío. Reabrir y comprobar seguimiento; recargar recupera trabajos sin reimprimir. Retomar seguimiento desde Detalles → Consultar impresora.
5. Confirmar sólo las salidas revisadas. Una página pendiente no debe desaparecer por verificar otra; producción se completa desde el tablero.

**Validación digital realizada:** TypeScript de front y build API; lint de UI afectada; 28 pruebas front; 87 pruebas unitarias API y 4 de cola con PostgreSQL aislado (idempotencia/concurrencia, tenant, prioridad, liberación entre OT y fallo parcial CAD). Revisión visual del componente real en escritorio y 390 px con datos ficticios, sin impresiones; render de geometría CAD con CropBox desplazado, UserUnit y Rotate. La base de desarrollo recibió únicamente la migración de índices de cola, sin emitir OT ni enviar papel durante QA.

## Historial

- **18/09/2026 · v0.15:** corregido el tema del asistente minimizado y añadida verificación múltiple, por archivo/impresora/todos los enviados cargados. Pruebas de selección, fallos parciales entre OT, intento reemplazado y conservación del seguimiento al minimizar. Revisión visual con la cola real, sin confirmar salidas ni enviar impresiones durante QA.

- **18/09/2026 · v0.14:** CAD real desde OT, cola persistente por documento/página, liberación de papel entre OT y asistente Grafo con columnas. Seguimiento múltiple del mismo QZ, recuperación sin reenvío, confirmación física por trabajo y pruebas de concurrencia. Conector y aceptación física del nuevo recorrido pendientes.

- **18/09/2026 · v0.13:** Configuración de Impresoras reorganizada en Documentos, Planos CAD y Etiquetas. Lista con búsqueda y una única impresora seleccionada; selector de bandeja para evitar acumular tablas. La clasificación usa la plantilla de la máquina (incluidas las inactivas) y la configuración CAD existente; los plotters sin rollo también aparecen en CAD. Las láser no ofrecen acciones de rollo y el alta filtra las máquinas compatibles. Controles, tablas y modales alineados con la marca Grafo; conexión/certificados en un diálogo independiente. La impresora térmica conserva su selección local por empresa/navegador. No cambia el envío, los perfiles guardados ni la verificación física.

- **18/09/2026 · v0.9:** perfiles CAD vinculados a receta/material fijo del mismo tenant, ancho y máquina; B/N y Color, preparación, versiones y verificación física declarada. Simulación A1 con el motor existente y prueba fija firmada por perfil. Perfiles HP creados sin marcar pruebas físicas como verificadas. Unidades de precio del papel/tintas confirmadas por el usuario y guardadas. Centro de copiado CAD, documentos reales, preparación del rollo y seguimiento múltiple todavía pendientes.

- **18/09/2026 · v0.8:** selector Color/B/N incorporado a la prueba CAD, con modo validado y firmado en servidor. Mantiene PDF vectorial y geometría; calidad delegada a las preferencias del HP en Windows. Preparado para que el usuario pruebe Fast y ambos modos; no se envió papel durante la implementación. Perfiles operativos CAD, cotización, documentos reales y seguimiento simultáneo continúan pendientes.

- **18/09/2026 · v0.7:** usuario confirma salida correcta de la prueba CAD. Revisión del siguiente alcance: Centro de copiado descarta dimensiones y cotiza exclusivamente por la ruta láser en hojas; debe incorporar detección por página y cotización CAD. Perfiles propuestos B/N y Color con calidad Fast configurada/probada en la cola HP. Envíos secuenciales no esperan salida física y permiten actividad simultánea de máquinas, pero el monitor actual escucha una sola impresora por vez. Detalles y orden de implementación en el piloto CAD, sección 9.

- **18/09/2026 · v0.6:** piloto CAD disponible en la impresora existente: ancho de rollo y origen detectado, A1 con giro y formato 900 × 350 mm, PDF vectorial al 100%, firma desde servidor y bloqueo de perfiles A4 en destinos CAD. UI y persistencia revisadas con el HP instalado, sin enviar papel. Preparación de materiales CAD, confirmación física persistida y planos de OT aún pendientes.

- **18/09/2026 · v0.5:** el usuario confirmó impresión Color. Análisis específico de CAD con rollo de 914 mm: destino CAD dentro de Impresoras, conservación del tamaño físico, giro por página, márgenes y validación del controlador. Lámina vectorial A1 + 900 × 350 mm generada y verificada digitalmente. Instalación del T950, prueba física y envío CAD por QZ pendientes; no se modificó el comportamiento de impresión de A4.

- **18/09/2026 · v0.1:** relevamiento del piloto, propuesta de interfaz compacta, perfiles, preparación, cola durable y onboarding. No se modificó código de producto ni se enviaron impresiones.

- **18/09/2026 · v0.2:** etapa 1 implementada: perfiles compartidos, preparación declarada, resumen compacto, revalidación en servidor y verificación parcial. Próxima etapa: trabajos pendientes durables y liberación por operario.

- **18/09/2026 · v0.3:** selector de bandejas detectadas mediante QZ. Consulta `printers.detail` firmada por el servidor con comando fijo, permiso de configuración y timestamp vigente. Se conserva el código exacto para `printerTray`. Probado desde Grafo contra `RICOH MP 9003 PCL 6` en `192.168.88.164`: cinco bandejas detectadas, sin imprimir ni guardar configuración. Pruebas automatizadas de firmas, selección de cola, datos vacíos/inválidos, reintento y respuestas tardías de formularios cerrados.

- **18/09/2026 · v0.4:** perfiles A4 B/N y Color disponibles; QZ recibe `grayscale` o `color` según el documento cotizado y el perfil validado. El modo queda en el historial del envío. Una OT puede enviar archivos separados a destinos distintos; los tomos que mezclan segmentos B/N y Color requieren revisión. Hoja de prueba Color renderizada y revisada. Pruebas de persistencia en base aislada, coincidencia de perfiles, bloqueo de sustituciones, transporte firmado y una OT con destinos B/N y Color. El usuario confirmó la prueba física de la Ricoh B/N; la impresora color está en instalación y su prueba física queda pendiente.
