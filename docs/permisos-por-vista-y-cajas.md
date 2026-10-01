# Permisos por vista y cajas asignadas

Revisión del 01/10/2026. **Diseño pendiente de implementación.** Este documento
no habilita permisos nuevos ni cambia los accesos existentes.

La primera corrección local sólo alinea el nombre «Centro de análisis» en el
editor, mejora la presentación de lugares del equipo y retenciones, y explica
los requisitos que impiden inicializar Centro de Copiado.

## Qué debe poder configurar la empresa

El rol define qué pantallas y acciones puede usar una persona. La ficha de esa
persona define sobre qué cajas puede trabajar. Tener una función en el plan
no concede acceso a todos los usuarios.

Cada sección del editor de roles se podrá desplegar para elegir **Sin acceso,
Ver o Gestionar** por pantalla. El control de toda la sección sirve como atajo;
cuando sus pantallas tienen permisos distintos, muestra «Personalizado».
Guardar un grupo personalizado no debe conservar una autorización global que
anule las restricciones elegidas.

| Sección | Vistas que hay que separar |
| --- | --- |
| Comercial | Crear orden / propuesta, presupuestos, campañas, órdenes de trabajo, Centro de Copiado |
| CRM | Clientes, cupones, fidelización |
| Registros | Proveedores, empleados |
| Costos | Centros de costo, maquinaria, nodos, flujos, catálogo, cargos directos |
| Producción | Operación diaria, planificación, colas de trabajo, estaciones |
| Administración | Tesorería, cuentas por cobrar, cuentas por pagar, egresos, gastos fijos, comprobantes, facturación |
| Inventario | Materiales, stock, compras y abastecimiento, movimientos |
| Centro de análisis | Resumen ejecutivo, comercial, embudo, clientes, producción, salud del ETA, equipo, finanzas, ventas y producto |
| Configuración | Empresa, usuarios y roles, datos fiscales, medios de pago, impuestos, comisiones, Centro de Copiado, impresoras, almacenamiento e integraciones |

En informes de sólo lectura alcanza con Sin acceso / Ver. En Crear propuesta,
la acción es crear/cotizar; no ofrecer un «Ver» que de hecho permita guardar.
Configurar Centro de Copiado debe seguir separado de usarlo en el mostrador.

Los permisos especiales siguen separados: ver costos y márgenes, autorizar
descuentos, anular, cobrar, facturar, manejar comisiones y administrar usuarios.
Conceder una pantalla no debe conceder automáticamente esas acciones. Por
ejemplo, un vendedor puede cotizar sin recibir costos internos, y acceder al
Centro de análisis no implica ver el resumen de gerencia.

## Cajas por persona

Decisión confirmada: se eligen **las cajas de trabajo y también los destinos
permitidos para transferir**. Ejemplo ficticio:

| Asignación | Lo que permite |
| --- | --- |
| Operar Caja mostrador | Ver su saldo y movimientos; hacer arqueos si el rol lo permite. |
| Transferir a Caja fuerte | Elegirla como destino y registrar la entrega desde Caja mostrador. |
| Sin acceso a Caja administración | No listar la caja, consultar su saldo ni operar sobre ella. |

La autorización de destino expone únicamente los datos indispensables para
identificarlo (nombre y moneda). No permite consultar saldo o movimientos,
retirar dinero desde ese destino ni invertir la transferencia.

Separar las acciones «Ver caja», «Registrar arqueo» y «Transferir». Un arqueo
debe conservar siempre usuario, fecha/hora, saldo esperado, importe contado,
diferencia y observación, incluso cuando no hay diferencia. Registrar el conteo
no debe conceder también un permiso genérico para ajustes arbitrarios.

La política tiene que ser explícita: acceso completo de tesorería o cuentas
asignadas. En el modo asignado, una lista vacía significa **ninguna cuenta**.
Las asignaciones pertenecen a la persona dentro de una empresa; nunca se
heredan al cambiar de empresa. Los destinos inactivos dejan de estar disponibles.

