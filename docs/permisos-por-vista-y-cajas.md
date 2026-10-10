# Permisos por vista y cajas asignadas

Actualizado el 01/10/2026. **Publicado en staging y producción**, revisión
`2fee01704`, PR #14 sobre #13 pendiente de fusión. Se comprobó primero con API,
web, sesión real y base local de tests; después se repitió el recorrido en
staging. La app local habitual conserva su rama anterior. Evidencia en
[staging](../deploy/staging/VALIDACION.md) y
[producción](../deploy/produccion/VALIDACION.md).

## Cómo se configura

El **rol** define qué pantallas y acciones puede usar una persona. La ficha de
esa **persona en la empresa** define sobre qué cajas puede trabajar. Son dos
controles complementarios; contratar una función no la habilita para todos.

En Configuración → Usuarios y roles, el editor permite desplegar cada sección
y elegir **Sin acceso / Ver / Gestionar** por vista. Los informes sólo tienen
Sin acceso / Ver. Los botones de la sección son un atajo para aplicar el mismo
nivel a sus vistas; las combinaciones distintas se muestran como Personalizado.

| Sección | Vistas independientes |
| --- | --- |
| Comercial | Presupuestos, campañas, órdenes de trabajo y creación, Centro de Copiado |
| CRM | Clientes, cupones, fidelización |
| Registros | Proveedores, empleados |
| Costos | Centros de costo, maquinaria, nodos, flujos, catálogo, cargos directos |
| Producción | Operación diaria, planificación, colas, estaciones |
| Administración | Tesorería, cuentas por cobrar, cuentas por pagar, egresos, gastos fijos, comprobantes, facturación |
| Inventario | Materiales, stock, compras, movimientos |
| Centro de análisis | Resumen, comercial, embudo, clientes, producción, salud del ETA, equipo, finanzas, ventas y producto |
| Configuración | Empresa, usuarios y roles, datos fiscales, medios de pago, impuestos, comisiones, Centro de Copiado, impresoras, almacenamiento, integraciones, suscripción |

Decisión confirmada: **quien crea órdenes puede ver el listado completo de
órdenes de su empresa**. Elegir Gestionar en «Órdenes de trabajo y creación»
habilita ambas cosas. Elegir Ver conserva la consulta, sin habilitar creación.
Los presupuestos siguen separados; convertir uno en orden exige gestionar
presupuestos y órdenes.

Las acciones especiales conservan su permiso: ver márgenes, aprobar descuentos,
anular, ejecutar producción, registrar arqueos y transferir, entre otras.
Mostrar una vista no concede todas sus acciones. Gestionar Tesorería incluye
arqueos y transferencias; para un cajero basta Ver Tesorería más las dos
acciones concretas. Configurar Centro de Copiado y atender el mostrador son
permisos distintos.

Las consultas auxiliares permiten elegir clientes y productos al cotizar sin
abrir sus pantallas de administración. El catálogo para cotizar conserva
medidas, opciones y cantidades, excluyendo importes internos y configuración
de ganancias. Los datos fiscales necesarios para emitir comprobantes pueden
leerse desde ese recorrido sin permitir modificar la configuración fiscal.

## Ejemplo: vendedor de mostrador

1. Darle acceso a las vistas comerciales que necesite.
2. Habilitar Ver en Tesorería y las acciones Registrar arqueos y Transferir.
3. En su ficha, abrir **Cajas y cuentas de trabajo** y elegir **Sólo las asignadas**.
4. Marcar **Caja mostrador** en Cuentas que puede operar.
5. Marcar **Caja fuerte** en Destinos de transferencia.
6. Si debe cobrar ventas, habilitar además la acción de cobro correspondiente.

Así puede consultar el saldo y los movimientos de Mostrador, registrar su
conteo y transferir a Fuerte. De Fuerte sólo obtiene nombre y moneda: no su
saldo, movimientos ni la posibilidad de retirar dinero. Se pueden autorizar
varias cuentas y destinos; una lista vacía significa **ninguno**.

Las asignaciones son por empresa, se comprueban nuevamente en cada operación y
sus cambios quedan auditados. Sólo quien administra Usuarios puede cambiarlas.
Los usuarios existentes conservan el alcance completo hasta que se les asigne
una restricción; no se limita automáticamente a todos los vendedores.

