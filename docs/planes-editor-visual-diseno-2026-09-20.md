# Editor visual de planes: diseño y secuencia de implementación

**Fecha:** 20 de septiembre de 2026.  
**Estado:** [catálogo y editor de borradores](planes-editor-borradores-2026-09-20.md) implementados. [Primer evaluador, comparación y desacople de materiales](planes-evaluador-desacople-2026-09-21.md) implementados; controles completos, publicación y adicionales siguen pendientes.  
**Base:** [catálogo y auditoría de Grafo](planes-catalogo-capacidades-auditoria-2026-09-20.md).  
**Objetivo:** poder componer los planes visualmente, partiendo de la distribución comercial aceptada y sin programar cada combinación. Este documento conserva el diseño objetivo; la entrega enlazada distingue lo implementado de lo pendiente.

## 1. Qué queda en código y qué se edita

| Catálogo técnico, versionado con el código | Composición comercial, editable en Plataforma |
|---|---|
| Qué capacidades existen y qué hacen | Nombre, descripción, orden y visibilidad del plan |
| Tipo de valor: activación, cupo o modo definido | Funciones incluidas y cupos de cada versión |
| Dependencias, incompatibilidades y requisitos | 3, 20 o 40 usuarios incluidos inicialmente |
| Dónde se valida en API, servicios y workers | Si permite adicionales, cantidad máxima y precio vinculado |
| Política al retirar la función y pruebas necesarias | Precios mensual/anual vinculados al proveedor |
| Madurez funcional y cobertura de restricciones | Oferta pública, privada, prueba o cortesía |
| Claves estables y migraciones de claves anteriores | Texto comercial y agrupaciones de funciones para mostrar |

Una función nueva requiere implementación técnica. Cambiar qué plan la incluye no debería requerir un despliegue. No habrá un editor libre de código o JSON para crear supuestas funciones que el producto no implementa.

## 2. Journey para construir los tres planes

### Pantalla «Planes»

Cabecera con **Comparar planes**, **Nuevo borrador** y acceso al catálogo. Listado compacto: nombre, usuarios incluidos, estado, versión, visibilidad, empresas asignadas y fecha del último cambio.

La propuesta aceptada se precarga en tres borradores: **Grafo Esencial**, **Grafo Pro** y **Grafo Avanzado**, con 3, 20 y 40 usuarios. Se pueden editar las funciones incluidas, sin aplicar esos borradores a suscripciones existentes. Founder se conserva como oferta interna separada.

### Pantalla «Editar plan»

Cuatro pestañas con acciones persistentes: **Guardar borrador**, **Comparar** y **Revisar publicación**.

1. **Funciones:** buscador, grupos por área, descripción corta y selección. Detalle expandible para dependencias, disponibilidad y política de continuidad.
2. **Usuarios y recursos:** cupos, adicionales y consumo de ejemplo. Distinguir «40 incluidos» de un posible máximo total con adicionales.
3. **Oferta:** nombre, textos públicos, modalidad de prueba y referencias de precios. Precio a consultar, plan interno y oferta vendible son estados distintos.
4. **Revisión:** resumen, pendientes, errores y efectos de publicar o migrar empresas.

La estética usa el sistema visual de Grafo: superficies neutras, tipografía y espaciados existentes, cabeceras claras y naranja para acciones/selección. La densidad se concentra en la matriz; detalles técnicos detrás de «Ver requisitos». No convertir todas las capacidades en tarjetas grandes.

### Matriz comparativa

Columnas fijas para los tres borradores; filas agrupadas por área, encabezado y primera columna persistentes. Buscador, colapsado por sección y filtro **Sólo diferencias**. En pantallas pequeñas se edita un plan a la vez y se conserva un resumen de comparación.

Estado inicial aceptado para los borradores:

| Función o recurso | Esencial | Pro | Avanzado |
|---|---|---|---|
| Usuarios incluidos | 3 | 20 | 40 |
| Cotización, presupuestos, copiado y CAD | Incluidos | Incluidos | Incluidos |
| Existencias y movimientos | Incluidos | Incluidos | Incluidos |
| Reservas, compras y recepciones | No incluidos | Incluidos | Incluidos |
| Planificación avanzada | No incluida | No incluida | Incluida |
| Impresión directa | Piloto Founder | Piloto Founder | Piloto Founder |
| Usuarios adicionales pagos | Permitidos; precio pendiente | Permitidos; precio pendiente | Permitidos; precio pendiente |
| Almacenamiento | Por definir | Por definir | Por definir |

