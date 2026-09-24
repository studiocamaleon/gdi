# Onboarding — Auditoría desde empresas vacías

**Fecha:** 22/09/2026 · **Rama:** `codex/onboarding-empresas` · **Alcance:** primera validación técnica, con guía de implementación v0.1.

[Abrir la guía del implementador](guia-implementador.html) · [Plan maestro](../onboarding-empresas-plan-maestro.md)

## Resultado

**13 pruebas de integración pasaron** contra `gdi_saas_test`. Se crearon empresas nuevas mediante el núcleo real de provisionamiento y se completaron cuatro circuitos mínimos: digital, gran formato, mixto y tercerización. Los cuatro llegaron desde la cotización a una OT entregada.

Esto prueba las dependencias técnicas del recorrido elegido. **No certifica todavía un onboarding autónomo desde las pantallas**, todas las tecnologías de impresión, todos los planes comerciales ni los datos económicos de una empresa real.

No se modificó código de producción ni se guardaron datos de prueba en la base de desarrollo. Las transacciones de pruebas se revierten, incluso cuando falla una aserción.

## Cómo reproducir

Desde `apps/api`:

```sh
npx jest --runInBand --runTestsByPath src/provisionamiento/onboarding-recorrido.integration.spec.ts
npx eslint src/provisionamiento/onboarding-recorrido.integration.spec.ts
```

[Spec reproducible](../../apps/api/src/provisionamiento/onboarding-recorrido.integration.spec.ts). [Aislamiento de base de tests](../../apps/api/test/jest-setup-db.ts).

Requiere PostgreSQL de pruebas con las migraciones vigentes y los catálogos globales instalados: al menos la subcategoría `papeleria_comercial` y un preset activo de papel con una variante. La prueba falla si no están: no se omiten casos silenciosamente. El spec además comprueba que la base termine en `_test` antes de escribir. No ejecutar seeds ni cambios de esquema contra la base de una empresa para resolver requisitos de estas pruebas.

### Qué se ejercita realmente

- Núcleo de alta real: tenant, roles, datos de empresa y suscripción. Se agrega un actor sintético y su membresía.
- Servicios reales de materiales/biblioteca, costos, creación de maquinaria, validación de producto, motor, OT, ejecución y entrega.
- Materiales y la estructura técnica de producto/ruta se preparan con Prisma dentro de la transacción: **no representan altas efectuadas a través de formularios o controladores HTTP**.
- El helper existente `serviciosRecorridoF4` adapta las transacciones anidadas y aísla comunicaciones y preparación externa de recorridos de fabricación. No sirve para probar concurrencia.
- Plan técnico sintético sin oferta comercial; se conserva la resolución del servicio de capacidades. No se prueba contratación ni la matriz de Esencial/Pro/Avanzado.
- No hay solicitudes de cobro en la entrega, envío de correo, impresoras conectadas, facturas fiscales ni pago al proveedor. Los costos y las fechas son datos de prueba, no recomendaciones comerciales.

## Matriz de evidencia

