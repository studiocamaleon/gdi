# Planes: clientes, empleados y catálogo técnico

Fecha: 21/09/2026. Rama: `codex/rediseno-backoffice-plataforma`.

## Alcance

Se agregan controles del contrato resuelto en **R01, R04 y T01–T07**. El permiso personal sigue siendo necesario. No se publicaron borradores ni se modificaron suscripciones de empresas: sigue vigente la resolución compatible descrita en [estado real de planes](planes-estado-real-y-cierre-2026-09-21.md).

## Comportamiento

| Función | Configuración controlada | Qué continúa disponible |
| --- | --- | --- |
| R01 Clientes | Altas, importaciones, cambios y bajas | Consulta, selección de clientes registrados e historial. Un DNI ya registrado se selecciona sin llamar a un alta; un cliente nuevo no se crea si R01 está excluida. |
| R04 Empleados | Altas, importaciones, cambios y bajas del legajo | Referencias de personal y costos. El acceso de usuario y su revocación siguen perteneciendo a seguridad base. |
| T01 Materiales | Materiales, variantes, unidades, costos y biblioteca | Datos y costos usados por el motor. No requiere contratar movimientos de stock S01. |
| T02 Productos | Crear, modificar, duplicar y eliminar productos | Fichas e historial consultables; los trabajos guardados conservan referencias. |
| T03 Compuestos | Crear/copiar compuestos, cambiar su estructura y editar/publicar/retirar sus recetas | Las rutas de productos simples se configuran con T02/T04. La publicación interna de versiones conserva el cálculo de productos existentes. |
| T04 Procesos | Pasos reutilizables y flujos; la configuración de una ruta de producto requiere también T02 | Lectura y ejecución de las rutas de órdenes ya emitidas. |
| T05 Centros de costo | Centros, planillas, capacidad y publicación de tarifas | Lectura y utilización de las tarifas guardadas. |
| T06 Maquinaria | Alta, edición, activación y baja | Lectura de perfiles y consumos para calcular. Una máquina productiva sigue siendo distinta de una impresora conectada I04. |
| T07 Precios | Reglas, cargos, impuestos, comisiones y configuración de tipo de cambio | Cálculo con reglas vigentes y selección/conservación de la tasa de cada cotización. |

### Recetas simples y compuestas

El editor de operaciones usa revisiones de recetas también para productos simples. Por eso no se controla la totalidad de ese servicio con T03:

- Una edición explícita requiere productos y procesos. Se exige además T03 cuando el producto es compuesto, la revisión contiene componentes fabricados o se intenta incorporarlos.
- La comprobación precede a publicar los componentes dependientes y a escribir la revisión.
- Las versiones internas que usa el motor conservan su recorrido, sin exponerlo como un endpoint de configuración.
- El catálogo declara procesos como dependencia de T03. Esto no activa contratos existentes.

### Interfaz

- Los listados y fichas mantienen consulta. Se retiran o deshabilitan las acciones de edición según función y permiso personal.
- Las URLs de altas/configuración identifican su función. Las páginas de alta distinguen un plan excluido de un permiso personal insuficiente.
- Las pestañas del producto separan identidad, producción y precios. La ficha del material conserva por separado stock e historial.
- Escanear un DNI existente sin R01 permite seleccionar al cliente; no intenta completar su teléfono ni reactivarlo.

## Verificación

Pruebas en la base aislada `gdi_saas_test`, sin cambios en los datos comerciales:

Resultado: **226 pruebas de API en 29 suites y 26 pruebas de interfaz en cuatro suites aprobadas**. TypeScript de API, web y pruebas focales aprobado. API y backoffice respondieron HTTP 200 tras reiniciar los servicios; workers general y PDF iniciados correctamente.

- Denegación de operaciones de los nueve grupos antes de ejecutar escrituras; control adicional de composición y reglas de precio en el formulario general.
- Publicación automática y edición real de una ruta simple sin T03; intento de agregar componentes rechazado sin crear revisiones.
- Recorrido integrado: cotizar, emitir, retirar funciones de configuración, completar producción y cobrar la OT.
- Regresiones de materiales/unidades, maquinaria, costos, rutas, publicación/retirada de recetas, precios y empleados.
- Interfaz: cruce plan/permiso, URLs de alta frente a consulta y escaneo de clientes existentes, inactivos o nuevos.
- Compilación TypeScript de web, API y pruebas focales; comprobación de arranque de API y workers.

## Límites y continuación

El catálogo marca estos grupos como **control parcial**, no como certificación exhaustiva de todas las combinaciones comerciales. Las validaciones actuales usan el evaluador con contratos controlados en pruebas; falta repetirlas con versiones realmente asignadas.

El siguiente bloque es **tablero de producción, estaciones y cobro básico (P01/P02/F01)**, preservando la finalización de trabajos existentes. Después: publicación inmutable, asignación con diagnóstico y auditoría, migración de una empresa de prueba y pruebas de cambios de plan con operaciones abiertas.