Los grupos reúnen varias capacidades del catálogo. Por ejemplo, «Planificación avanzada» puede agrupar escenarios y asignación automática, manteniendo visible qué incluye exactamente. No se crean restricciones nuevas al inventar una agrupación comercial.

### Interacción con dependencias

Al incluir «Recepciones», el editor explica «Necesita compras y existencias» y permite añadir ese conjunto de forma visible. Al quitar una dependencia, identifica las funciones afectadas; no deja una combinación incoherente ni elimina elecciones silenciosamente.

«Previsión de stock para la fecha de entrega» es un complemento de cotización. Quitar ese complemento no quita cotización. Esta distinción debe estar en el catálogo, no inferirse del nombre de un módulo.

### Disponibilidad y cobertura

Dos indicadores independientes por capacidad:

- **Madurez funcional:** validada para el alcance comercial / piloto / revisión operativa pendiente.
- **Restricción por plan:** comprobada / parcial / sin implementar.

Se puede explorar una combinación en borrador aunque tenga pendientes. Publicar una exclusión requiere que el control correspondiente funcione en todos sus caminos. Una función incluida universalmente también necesita una declaración explícita de esa política; no se interpreta la falta de control como autorización de cualquier operación.

Los planes internos pueden incluir funciones piloto cuando su cobertura de acceso esté comprobada. Un piloto no se publica como función estable de la oferta general.

## 3. Publicar y migrar son acciones distintas

1. El borrador se valida contra una versión del catálogo técnico.
2. La revisión muestra diferencias, dependencias, madurez y correspondencia de precios.
3. Publicar crea una **versión inmutable** disponible para nuevas asignaciones según su visibilidad.
4. Las empresas existentes conservan su versión. Migrarlas exige una operación separada, con impacto antes/después.
5. Los cambios que afectan facturación usan el flujo comercial y la previsualización del proveedor; no se resuelven cambiando un `planId` local.

Ejemplo: publicar «Plan 20 v2» con una nueva función no modifica automáticamente los derechos de una empresa que tiene «Plan 20 v1». Se puede preparar una migración sin cambio de precio si corresponde, con destinatarios, fecha, resultado y auditoría.

No hay un botón de «deshacer» que simule devolver un cobro ya realizado. Una reversión comercial es otra operación; una reversión de configuración vuelve a una versión compatible y deja historial.

## 4. Arquitectura propuesta

### Catálogo técnico

Cada definición tendrá:

- Clave estable, nombre, área, descripción y etiqueta comercial.
- Tipo de valor y validaciones. Los cupos distinguen `null` (ilimitado), cero y ausencia; cero se rechaza donde no tenga sentido.
- Clasificación: base, opcional o límite. Las bases técnicas no aparecen como upsell.
- Dependencias duras y complementos; detección de ciclos e incompatibilidades.
- Requisitos regionales y de configuración, separados del derecho comercial.
- Estado funcional y cobertura de control, con referencias a puntos de efecto y pruebas.
- Política para datos históricos, nuevas operaciones y tareas en curso al retirarla.
- Alias legacy y versión de introducción. Una clave desconocida o renombrada no concede acceso por accidente.

El catálogo puede ser un módulo tipado compartido, expuesto por API a Plataforma y proyectado al cliente. Los IDs B01/L01 del relevamiento son referencias documentales; las claves técnicas definitivas se fijan al implementar y se mantienen estables.

### Persistencia del dominio comercial

Nombres orientativos; validar contra Prisma antes de crear migraciones:

| Concepto | Responsabilidad |
|---|---|
| `Plan` | Identidad comercial estable y navegación del catálogo |
| `PlanVersion` | Estado borrador/publicado/retirado, revisión, catálogo compatible, capacidades, límites y textos |
| Asignación de versión a suscripción | Derechos contratados, vigencia y origen; historial de cambios |
| Ítem adicional | Capacidad/cupo adicional, cantidad, referencia de precio y estado confirmado |
| Excepción por empresa | Concesión o restricción, motivo, autor y vigencia; sin sobrescribir el plan |
| Participación en piloto | Elegibilidad temporal de una empresa para una función experimental |
| Control operativo | Desactivación temporal de una función por incidencia |

