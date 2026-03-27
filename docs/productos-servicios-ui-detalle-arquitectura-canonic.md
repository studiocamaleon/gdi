# Arquitectura Canónica: UI de Detalle de Producto

## Objetivo
Definir una fuente de verdad estable para la UI de detalle de productos y servicios del ERP, dejando explícito que:

- la ficha de detalle es una UI del ERP;
- los motores no pueden montar una pantalla completa propia;
- los motores solo pueden extender comportamiento dentro del shell común.

Este documento es normativo para futuros productos, motores y refactorizaciones de `Productos y Servicios`.

## Contrato vigente
La arquitectura vigente se apoya en estos dos puntos de contrato:

- [producto-servicio-detail-shell.tsx](/Users/lucasgomez/gdi-saas/src/components/productos-servicios/producto-servicio-detail-shell.tsx)
- [product-detail-types.ts](/Users/lucasgomez/gdi-saas/src/components/productos-servicios/product-detail-types.ts)

La implementación futura debe preservar este modelo, no reemplazarlo por fichas monolíticas por motor.

## Principio rector
La `Vista de detalle de producto` pertenece al ERP.

Eso implica que:

- la navegación;
- el layout general;
- la estructura base de tabs;
- el estado compartido;
- los labels de negocio;
- y los refreshers del detalle

deben vivir en el shell común del ERP.

Los motores de costo no son dueños de la ficha. Los motores solo son dueños de:

- reglas de negocio;
- configuración técnica específica;
- renderers específicos por tab;
- tabs extra cuando exista una necesidad funcional real.

## Tabs estándar del ERP
Los tabs estándar del detalle de producto son:

1. `General`
2. `Variantes`
3. `Ruta base`
4. `Ruta de opcionales`
5. `Imposición`
6. `Simular costo`
7. `Precio`
8. `Simular venta`

Reglas obligatorias:

- `Imposición` siempre debe ir después de `Ruta de opcionales`.
- `General` debe verse y comportarse igual en todos los productos.
- `Precio` debe verse y comportarse igual en todos los productos.
- `Simular venta` debe verse y comportarse igual en todos los productos.
- `Variantes` es un tab ERP, pero puede ocultarse por motor si el dominio todavía no converge al esquema común.

## Responsabilidades del ERP shell
El shell del ERP es responsable de:

- resolver y renderizar la estructura base del detalle;
- definir el orden general de tabs;
- montar tabs comunes;
- administrar navegación y estado compartido;
- resolver:
  - `producto`
  - `variantes`
  - `selectedVariantId`
  - `selectedVariant`
  - `motorConfig`
  - `refreshProducto`
  - `refreshVariantes`
  - `refreshMotorConfig`
- asegurar labels de negocio y consistencia visual;
- exponer un contrato único para todos los motores vía `ProductTabProps`.

El shell no debe conocer detalles internos del dominio de cada motor más allá del contrato UI.

## Responsabilidades del motor
Cada motor puede:

- declarar `tabs` para overridear tabs estándar;
- declarar `hiddenTabs` para ocultar tabs no aplicables;
- declarar `tabOrder` para ordenar tabs visibles;
- declarar `extraTabs` para agregar tabs no estándar cuando sea necesario;
- implementar renderers específicos por tab.

Cada motor no puede:

- montar una ficha completa propia;
- redefinir la estructura general del detalle;
- reemplazar `General`, `Precio` o `Simular venta` con una pantalla distinta;
- duplicar estado ya provisto por `ProductTabProps`.

## Límites de responsabilidad
### Lo que pertenece al ERP
- shell del detalle
- tabs estándar
- layout y navegación
- consistencia visual
- labels de negocio
- estado compartido de ficha
- convención de orden de tabs
- placeholders estándar

### Lo que pertenece al motor
- reglas de dominio
- parámetros específicos
- simuladores y cálculos técnicos
- renderers de tabs técnicos
- tabs extra estrictamente necesarios