| Caso | Resultado observado / aserciones | Límite |
| --- | --- | --- |
| Alta pública y asistida (2) | Roles y datos regionales CL/CLP/Santiago. Cero plantas, máquinas, materiales y productos. En Plataforma nace la marca de onboarding completo; en alta pública queda vacía. | Se prueba el núcleo, no la invitación/verificación de email ni el checkout. Los callers fueron revisados en código. |
| Cierre de bienvenida (1) | `completarOnboarding` registra fecha con cero productos. | Prueba de caracterización del comportamiento actual; no es criterio de preparación correcto. |
| Producto incompleto digital / por área (2) | Sin ruta: `sin_rutas_alternativas`. Con ruta pero sin recursos: faltan máquina y consumibles. | No enumera todos los errores de cada tecnología. |
| Centro de copiado vacío (1) | Con categoría global presente, omite instalar el producto porque no hay láser disponible. No crea un producto a medias. | No prueba todas las combinaciones del configurador de copiado. |
| Biblioteca de materiales (1) | Instala un preset de papel; unidad del precio queda sin declarar. Reinstalar en modo agregar faltantes conserva precio local 123 y una sola variante. Cero existencias creadas. | El precio importado y su unidad requieren confirmación del negocio. |
| Unidades de gran formato (1) | Rollo 50.000 / 50 m = 1.000 por metro lineal. Tinta 30.000 por litro = 30 por ml. | Cantidades sintéticas; no se probaron todos los envases, equivalencias o monedas. |
| Centro y tarifa (1) | Primer centro crea planta. Sin gasto/capacidad no publica. Con 100.000 mensuales y 100 horas publica tarifa 1.000. | No cubre todos los repartos ni situaciones contables. |
| Digital nuevo (1) | Centro y tarifa, papel, tóner, láser y perfil B/N simple. Producto de 10 unidades A4: costos internos y materiales positivos, costo tercerizado cero. Cotización guardada → OT → tarea completada → entrega. | Una configuración; materiales/ruta mediante fixture técnica. Sin cobro ni impresión física. |
| Gran formato nuevo (1) | Centro y tarifa, rollo de 1.000 mm, tinta negra, perfil por área. Dos piezas de 400 × 600 mm: cotiza con costos internos/materiales y completa OT/entrega. | No valida exhaustivamente nesting, placas, todos los canales, cortes o terminaciones. |
| Mixto nuevo (1) | Impresión digital propia seguida de terminación externa a costo fijo 1.000. Conserva costos internos/materiales y suma costo externo exacto. Dos pasos, pedido/recepción y entrega. | Una secuencia; no cubre concurrencia, rutas alternativas, capacidad ni múltiples plantas. |
| Tercerizador nuevo (1) | Detecta falta de plazo y fuente. Con proveedor, costo fijo 12.000 por trabajo y plazo 3 días valida y cotiza 100 unidades. Costo externo exacto, material/tiempo propio cero. Bloquea entrega antes de terminar; permite pedido, recepción y entrega. Cero máquinas, materiales y centros. | Fuente fija por trabajo; sin flujo financiero real al proveedor. |

Los casos de producción propia no crean existencias de stock. Esto demuestra que la cotización y la ejecución básica no necesitan inventario físico ficticio en este recorrido. La suite no incorpora el servicio de reservas a su helper de OT; **no prueba el comportamiento de reservas o faltantes al emitir una orden**.

### Comprobaciones del entregable

- Jest: 13/13 pruebas aprobadas; ESLint del spec aprobado.
- TypeScript del spec y sus dependencias, con las declaraciones del proyecto: aprobado. El chequeo global de toda la API encuentra errores en otros tests/archivos existentes (por ejemplo, `tesoreria-operativa.spec.ts` y `suscripcion-en-sesion.spec.ts`); no se presenta ese chequeo como aprobado.
- Guía revisada en navegador de escritorio y a 390 px, sin desborde horizontal de la página. Enlaces documentales locales comprobados.
- La guía genera el acta como texto visible para copiar y ofrece un enlace de descarga. La recepción de descargas en el navegador embebido no quedó acreditada; el texto visible permite recuperarla igualmente. El PDF se obtiene desde la función de impresión del navegador, no se generó un PDF independiente en esta etapa.

## Dependencias que ya podemos usar en la guía

### Producción propia

1. Definir productos de arranque y fuente de los datos.
2. Empresa, región y acceso; comprobar funciones contratadas.
3. Estructura/centros y materiales en paralelo.
4. Planta + consumibles → máquina + perfil. Centro + gastos + capacidad → tarifa del período.
5. Recursos y costos → configuración de los pasos → ruta/versionado → producto/precio.
6. Cotización de referencia → OT → ejecución → entrega.
7. Cobro, comprobante, reposición y planificación con su validación propia cuando formen parte del alcance.

### Producción tercerizada

1. Empresa y acceso.
2. Proveedor + servicio + fuente de costo + plazo.
3. Paso tercerizado → ruta/producto/precio.
4. Cotización → OT → pedido → recepción → entrega.

En el caso mixto se combinan ambas ramas por paso. No hay que exigir máquinas del proveedor ni asumir que todo un tenant trabaja de una sola manera.

## Hallazgos que condicionan el próximo desarrollo

### H01 — Bienvenida y preparación comparten una marca que no acredita operación

`TenantProvisioningService` marca completadas las altas de Plataforma. `RegistroService.completarOnboarding` sólo escribe fecha. Los callers agregan usuario/membresía o invitación, sin provisionar catálogo productivo.

**Siguiente cambio recomendado:** conservar la semántica de bienvenida/acceso y agregar un diagnóstico por circuito: acceso, cotización, operación, administración. Debe poder recalcularse cuando cambian precios, recursos o plan. No migrar esa fecha a “empresa implementada”.