Los resúmenes y saldos respetan las cuentas operables. Los recibos, órdenes de
pago y sus archivos también validan el alcance. En una orden o egreso se
mantiene el importe comercial pagado en otras cuentas para no inventar deuda,
pero se oculta la cuenta ajena y se bloquea su comprobante de pago.

Un medio de pago puede usarse con una cuenta operable elegida por el usuario;
un destino predeterminado no asignado no se muestra como autorización. Editar
el catálogo compartido de medios requiere su permiso de gestión y alcance
completo de cuentas. También se reserva al acceso completo la administración
general de cuentas, ajustes manuales, conciliación, valores y reversas. La
transferencia y el arqueo no conceden esas facultades.

## Arqueo diario y reintentos

Cada arqueo registra fecha, responsable, saldo esperado, importe contado,
diferencia y observaciones. Un conteo exacto también queda guardado, sin crear
un ajuste de dinero. La pantalla permite consultar los últimos 50 conteos de
la cuenta.

Arqueos y transferencias tienen una identificación de operación. Repetir la
misma solicitud devuelve su resultado sin duplicarla; reutilizarla con otro
importe, cuenta o responsable se rechaza. Las comprobaciones y movimientos
se realizan dentro de una transacción para evitar resultados parciales.

## Compatibilidad y migración técnica

- Los permisos anteriores de sección se interpretan como sus vistas actuales.
  No se reescriben masivamente los roles guardados.
- Al guardar desde el editor nuevo, se persisten las vistas explícitas con el
  marcador `acceso.por_vista`. Se rechaza mezclarlas con permisos globales que
  pudieran reabrir vistas deshabilitadas.
- API, navegación, páginas y botones utilizan el catálogo por vista. Un enlace
  oculto no sustituye las comprobaciones de la API.
- La migración `20261001220000_permisos_cuentas_usuario` agrega las asignaciones
  a la membresía y la identificación única de arqueos. Es aditiva: no borra ni
  repuebla datos. Se aplicó primero en tests y después en staging y producción.
- El catálogo compartido de vistas del navegador y API tiene una prueba que
  exige mantener ambas copias iguales.

## Centro de Copiado

Requiere una impresora activa de plantilla IMPRESORA_LASER, con configuración
LISTA, y papel en hojas con al menos una variante activa. También necesita el
catálogo comercial del sistema. La inicialización se detiene antes de guardar
si falta alguno de esos requisitos; la pantalla explica qué preparar.

La revisión de producción detectó que todavía faltaban máquinas y materiales.
La migración del catálogo es otro trabajo. Después de incorporarlo hay que
comprobar perfiles, precios del papel, tarifas, formatos y terminaciones, y
cotizar un documento antes de dar por listo el módulo.

## Verificación y siguiente recorrido

Comprobación local: **500 pruebas de API en 34 suites y 57 de interfaz en 9
archivos aprobadas**. Se probaron permisos permitidos y denegados, separación entre empresas,
transferencias con destinos limitados, revocaciones, arqueos sin diferencia,
reintentos y concurrencia. También importes de cobros distribuidos entre
cuentas, archivos de recibos y consultas auxiliares del cotizador. Los casos
utilizan empresas ficticias en una base exclusiva de tests; no emiten facturas,
correos ni operaciones contra proveedores reales.

La revisión visual comprobó la edición de una vista sin habilitar sus hermanas
y la selección independiente de cuentas operables y destinos. Se actualizaron
además las presentaciones de lugares del equipo y retenciones.

Recorrido integrado completado: administrador y vendedor con caja limitada,
creación de orden, cobro, consulta de Pagos y recibo PDF, arqueo exacto y
transferencia con reintento. Los roles de sólo presupuestos y de un único
informe respetaron sus límites. Staging pasó 46 comprobaciones HTTP; la misma
imagen se publicó en producción y se verificaron sesión, pantallas, datos y
salud. La cotización del ensayo es sintética y de precio conocido; el catálogo
industrial se comprobará al migrarlo.

Los datos ficticios del ensayo fueron retirados. Las asignaciones de usuarios
reales no se modificaron. Los respaldos posteriores incluyen la versión
publicada; su firma y manifiesto se verificaron sin repetir la restauración
SQL completa.

La rama parte de `d96309d52` y depende del PR #13. Mantener declarada esa
relación, ajustar la base cuando se integre y no mezclar estos cambios con la
migración de datos del catálogo.