Versionar también qué composición representa cada precio utilizado en altas. La publicación debe evitar que el mismo enlace de checkout permita asignar derechos ambiguos; elegir un nuevo precio o conservar la revisión de oferta verificada en el registro/checkout. No usar `custom_data` enviado por el navegador como autoridad para conceder un plan.

Borradores con control de revisión para evitar pisar cambios de otro operador. Publicación, retiro y migraciones con permisos específicos de staff, auditoría e idempotencia. Un rol de soporte de lectura no publica condiciones comerciales.

### Evaluación del acceso

El resultado debe explicar, por separado:

1. Estado de acceso de la empresa y de su suscripción.
2. Derecho comercial: versión del plan, adicionales y excepciones vigentes.
3. Disponibilidad operativa y elegibilidad del piloto, cuando corresponda.
4. Permisos del usuario y alcance de la acción.
5. País, configuración, recursos disponibles y validaciones propias de la operación.

Una restricción administrativa u operativa prevalece sobre una concesión comercial. Una excepción puede modificar derechos o cupos, pero nunca otorgar permisos de staff ni omitir MFA. La pertenencia a un piloto habilita disponibilidad técnica; si se concede gratis un derecho comercial se registra como excepción separada, con vigencia.

La API devuelve motivos estructurados. La UI muestra algo útil: «Incluido; falta configurar la impresora» o «No incluido en tu plan». No presentar todos los casos como «Actualizá tu plan».

Centralizar la decisión evita lecturas divergentes de `featuresJson`. La UI usa capacidades efectivas y motivos; los puntos de efecto del servidor vuelven a validar. Cachear por empresa y revisión, con invalidación al cambiar plan, adicionales, bloqueos o pilotos; no consultar Paddle en cada petición del ERP.

### Procesos diferidos y efectos externos

Una validación al abrir el modal no alcanza. Los trabajos registran empresa, actor y revisión relevante; se comprueba elegibilidad al encolar y antes del efecto. Ante una retirada de función se aplica la política explícita de esa capacidad.

Por ejemplo, pausar nuevos envíos de impresión conserva el seguimiento y las confirmaciones de los ya enviados. Un estado incierto no autoriza reimprimir. Una respuesta fiscal o un webhook de pago de una operación iniciada debe poder reconciliarse aunque haya cambiado el plan. Las tareas de mantenimiento, seguridad y cobro SaaS no se desactivan mediante el paquete de módulos.

## 5. Usuarios incluidos y adicionales

Contrato recomendado para discutir comercialmente: **usuario habilitado en la empresa**, no sesiones simultáneas. Un mismo usuario en dos empresas puede ocupar un lugar en cada una; un empleado sin acceso no consume un lugar. El staff que ingresa por soporte no se convierte en usuario contratado del cliente.

Hay que cerrar el comportamiento de invitaciones pendientes y usuarios desactivados globalmente. Recomendación: reservar cupo mientras una invitación válida promete acceso; liberar al vencer o revocarse. Aplicar la misma definición en UI, alta, reactivación, importación y aprovisionamiento.

```text
Cupo efectivo = usuarios incluidos + adicionales confirmados + excepción vigente

Ejemplo ilustrativo: 40 incluidos + 5 adicionales = 45 habilitados
```

El ejemplo no fija precio ni autoriza comprar extras para cualquier plan. Cada borrador define si se permiten, su máximo opcional y el precio por ciclo. Los adicionales no se convierten en acceso a funciones de un plan superior salvo decisión comercial explícita.

