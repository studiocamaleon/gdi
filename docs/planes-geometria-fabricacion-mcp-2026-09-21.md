# Planes: geometría, fabricación y MCP

## Estado y alcance

Implementado en `codex/rediseno-backoffice-plataforma`. La autorización utiliza `CapacidadesEmpresaService` y el contrato vigente del servidor. Los borradores del editor no conceden derechos. No se publicaron versiones ni se modificaron suscripciones reales.

El catálogo marca G01–G05 y X03 como **control parcial**: este bloque cubre las entradas descritas, pero la migración de contratos, la prueba de todas las combinaciones y las funciones básicas seleccionables siguen pendientes.

## Comportamiento

| Capacidad | Nueva operación | Al retirar la capacidad |
|---|---|---|
| Análisis vectorial | Normalizar, medir, preparar y analizar exigen G01. El análisis de aprovechamiento exige también G03. | Se detiene el acceso a la herramienta; las primitivas internas del cálculo de costos permanecen disponibles. |
| Geometrías del producto | Inspección, interpretación y lotes exigen G01 y G02. Crear o modificar la configuración geométrica por la API general del producto también. | Se conservan las geometrías configuradas. No se alteran al editar otros campos sin cambiar esa configuración. |
| Aprovechamiento | Fuentes explícitas, referencias, colecciones y overrides anidados exigen G01/G03 al cotizar y al guardar, antes de acceder a caché o encolar. Nuevas preparaciones también. | Preparaciones existentes consultables. No se habilita un análisis nuevo por disponer de un resultado en caché. |
| Exportación de fabricación | Capas y exportación DXF verifican G04 antes de leer originales o generar archivos. El visor oculta las acciones excluidas. | Los datos geométricos necesarios para ver y cotizar se conservan; esto no pretende impedir que quien ya posee los datos genere archivos con herramientas externas. |
| Recorridos y plantillas | Preparar una nueva revisión, regenerar o generar plantillas exige G05. | GET de revisiones activas sin generar archivos. Se permite descargar archivos previamente guardados y completar sus estados con el permiso de supervisión correspondiente. Las plantillas se generan a pedido y requieren capacidad. |
| MCP | Crear y utilizar credenciales exige X03. `AuthGuard` verifica el contrato en cada petición de token opaco, también con sesión cacheada. | Una persona puede listar y revocar credenciales anteriores. El token no autoriza nuevas operaciones; se mantienen los controles de empresa, permisos, scopes e IP. |

## Cotización y trabajos en segundo plano

Una receta publicada puede necesitar matemática geométrica para calcular materiales, corte o costos. Retirar el editor avanzado no debe quitar esa parte del cálculo.

- La entrada pública se revisa antes de derivar componentes o medidas internas. El análisis recorre también overrides y ocurrencias para evitar introducir fuentes por otra ruta.
- Los cálculos derivados por el motor usan una opción interna que no forma parte del DTO público. La cotización manual por placas sigue visible.
- `GeometriaJobsService.crear()` es la entrada avanzada. `crearParaCotizacion()` identifica exclusivamente los trabajos derivados en servidor. La identidad del trabajo separa ambos orígenes para no deduplicarlos entre sí.
- El worker vuelve a comprobar G01/G03 antes de ejecutar un análisis avanzado. Si la empresa pierde acceso mientras espera, retira el turno de capacidad y rechaza la tarea.
- El worker de preparaciones marca el resultado como fallido y libera su turno si pierde la capacidad. La consulta y cancelación de tareas anteriores siguen disponibles con aislamiento por empresa.
- La interfaz puede tener un mapa anterior hasta recargar. La API y el worker son la autoridad y no confían en ese mapa del navegador.

## Verificación

- Suite focal de API: controles de rutas y servicios, caché, workers, fuentes anidadas, catálogo, MCP y continuidad de recorridos guardados.
- Recorrido transaccional en PostgreSQL de pruebas: cotización → emisión → producción manual → cobro → entrega con G01–G05/MCP excluidos. Se revierte al terminar y no imprime ni envía comunicaciones.
- Regresión de fuentes grandes por HTTP: cotizar, guardar y recotizar referencias conservando los archivos y el contexto.
- UI: cotización manual sin herramienta vectorial, referencia histórica conservada, MCP excluido sin indicación de conexión operativa y consulta de recorridos sin generar plantillas. Regresión de visor, copiado e impresión.
- TypeScript de producción API, web y pruebas focalizadas; lint de controles nuevos y revisión del arranque real de API y workers.

## Próximo bloque

Cerrar las funciones básicas que hoy el editor permite seleccionar: cotización, presupuestos, documentos, órdenes, enlaces públicos y QR; además etiquetas descargables, equipos/existencias y cuentas por cobrar. Confirmar qué dependencias son obligatorias y qué operaciones históricas deben continuar. Después implementar publicación y asignación de versiones con diagnóstico, auditoría y reversión.