### Prohibiciones
- No crear `XProductDetail.tsx` como pantalla completa del producto.
- No duplicar `General`.
- No duplicar `Precio`.
- No duplicar `Simular venta`.
- No exponer labels técnicos, enums crudos o ids internos en la UI.
- No volver a introducir wrappers tipo `embeddedTab`, compat layers o rutas de render legacy.
- No dejar dos caminos de render para el mismo motor.

## Convención de evolución
Para cualquier producto o motor nuevo, el orden obligatorio de decisión es:

1. intentar resolverlo con un tab común del ERP;
2. si no alcanza, extender ese tab con un adapter del motor;
3. solo si no entra limpiamente en tabs estándar, agregar un `extraTab`.

No se debe saltar directamente al paso 3.

## Casos vigentes
### `impresion_digital_laser@1`
Usa tabs comunes del ERP y overridea:

- `Variantes`
- `Ruta base`
- `Ruta de opcionales`
- `Imposición`
- `Simular costo`

No redefine `General`, `Precio` ni `Simular venta`.

### `gran_formato@1`
Usa tabs comunes del ERP, pero:

- oculta `Variantes`;
- agrega `Tecnologías` como `extraTab`;
- overridea tabs técnicos específicos.

Esta ocultación de `Variantes` es una excepción controlada hasta que su modelo converja al esquema transversal.

### `vinilo_de_corte@1`
Reusa la base ERP y concentra su especificidad en tabs técnicos.

No debe montar una ficha completa propia.

## Ejemplo correcto
Un motor correcto:

- declara `tabs`;
- usa `hiddenTabs` si hace falta;
- define `tabOrder` si necesita un orden específico;
- agrega `extraTabs` solo cuando no alcanza con los tabs estándar.

Ejemplo conceptual:

```ts
export const exampleMotorUi: ProductMotorUiContract = {
  key: "mi_motor@1",
  hiddenTabs: ["variantes"],
  tabOrder: [
    "general",
    "ruta_base",
    "ruta_opcionales",
    "imposicion",
    "simular_costo",
    "precio",
    "simular_venta",
  ],
  tabs: {
    ruta_base: MiRutaBaseTab,
    imposicion: MiImposicionTab,
    simular_costo: MiSimularCostoTab,
  },
  extraTabs: [
    {
      key: "tecnologias",
      label: "Tecnologías",
      render: MiTecnologiasTab,
    },
  ],
};
```

## Ejemplo incorrecto
Es incorrecto:

- crear `MiProductoDetail.tsx` como pantalla completa;
- renderizar una UI paralela por motor;
- volver a montar tabs internos propios;
- desacoplar el producto del `UnifiedProductDetailShell`.

También es incorrecto usar una ficha “embebida” del motor que replique lo que ya resuelve el shell del ERP.

## Checklist operativa para futuros motores
Antes de considerar terminado un nuevo motor o producto, validar:

- ¿Usa el `UnifiedProductDetailShell`?
- ¿Evita montar una ficha completa propia?
- ¿Reutiliza `General` común?
- ¿Reutiliza `Precio` común?
- ¿Reutiliza `Simular venta` común?
- ¿Solo overridea tabs donde existe dominio específico real?
- ¿Oculta tabs no aplicables en vez de mostrar placeholders innecesarios?
- ¿Los labels visibles son de negocio?
- ¿El orden de tabs respeta la convención ERP?
- ¿`Imposición` quedó después de `Ruta de opcionales`?
- ¿Evita duplicar estado ya contenido en `ProductTabProps`?
- ¿No deja código legacy ni caminos de render paralelos?

## Regla de aceptación para futuros cambios
Todo cambio futuro en detalle de producto debe poder responder “sí” a estas dos preguntas:

1. ¿La estructura base sigue siendo claramente una UI del ERP?
2. ¿El motor solo está extendiendo comportamiento y no reemplazando el layout?

Si alguna respuesta es “no”, el cambio debe considerarse fuera de estándar arquitectónico.

## Supuestos vigentes
- El shell unificado actual es la base correcta a preservar.
- `General`, `Precio` y `Simular venta` son propiedad del ERP.
- `Variantes` pertenece al ERP, con excepción controlada de `gran_formato`.
- Los motores pueden extender, no reemplazar, la ficha de detalle.
