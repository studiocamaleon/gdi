# Biblioteca de productos con rutas — Propuesta de implementación

**Fecha:** 22/09/2026 · **Estado:** análisis y propuesta, sin instalador general implementado.

**Prioridad del usuario:** concentrar la puesta en marcha en productos y rutas preparados. Los centros de costo pertenecen a cada empresa y los materiales ya tienen biblioteca. La guía de onboarding queda como referencia; no se amplía su interfaz en esta etapa.

**Ampliación del 22/09/2026:** se relevó ImprentaOnline.net para preparar un catálogo comercial de partida. El usuario aportará conocimiento para acordar las rutas. Se distinguen ficha comercial editable, ruta acordada y vinculación al tenant; una ficha puede ahorrar carga antes de tener receta publicable. Ver [relevamiento, categorías y candidatos](investigacion/biblioteca-productos-2026-09-22/README.md). El piloto técnico de este documento sigue siendo una propuesta, no una instalación realizada.

## 1. Qué debe recibir la empresa

Un producto preparado para vincular a su operación: especificaciones comerciales, alternativas de fabricación, pasos configurados, reglas de cantidad, consumo y aprovechamiento, opciones y dependencias entre operaciones. Después de conectar recursos y confirmar datos económicos, debe poder cotizar con el motor actual.

Ejemplo propuesto: **Tarjetas de presentación digitales**.

- Medidas ofrecidas, cantidad, caras y terminaciones admitidas.
- Impresión → corte; preparación y terminaciones según el alcance de la plantilla.
- Reglas para calcular pliegos, caras, cortes y consumo de papel.
- Herencia del material entre operaciones, evitando volver a cobrar el papel en el corte.
- Requisitos de papel, máquina/perfil y recursos de terminación.
- Casos de comprobación con entradas conocidas y resultados técnicos esperados.

La disposición de piezas se calcula al cotizar con el formato y área útil locales. No se transporta un resultado de nesting calculado para otra máquina. Sangrados, márgenes, separaciones y posibilidad de rotación necesitan fuentes y restricciones explícitas.

| La plantilla prepara | La empresa vincula o confirma |
| --- | --- |
| Especificaciones, opciones y medidas comerciales. | Qué variantes quiere vender y sus límites reales. |
| Ruta y lógica por paso: cantidades, multiplicadores, herencia y condiciones. | Máquina, perfil, recurso manual o alternativa tercerizada compatible. |
| Requisitos de materiales y candidatos de la biblioteca. | Materiales y variantes locales, formatos disponibles y costos con su unidad. |
| Método sugerido para formar el precio. | Margen, mínimos, impuestos, comisiones y precios propios. |
| Casos técnicos de referencia. | Comparación final contra un trabajo real de la empresa. |

No crear centros de costo genéricos para resolver requisitos. Una operación manual se vincula al centro local correspondiente; una operación con máquina respeta sus relaciones y fuentes de costo. Tampoco se exige stock positivo para preparar o cotizar el producto: la existencia y los plazos de reposición son otro circuito.

## 2. Lo que ya existe y lo que falta

| Base existente | Alcance comprobado por lectura del código | Uso propuesto |
| --- | --- | --- |
| [Duplicación de producto](../apps/api/src/productos-servicios/productos.service.ts) | Copia dentro del mismo tenant, mantiene referencias a rutas/recursos y puede copiar precios especiales de clientes. | Inventario de estructuras a considerar; no utilizarla como exportador entre empresas. |
| [Rutas y versiones](../apps/api/src/productos-servicios/rutas-produccion.service.ts) | Crea pasos, remapea el workflow y guarda snapshots de versión. | Materializar las rutas locales con las referencias nuevas. |
| [Configuración de pasos](../apps/api/src/productos-servicios/config-pasos.service.ts) | Configura cada paso dentro de una alternativa del producto y valida recursos, materiales y relaciones. | Reutilizar sus reglas para la instalación. |
| [Pasos del tenant](../apps/api/src/productos-servicios/pasos-tenant.service.ts) | Instancias basadas en familias, con defaults y configuración propia. | Reutilización explícita cuando sean compatibles, sin sobrescribir sus defaults. |
| [Biblioteca de materiales](../apps/api/src/inventario/inventario-biblioteca.service.ts) | Instalación y vinculación a presets; posibilidad de agregar variantes faltantes. | Resolver materiales desde esta biblioteca, evitando un segundo catálogo. |
| [Recetas publicadas](../apps/api/src/productos-servicios/recetas-producto.service.ts) | Versiones de configuración, dependencias y publicación. | Terminar en el circuito normal de validación/publicación/cotización. |
| [Productos de ejemplo](../apps/api/prisma/seed-modulos/rutas-productos.js) | Tarjetas, vinilo, talonarios, rígidos y fotoduplicadora, con recursos y valores concretos. | Fuente para curar plantillas, no catálogo ya certificado. |
| [Instalador de vinilo esmerilado](../apps/api/prisma/seed-modulos/vinilo-esmerilado-producto.js) | Material y alternativas plotter/manual para un caso específico. | Ejemplo de producto con alternativas; revisar sus actualizaciones antes de generalizar. |
| [Provisionamiento de copiado](../apps/api/src/centro-copiado/provisionar-plantilla.ts) | Crea un producto y ruta específicos según recursos disponibles. | Antecedente del enlace entre instalación y recursos del tenant. |