El alcance también se aplica a resúmenes, totales, movimientos, exportaciones,
selectores y consultas directas. Un total de todas las cajas revelaría datos
que la persona no puede consultar por separado. Los métodos de pago y sus
cuentas de acreditación necesitan una política compatible para que limitar la
caja no habilite destinos por una vía distinta ni impida un cobro autorizado.

## Implementación y comprobación

1. Inventariar las páginas, botones y consultas compartidas de cada sección.
   Separar consultas auxiliares del cotizador de la administración del catálogo.
2. Agregar el catálogo de permisos por vista y convertir los roles existentes
   conservando su acceso efectivo. La conversión debe ser versionada, repetible
   sin duplicar y revisable antes de tocar un entorno con datos.
3. Aplicar los mismos permisos en la API, las páginas y la navegación; ocultar
   un enlace por sí solo no es un control de acceso.
4. Agregar asignaciones de cuentas por membresía, acciones de caja y destinos.
   Validar las relaciones con la empresa y auditar cambios de asignación.
5. Incorporar el registro de arqueos y el recorrido de transferencias con
   validación transaccional, prevención de duplicados y auditoría.
6. Probar con dos empresas ficticias: administrador, vendedor limitado y otro
   vendedor. Comprobar accesos permitidos y rechazos por URL directa, cambios de
   identificador, exportaciones, reintentos y permisos revocados.
7. Revisar en local, actualizar staging con el conjunto completo y comprobar
   el recorrido real de mostrador. Producción se actualiza después de esa revisión.

Las pruebas deben confirmar que habilitar sólo presupuestos no abre campañas,
que un reporte restringido no aparece en otras respuestas y que transferir a
una caja no permite después leerla o usarla como origen. También deben cubrir
un arqueo exacto, uno con diferencia y el reintento de la misma operación.

## Centro de Copiado

Inicializar el módulo requiere una impresora de plantilla IMPRESORA_LASER,
activa y con configuración LISTA, y al menos un material de papel en hojas con
una variante activa. También necesita el catálogo comercial del sistema.

La corrección local detiene inicialización, reparación y guardado antes de
persistir configuración cuando la provisión indica que faltan requisitos.
La pantalla explica la preparación y enlaza Maquinaria y Materiales.

Después de incorporar el catálogo, comprobar máquinas y perfiles, precios de
papel, tarifas de centros, formatos y terminaciones. Finalmente cotizar un
documento sin emitir una venta: inicializar el módulo no garantiza por sí solo
que cada combinación productiva esté lista.

## Rama y publicación

`codex/permisos-cajas-interfaz` parte de `d96309d52` y depende del PR #13,
que conserva las correcciones de primer acceso y el motor ya desplegado. No se
mezcla con el paquete de datos de la migración. No se actualizó staging ni
producción durante este relevamiento.

## Comprobaciones de esta primera tanda

- API: 28 pruebas aprobadas entre requisitos de inicialización y permisos
  existentes. La prueba de requisitos utiliza una empresa ficticia vacía y
  confirma que no se escribe configuración ni auditoría de éxito al faltar
  impresora, papel, variante activa o categoría.
- Interfaz: 22 pruebas aprobadas de API de Centro de Copiado y navegación por
  permisos; análisis de tipos de los componentes afectados y lint sin errores.
- Revisión visual de los componentes reales en una página local aislada, con
  datos ficticios: resumen de cupo, agregado y eliminación de retenciones,
  alícuota y desplegado/plegado de vigencia conservando la fecha.
- Sin clases globales nuevas. No se ejecutó una compilación completa de
  producción ni se desplegaron estos cambios. La vista local habitual conserva
  su versión; la revisión visual aislada evita incorporar dependencias de
  retenciones que todavía no están en ese checkout.
