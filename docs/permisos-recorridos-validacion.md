# Recorridos con permisos por vista

Revisión del 02/10/2026, 22:00 UTC. Correcciones comprobadas en local, publicadas y verificadas en staging, y promovidas a producción con las mismas imágenes. Código de ejecución: `088f92576ceb7bcbb4fbc73c53198c5f92ded19f`, PR #17. Esta cobertura no equivale a revisar visualmente todas las pantallas ni todas las combinaciones de permisos.

## Regla de funcionamiento

Un permiso debe permitir completar el trabajo de su vista. Por ejemplo, gestionar órdenes permite cotizar, agregar productos y subir el SVG de un trabajo. No requiere editar el catálogo ni consultar costos y márgenes.

Los selectores compartidos entregan sólo los datos que necesita la tarea. Elegir un empleado no abre su legajo; elegir una máquina no abre su configuración; elegir un proveedor no entrega sus datos bancarios a quien sólo configura materiales. Las operaciones de escritura y las fichas completas conservan sus propios permisos.

## Correcciones incluidas

| Recorrido | Comportamiento corregido |
| --- | --- |
| Cotizar, agregar productos y reabrir una OT | La pantalla admite respuestas sin costos ni márgenes. Conserva el precio de venta y no inventa costos cero. |
| Fidelización desde la orden | Se puede consultar el canje sin conocer el margen. La acumulación definitiva se calcula en el servidor al emitir. |
| SVG/DXF de una cotización | Se guarda como diseño privado del trabajo, separado del original del catálogo. Subirlo no modifica el producto. |
| Productos compuestos al cotizar | Se leen los parámetros de la receta publicada, sin exigir acceso al catálogo ni exponer borradores, costos o reglas de precios. |
| Campañas y configuración de usuarios | El selector de empleados funciona con el permiso de su propia vista. |
| Catálogo, nodos, maquinaria y materiales | Se habilitan las consultas auxiliares necesarias, conservando protegidas las fichas y modificaciones de otros módulos. |
| Stock y movimientos | Se consultan depósitos, ubicaciones y variantes sin requerir la administración de materiales. Modificar su precio de referencia sigue requiriendo ese permiso. |
| Producción y planificación | Cada vista puede consultar las estaciones y calendarios necesarios. La previsión comercial no identifica trabajos ajenos a su vista. |
| Cuentas por pagar y egresos | Se separa registrar una obligación de pagarla. El acceso sólo a cuentas por pagar se limita al listado pendiente. Se respetan las cajas autorizadas. |
| OT: pagos, comprobantes y preparación de corte | Los controles se ofrecen según el permiso real de cada operación. |
| Integraciones y suscripción | Un acceso de consulta no ofrece cambios de conexión, gestión fiscal o contratación. |

## Cobertura del catálogo de vistas

La prueba `apps/api/src/auth/__tests__/recorridos-vistas.spec.ts` enumera las **50 vistas** del editor y falla si se agrega una vista sin registrar su recorrido. Cubre 124 consultas principales y auxiliares con acceso de lectura, y rechaza las operaciones de gestión de los controladores examinados. Usa los guards reales de roles y permisos.

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