**Hallazgo central:** `Ruta`/`RutaPaso` contienen la estructura, mientras `ProductoConfigPaso` y sus relaciones contienen gran parte de la configuración de cálculo. Instalar únicamente una ruta dejaría al implementador buena parte del trabajo difícil.

Falta un contrato portable de producto, un registro de plantillas/versiones, una resolución de requisitos locales y un instalador general con trazabilidad. Los scripts actuales no acreditan estas garantías.

## 3. Recorrido propuesto, sin diseñar otra interfaz ahora

1. **Elegir productos.** El implementador selecciona tarjetas y flyers, individualmente o como paquete digital. Un paquete agrupa plantillas independientes; no obliga a instalar un catálogo entero.
2. **Revisar las alternativas.** Por ejemplo, fabricación propia o tercerización cuando exista una alternativa preparada. No simular tercerización quitando el paso o asignándole costo cero.
3. **Resolver recursos compartidos.** Vincular impresión digital, corte y papeles con los recursos que ya existen. Instalar materiales faltantes desde la biblioteca existente cuando corresponda.
4. **Revisar lo que queda pendiente.** Un papel sin costo o un perfil incompatible se informa en el requisito correspondiente. Se puede guardar la preparación sin publicar un producto cotizable.
5. **Instalar y validar.** Crear producto, rutas y configuraciones locales; resolver todas las referencias. Correr validaciones técnicas y confirmar política comercial.
6. **Probar una cotización conocida.** Revisar consumos, aprovechamiento, tiempo y costo con datos de la empresa antes de habilitar la venta.

La asociación elegida para tarjetas puede sugerirse al instalar flyers. Debe comprobarse otra vez: la máquina puede ser la misma pero el gramaje, formato, modo color o perfil requeridos pueden cambiar. Una preferencia guardada no equivale a compatibilidad universal.

La plantilla puede traer varias opciones, pero sólo se ofrecen las efectivamente preparadas. Una terminación opcional sin recurso queda pendiente o fuera de la oferta elegida; no se elimina silenciosamente al cotizar ni se interpreta como gratuita.

## 4. Cómo construir y mantener las plantillas de Grafo

### Autoría

El equipo de Grafo prepara y verifica un producto en un entorno de autoría. Un exportador controlado transforma su configuración en una plantilla portable:

1. Selecciona campos permitidos y alternativas que formarán parte de la plantilla.
2. Sustituye IDs locales por claves lógicas, como `impresion`, `corte`, `papel_principal` y `recurso_impresion_digital`.
3. Convierte referencias internas entre pasos, slots y workflow a esas mismas claves.
4. Declara requisitos técnicos y funciones del plan que utiliza cada alternativa/opción.
5. Separa parámetros de proceso de datos particulares del autor.
6. Ejecuta pruebas en otro tenant con recursos diferentes antes de publicar una versión.

El exportador no puede limitarse a eliminar campos llamados `precio`: hay datos económicos dentro de JSON. Por ejemplo, el seed de tarjetas incluye `paramsPasoJson.tarifaFija`, márgenes y tiempos fijos propios. Hay que clasificar los campos según la familia de proceso y rechazar los que no tengan una política conocida.

### Qué no se exporta como configuración universal

- IDs de la empresa fuente, clientes, pedidos, archivos privados y existencias.
- Precios especiales, contratos, tarifas de proveedores y credenciales.
- Centros de costo, importes salariales, capacidad y distribución de estructura.
- Máquina/perfil concreto, productividad y costos de uso del tenant de autoría.
- Fiscalidad o política comercial aplicada automáticamente por proceder de una empresa ejemplo.

Se puede proponer un valor técnico de referencia con origen y necesidad de confirmación. El formato debe distinguirlo de una regla técnica validada y de un dato económico local.

### Primera versión del contrato

Propuesta conceptual; los nombres no constituyen todavía una API:

| Bloque | Contenido |
| --- | --- |
| Identidad | Clave estable, versión inmutable, versión del contrato, título, descripción y categoría. |
| Producto | Especificaciones y opciones incluidas; campos comerciales permitidos. |
| Alternativas | Pasos, workflow, configuración de cálculo, slots, dependencias y claves internas. |
| Requisitos | Recursos/materiales necesarios, restricciones técnicas y alcance por alternativa/opción. |
| Compatibilidad | Familias/contratos del motor y capacidades del plan necesarias. |
| Validación | Casos de prueba técnicos, supuestos y datos que debe confirmar el implementador. |