Fuentes: [provisionamiento](../../apps/api/src/provisionamiento/tenant-provisioning.service.ts), [registro](../../apps/api/src/registro/registro.service.ts), [alta asistida](../../apps/api/src/plataforma/plataforma.service.ts), [bienvenida](../../src/components/registro/bienvenida.tsx).

### H02 — Biblioteca técnica y costo confirmado son estados distintos

La biblioteca copia el precio de referencia, pero no declara su unidad. Dependiendo de las unidades del material, puede existir un valor derivable por compatibilidad; eso no demuestra que corresponda al precio de compra del cliente. La reinstalación en modo agregar faltantes respeta el valor local.

**Siguiente cambio recomendado:** confirmación guiada de unidad, presentación, equivalencias, moneda y costo. Distinguir referencia/estimación/confirmación y su procedencia. No modificar automáticamente precios existentes.

Fuente: [biblioteca](../../apps/api/src/inventario/inventario-biblioteca.service.ts), [normalización de unidades](../../apps/api/src/inventario/material-units.ts).

### H03 — Ya existen componentes útiles para un instalador

Hay biblioteca de materiales, instancias de pasos por tenant, diagnóstico de máquinas y recetas versionadas. El Centro de copiado ya provisiona un producto/ruta, pero decide defaults según máquinas/perfiles/papeles disponibles y nombres. Tiene una política de margen inicial que no debe confundirse con una decisión del cliente.

**Siguiente cambio recomendado:** un manifiesto con requisitos y vínculos lógicos; vista previa; resolución explícita de recursos locales; datos pendientes; aplicación idempotente y registro de versión. Primero un paquete B/N A4 simple faz, luego variantes y terminaciones.

Fuentes: [provisión de copiado](../../apps/api/src/centro-copiado/provisionar-plantilla.ts), [pasos del tenant](../../apps/api/src/productos-servicios/pasos-tenant.service.ts), [recetas](../../apps/api/src/productos-servicios/recetas-producto.service.ts).

### H04 — La puesta en marcha debe separar tres causas de bloqueo

- **Configuración:** falta dato, relación, unidad o recurso utilizable.
- **Acceso:** el usuario carece del permiso.
- **Contrato:** la función no está incluida en el plan.

La guía no debe pedir que se configure una función que la empresa no contrató ni esconder una carencia de permiso bajo “falta completar”. Para promesas de entrega automáticas, capacidad y reposición relevantes son requisitos del resultado.

Fuentes: [capacidades](../../apps/api/src/suscripciones/capacidades-empresa.service.ts), [previsión de materiales](../../apps/api/src/inventario/prevision-materiales.service.ts).

## Pendientes concretos de validación

1. Recorrer formularios con una empresa desechable y un implementador: altas parciales, selectores vacíos, referencias, publicación, validaciones y navegación. La guía incluye rutas del código, no capturas de un recorrido completo de formularios.
2. Repetir sobre contratos publicados de los planes comerciales y roles restringidos. El alta genérica no reemplaza esa matriz.
3. Cobro/comprobante y facturación por país; proveedores, reservas, compras y recepción de insumos; disponibilidad/fecha estimada durante la cotización.
4. Calendarios, estaciones y asignaciones, varias plantas, alternativas de ruta, actualización de tarifas, recompra e instalaciones parcialmente existentes.
5. Centro de copiado con color, doble faz, rangos, CAD y terminaciones. Impresión física opcional en circuito propio.
6. Importación masiva: se identificó `POST /proveedores/importar`. Revisar también clientes y catálogos antes de diseñar un importador nuevo; el relevamiento actual no es un inventario exhaustivo de importadores.

## Guía y próximos pasos

La [guía HTML](guia-implementador.html) es autocontenida y usa la estética Grafo. Incluye cuatro recorridos, diez etapas con requisitos y criterio de salida, notas y exportación de acta local. El checklist no escribe estado en Grafo. Sus datos duran la sesión y deben exportarse. Permite imprimir mediante el navegador.

El próximo incremento de producto debe ser el **diagnóstico de puesta en marcha**, usando estos requisitos y enlazando a la configuración faltante. Antes de presentar la guía como certificada, falta el recorrido asistido desde formularios. Después, el primer instalador de paquete usará ese mismo diagnóstico para evitar dos fuentes de verdad.
