# Recorridos con permisos por vista

Revisión del 02/10/2026. Estado: correcciones y pruebas locales; pendiente el ensayo en staging. Este documento no certifica un despliegue ni una revisión visual de todas las pantallas.

## Regla de funcionamiento

Un permiso debe permitir completar el trabajo de su vista. Por ejemplo, gestionar órdenes permite cotizar, agregar productos y subir el SVG de un trabajo. No requiere editar el catálogo ni consultar costos y márgenes.

Los selectores compartidos entregan sólo los datos que necesita la tarea. Elegir un empleado no abre su legajo; elegir una máquina no abre su configuración; elegir un proveedor no entrega sus datos bancarios a quien sólo configura materiales. Las operaciones de escritura y las fichas completas conservan sus propios permisos.

## Correcciones incluidas

| Recorrido | Comportamiento corregido |
| --- | --- |
| Cotizar, agregar productos y reabrir una OT | La pantalla admite respuestas sin costos ni márgenes. Conserva el precio de venta y no inventa costos cero. |
| Fidelización desde la orden | Se puede consultar el canje sin conocer el margen. La acumulación definitiva se calcula en el servidor al emitir. |
| SVG/DXF de una cotización | Se guarda como diseño privado del trabajo, separado del original del catálogo. Subirlo no modifica el producto. |
| Campañas y configuración de usuarios | El selector de empleados funciona con el permiso de su propia vista. |
| Catálogo, nodos, maquinaria y materiales | Se habilitan las consultas auxiliares necesarias, conservando protegidas las fichas y modificaciones de otros módulos. |
| Stock y movimientos | Se consultan depósitos, ubicaciones y variantes sin requerir la administración de materiales. Modificar su precio de referencia sigue requiriendo ese permiso. |
| Producción y planificación | Cada vista puede consultar las estaciones y calendarios necesarios. La previsión comercial no identifica trabajos ajenos a su vista. |
| Cuentas por pagar y egresos | Se separa registrar una obligación de pagarla. El acceso sólo a cuentas por pagar se limita al listado pendiente. Se respetan las cajas autorizadas. |
| OT: pagos, comprobantes y preparación de corte | Los controles se ofrecen según el permiso real de cada operación. |
| Integraciones y suscripción | Un acceso de consulta no ofrece cambios de conexión, gestión fiscal o contratación. |

## Cobertura del catálogo de vistas

La prueba `apps/api/src/auth/__tests__/recorridos-vistas.spec.ts` enumera las **50 vistas** del editor y falla si se agrega una vista sin registrar su recorrido. Cubre 122 consultas principales y auxiliares con acceso de lectura, y rechaza las operaciones de gestión de los controladores examinados. Usa los guards reales de roles y permisos.

| Grupo | Vistas incluidas |
| --- | --- |
| Comercial | Presupuestos, campañas, órdenes y creación, Centro de Copiado. |
| CRM | Clientes, cupones, fidelización. |
| Registros | Proveedores, empleados. |
| Costos | Centros, maquinaria, nodos, flujos, catálogo, cargos directos. |
| Producción | Operación diaria, planificación, colas, estaciones. |
| Administración | Tesorería, cuentas por cobrar, cuentas por pagar, egresos, gastos fijos, comprobantes, facturación. |
| Inventario | Materiales, stock, compras, movimientos. |
| Centro de análisis | Resumen ejecutivo, comercial, embudo, clientes, producción, salud ETA, equipo, finanzas, producto. |
| Configuración | Empresa, usuarios, fiscal, métodos de pago, impuestos, comisiones, Copiado, impresoras, almacenamiento, integraciones, suscripción. |

La matriz de consultas no reemplaza las pruebas HTTP ni asegura todas las combinaciones posibles de roles, planes y datos históricos. Los permisos adicionales —cobrar, anular, ejecutar, supervisar, configurar, ver márgenes y restricciones por caja— siguen siendo controles separados; no se conceden para evitar errores de pantalla.

## Evidencia local

- 441 pruebas de API en 21 suites y 70 pruebas de aplicación en 10 archivos, contando una sola vez las comprobaciones repetidas durante las correcciones.
- Se reprodujo el fallo al agregar una cotización sin costos con la implementación anterior; la misma prueba pasa con la corrección. Se prueban los permisos de órdenes y presupuestos por separado.
- Ensayo HTTP completo de SVG con usuarios y empresas ficticios: inicio, confirmación, inspección, interpretación y lectura; rechazo de modificación del catálogo, otro tenant, archivos públicos, formatos ajenos y exceso de tamaño.
- Pruebas de consultas auxiliares, perfiles de lectura y botones de gestión. Las pruebas de interfaz bloquean los servicios externos.
- Pruebas HTTP de aislamiento de inventario, egresos, costos/maquinaria, proveedores/empleados/compras, archivos y tesorería; mantienen las restricciones entre empresas y cajas.
- Comprobación de tipos de la aplicación, del código de ejecución de la API y de las pruebas nuevas/modificadas de autorización: aprobadas. El chequeo global de la API que incluye todas las pruebas históricas informa 142 diagnósticos ya presentes en la base; no agrega diagnósticos respecto de esa base. No se considera ese chequeo global aprobado.
- Migraciones aplicadas únicamente a la base local aislada de pruebas. Sin seeds, resets ni modificaciones de roles o documentos reales.

## Publicación y ensayo pendiente

La rama `codex/recorridos-permisos-comerciales` parte de `codex/inicio-sin-stock` (PR #16), porque esa cadena contiene el editor granular y la versión publicada. No fusionar la cadena como parte de esta corrección. Al integrar su base, ajustar el PR hacia `main`.

1. Revisar el conjunto y desplegar primero en staging según su procedimiento habitual.
2. Aplicar las dos migraciones aditivas: creación del ámbito `DISENO_COTIZACION` y actualización de su vínculo con productos. Publicar API compatible antes de habilitar el cliente nuevo. No se reescriben archivos existentes.
3. Con un perfil ficticio equivalente al comercial de diseño, sin costos ni gestión de catálogo: cotizar, agregar, guardar y reabrir una OT; repetir con SVG y DXF. Comprobar que el precio permanece y no aparece un error de permisos.
4. Comprobar un perfil de presupuestos, uno sólo de lectura, uno de producción y uno administrativo restringido a una caja. Revisar selectores, botones y ausencia de datos no concedidos.
5. Registrar versión y resultado en `deploy/staging/VALIDACION.md`. Sólo después preparar la promoción autorizada a producción.

Si fuera necesario revertir la interfaz, conservar las migraciones aditivas y los diseños ya guardados. No borrar archivos ni eliminar valores del enum para hacer rollback; la API que los atienda debe reconocer el nuevo ámbito.

Para futuros cambios, agregar al contrato de la vista cualquier consulta auxiliar nueva y probar el recorrido con el permiso mínimo, además del administrador. Ocultar un botón no sustituye la autorización del servidor.