Paddle admite suscripciones con un plan base y adicionales por cantidad, con vista previa de cambios y prorrateo. Los ítems recurrentes de una misma suscripción deben compartir período de facturación. Esto permite modelar usuarios extra con precios mensual y anual correspondientes. [Documentación de adicionales de Paddle](https://developer.paddle.com/build/subscriptions/add-remove-products-prices-addons/).

Grafo debe conservar la lista completa de ítems al actualizarla, registrar una operación identificable y aplicar el resultado confirmado. El flujo incluye fallos de pago, cambios programados, eventos repetidos y reconciliación. [Actualización de ítems](https://developer.paddle.com/build/subscriptions/add-remove-products-prices-addons/), [provisión de acceso](https://developer.paddle.com/build/subscriptions/provision-access-webhooks/).

**Al bajar el cupo:** previsualizar cuántos usuarios quedan por encima, permitir elegir a quién desactivar y definir cuándo entra en vigor. No borrar personas ni datos, desactivar administradores al azar o aceptar altas nuevas sobre el límite. El control de cupo debe ser transaccional para dos altas simultáneas.

## 6. Migración compatible

1. Capturar para cada plan legacy una versión explícita de lo que hoy concede. Expandir `todo` a las funciones actuales y preservar sus límites efectivos durante esta migración.
2. Mantener el opt-in de impresión directa y el comportamiento legacy sin plan hasta revisar esas cuentas; no transformarlas silenciosamente en uno de los tres nuevos paquetes.
3. Conservar overrides de almacenamiento, precios históricos y contratos manuales con su origen documentado.
4. Ejecutar el nuevo evaluador en modo comparación. Mostrar diferencias respecto del actual sin aplicarlas.
5. Resolver diferencias antes de cambiar el evaluador usado por el ERP. Un plan no puede quedar ambiguo por una clave desconocida.
6. Publicar los nuevos paquetes cuando estén definidos y probados; migrar empresas mediante operaciones revisables e independientes.

Para desactivar módulos existentes, definir antes la lectura de historial, exportaciones autorizadas y cierre de operaciones abiertas. Esa continuidad no habilita crear trabajos nuevos por vías alternativas. El efecto exacto pertenece al contrato de cada capacidad.

## 7. Secuencia de entregas y criterios de cierre

| Entrega | Resultado visible | Criterios de cierre |
|---|---|---|
| **0. Relevamiento — realizado** | Catálogo amplio, hallazgos, inventario y este diseño | Fuentes trazables; diferencias entre función, permiso, cuota y madurez explícitas |
| **1. Catálogo y borradores — implementada** | Buscar 65 capacidades, comparar Esencial/Pro/Avanzado 3/20/40, guardar funciones y recursos y ver dependencias | No afecta cuentas; sin duplicación de claves; dependencias válidas; guardado y concurrencia del borrador probados; cobertura mostrada con honestidad |
| **2. Evaluador y controles** | Diagnóstico antes/después por empresa y estado de preparación por capacidad | Compatibilidad legacy, límites separados de `todo`, Administración separada de fiscal; pruebas por los bloques a comercializar |
| **3. Publicación versionada** | Revisar/publicar oferta y asignar versiones con historial | Publicar no altera clientes existentes; migración tiene vista previa; precios y checkout identifican derechos sin ambigüedad |
| **4. Adicionales y oferta unificada** | Gestionar usuarios extra y consumir la misma oferta en web, registro y suscripción | Cantidades confirmadas, conteo consistente, cobro/reconciliación probados y contenido privado fuera del catálogo público |

Las entregas 1 y 2 se pueden desarrollar mientras se define el negocio. El endurecimiento de restricciones se organiza por módulos que efectivamente se decida diferenciar, conservando todo el mapa para futuras combinaciones.

### Casos mínimos de aceptación antes de comercializar

- Centro de copiado incluido e impresión directa excluida: cotizar y emitir funciona; el envío por API también queda denegado.
- Todas las funciones más 40 usuarios: el usuario 41 requiere cupo adicional; `todo` no anula el límite.
- Dos altas simultáneas con un solo lugar libre: sólo una consume el cupo disponible.
- Administración incluida sin ARCA: cobros/cuentas siguen funcionando; la emisión fiscal cumple su política propia.
- Función excluida: se prueban petición HTTP, llamada de servicio, MCP cuando aplica, encolado, worker y reintento.
- Cambio de plan con reserva, compra, impresión o factura en curso: se aplica su política de continuidad sin duplicar efectos.
- Nueva versión publicada: las empresas de la anterior conservan sus derechos y precios.
- Un usuario sin permiso personal no obtiene acceso por tener un plan superior o ser parte de un piloto.
- Evento de Paddle duplicado, fuera de orden o caída temporal: no duplica extras ni revierte un bloqueo administrativo.
- Founder, borradores y pilotos privados no aparecen en la oferta pública.
- Cambio de catálogo técnico: detecta incompatibilidades con borradores y versiones existentes antes de desplegar.

## 8. Próximo incremento concreto

**Implementar el evaluador y los controles por capacidad.** El editor de borradores ya permite ajustar la distribución aceptada, guardar cambios y ver qué falta para publicarla. El siguiente incremento debe capturar las condiciones vigentes, mostrar diferencias sin aplicarlas y completar los controles de los módulos que se diferencian. Después se habilita la publicación versionada; precios y condiciones de adicionales siguen por definir.