- 443 pruebas de API en 22 suites y 71 pruebas de aplicación en 11 archivos, contando una sola vez las comprobaciones repetidas durante las correcciones.
- Se reprodujo el fallo al agregar una cotización sin costos con la implementación anterior; la misma prueba pasa con la corrección. Se prueban los permisos de órdenes y presupuestos por separado.
- Ensayo HTTP completo de SVG con usuarios y empresas ficticios: inicio, confirmación, inspección, interpretación y lectura; rechazo de modificación del catálogo, otro tenant, archivos públicos, formatos ajenos y exceso de tamaño.
- Pruebas de consultas auxiliares, perfiles de lectura y botones de gestión. Las pruebas de interfaz bloquean los servicios externos.
- Pruebas HTTP de aislamiento de inventario, egresos, costos/maquinaria, proveedores/empleados/compras, archivos y tesorería; mantienen las restricciones entre empresas y cajas.
- Comprobación de tipos de la aplicación, del código de ejecución de la API y de las pruebas nuevas/modificadas de autorización: aprobadas. El chequeo global de la API que incluye todas las pruebas históricas informa 142 diagnósticos ya presentes en la base; no agrega diagnósticos respecto de esa base. No se considera ese chequeo global aprobado.
- Ensayo funcional local con seis perfiles ficticios: 71 comprobaciones HTTP de cotización → OT → reapertura, SVG y DXF completos, lectura, producción y caja limitada. Otras 8 comprueban recetas publicadas, exclusión de borradores/precios y rechazos de acceso.
- Chrome: vendedor equivalente al perfil reportado, cotización simple y SVG, guardado de OT, reapertura de especificaciones y reemplazo por DXF, sin errores de permisos ni costos visibles. El lector CAD del ensayo local se configuró con el entorno Python ya existente.
- Las compilaciones remotas de API y web incluyen comprobación de tipos. Se detuvieron dos chequeos locales duplicados por consumo de memoria; no se cuentan como aprobados.
- Sin seeds, resets ni modificaciones de roles o documentos reales. Los datos ficticios locales fueron retirados al terminar.

## Publicación y verificación

La rama `codex/recorridos-permisos-comerciales` parte de `codex/inicio-sin-stock` (PR #16), porque esa cadena contiene el editor granular y la versión publicada. No fusionar la cadena como parte de esta corrección. Al integrar su base, ajustar el PR hacia `main`.

- Se aplicaron las dos migraciones aditivas en ambos entornos: ámbito `DISENO_COTIZACION` y vínculo con productos; 305 migraciones. API compatible antes de publicar la web. No se reescribieron archivos existentes.
- Staging: 79 comprobaciones HTTP con seis perfiles ficticios, incluyendo cotizar → agregar → guardar → reabrir, SVG/DXF, recetas publicadas, lectura, producción y caja limitada. Rechazos de catálogo, costos, otra empresa y cajas no autorizadas conservados.
- Navegador de staging: vendedor sin costos ni gestión de catálogo, carga de SVG de 100 × 80 mm, cotización por $1.500, guardado, recarga, reapertura y nuevo guardado de especificaciones. Precio y geometría conservados sin error de permisos. El DXF se comprobó por HTTP en staging y también en la interfaz local.
- Los datos, archivos y usuarios sintéticos se retiraron al finalizar; los conteos originales de staging se recuperaron.
- Producción: mismas imágenes comprobadas en staging, salud web/API, rechazos anónimos, rol de base sin DDL y apertura del formulario/catálogo desde navegador. No se cambiaron permisos del usuario reportado, no se guardaron órdenes ni se emitieron comprobantes reales durante la comprobación.
- Compilaciones remotas completas de API/web con tipos, CI HTTP y contenedores aprobados para la revisión de ejecución. Servicios conservan sus tamaños; builder temporal retirado. Fuentes cifradas custodiadas e inventarios de recuperación actualizados.
- Copias posteriores de ambos entornos: firma, huella, descifrado del manifiesto y presencia de código/imágenes comprobados. No se repitió una restauración SQL completa en esta publicación. Versiones y evidencia: [staging](../deploy/staging/VALIDACION.md) y [producción](../deploy/produccion/VALIDACION.md).

Si fuera necesario revertir la interfaz, conservar las migraciones aditivas y los diseños ya guardados. No borrar archivos ni eliminar valores del enum para hacer rollback; la API que los atienda debe reconocer el nuevo ámbito.

Para futuros cambios, agregar al contrato de la vista cualquier consulta auxiliar nueva y probar el recorrido con el permiso mínimo, además del administrador. Ocultar un botón no sustituye la autorización del servidor.