Para el piloto conviene versionar el contrato y una plantilla en el repositorio. Así se valida la portabilidad antes de construir un editor de biblioteca en Plataforma. Después, el mismo contrato puede alimentar un catálogo administrable y un exportador desde productos curados.

### Instalación y modificaciones locales

- La empresa obtiene una copia editable de producto/rutas/configuración; las referencias a materiales, máquinas y centros apuntan a sus recursos existentes.
- Conservar plantilla y versión de origen, mapa de claves a IDs locales y resultado de instalación.
- Repetir la misma instalación debe recuperar el resultado; crear otra copia exige una intención diferenciada. Proteger también reintentos concurrentes.
- La resolución previa no escribe. La aplicación usa una transacción y vuelve a comprobar recursos y permisos que pudieron cambiar.
- Un material instalado antes de esa transacción sigue siendo un recurso local reutilizable si la instalación del producto falla; registrarlo y no borrarlo como compensación automática.
- La primera versión no modifica productos ya instalados cuando cambia la biblioteca. Registrar la procedencia desde el inicio permite ofrecer actualizaciones revisadas más adelante.
- Una futura actualización muestra diferencias y preserva personalizaciones. Rutas compartidas, recetas publicadas y OTs históricas requieren versiones nuevas y trazabilidad, no edición destructiva.

Los estados sugeridos pertenecen al registro de instalación: pendiente de vínculos, pendiente de datos, pendiente de comprobación y comprobado. Deben convivir con los estados de producto/receta existentes, sin equiparar “instalado” a “publicado” o “correctamente costeado”.

## 5. Piloto propuesto: tarjetas y luego flyers

**Primer producto:** tarjetas de presentación por impresión digital y corte a guillotina. Alcance inicial explícito: una alternativa de fabricación propia y opciones de caras que soporten los recursos elegidos. Las terminaciones adicionales se incorporan después de validar ese circuito.

El seed actual ayuda a identificar reglas, pero requiere revisión: tiene siete pasos, materiales fijos, selección por nombres de perfiles y valores económicos concretos. No se publicará directamente como plantilla.

**Segundo producto:** flyers digitales. Sirve para comprobar que impresión y corte se pueden resolver aprovechando asociaciones anteriores, sin duplicar máquinas o centros y revalidando papel/perfil.

**Siguiente ampliación propuesta:** vinilo o lona en rollo; después rígidos con impresión/corte. Agregan pruebas de unidades, área, herencia de material, nesting y alternativas que el caso digital no cubre. Tercerizados y productos compuestos necesitan sus propios casos antes de declararse soportados.

### Secuencia de desarrollo

1. **Contrato y plantilla curada.** Definir campos portables, claves, restricciones y escenarios de tarjetas; inventariar valores locales que se deben retirar.
2. **Resolución sin escritura.** Dado un tenant, producir los vínculos válidos, alternativas posibles y faltantes. Reutilizar validadores y diagnóstico actuales.
3. **Instalación local.** Materializar el producto con rutas/configuraciones, registro de origen y protección de reintentos; mantenerlo sin publicar hasta completar las comprobaciones.
4. **Prueba con recursos diferentes.** Dos tenants de prueba, formatos/perfiles y costos distintos, sin referencias cruzadas. Cotización mediante el motor normal y publicación mediante recetas.
5. **Segundo producto y circuito completo.** Instalar flyers reutilizando asociaciones compatibles, emitir una OT y verificar su recorrido. Recién después incorporar acceso a la biblioteca en el catálogo existente.

### Criterios para dar por terminado el piloto

- La plantilla no contiene IDs ni información privada de la empresa de autoría.
- Detecta recursos incompatibles por sus propiedades, no sólo por su nombre.
- La misma plantilla funciona con máquinas y formatos distintos y produce costos propios de cada empresa.
- Papel, tinta/click, tiempo y terminaciones se computan una vez según la configuración; frente/dorso, cantidad y formatos límite tienen casos comprobados.
- No exige existencias ni impresión directa QZ para cotizar.
- Los opcionales sin resolver y las funciones fuera del plan no pueden usarse silenciosamente.
- No duplica entidades al reintentar ni sobrescribe costos, perfiles o centros existentes.
- Un producto incompleto se puede preparar sin publicarlo ni bloquear otros productos válidos.
- La cotización y la OT usan las versiones y snapshots del sistema actual.

## 6. Decisiones y límites de esta revisión

**Confirmado por el usuario:** prioridad en biblioteca de productos con rutas; centros de costo locales; reutilizar biblioteca de materiales.

**Recomendación técnica:** unidad instalable = producto + alternativas + configuración de pasos + requisitos. Asociaciones locales reutilizables, copias editables y publicación curada por Grafo.

**Propuesto, todavía no acordado ni implementado:** tarjetas/flyers como piloto, formato inicial en repositorio, registro general de instalaciones y futura autoría en Plataforma.

Esta revisión se basó en código y esquema. No ejecutó instalaciones nuevas ni certificó los productos de ejemplo. No cambió código de producción ni datos de empresas.
