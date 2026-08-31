# Contrato comercial y dimensiones del producto

Estado: implementado en Fase 4.2.3; pendiente únicamente de validación funcional
manual del usuario.

## 1. Propiedad de la configuración

La pestaña **Comercial** es la única fuente de verdad del contrato comercial
del producto. **Identidad** conserva nombre, descripción, categoría y estado de
publicación. Producción consume los datos comerciales, pero no vuelve a
declararlos.

La pantalla distingue tres decisiones:

1. **Unidad de venta**: unidad, m² o metro lineal.
2. **Uso de medidas**: si el producto necesita dimensiones para precio,
   materiales o producción.
3. **Definición de la medida**: quién determina las dimensiones usadas en una
   cotización.

## 2. Modos de definición de medida

| Modo persistido   | Nombre visible              | Configuración del producto | Acción del comercial                    |
| ----------------- | --------------------------- | -------------------------- | --------------------------------------- |
| `FIJA`            | Medida fija                 | Exactamente una medida     | No ingresa ni selecciona una medida     |
| `LIBRE`           | Medida libre                | Sin lista predefinida      | Ingresa ancho y alto                    |
| `COMERCIAL_ELIGE` | Medidas predefinidas        | Una o varias opciones      | Elige exclusivamente de la lista        |
| `MIXTA`           | Predefinida o personalizada | Una o varias opciones      | Elige de la lista o ingresa otra medida |

La interfaz no debe permitir que `FIJA` parezca una lista. Aunque el modelo
histórico admita temporalmente varias entradas durante la edición, sólo la
predeterminada se persiste y se presenta como medida única.

## 3. Dimensiones tridimensionales

La profundidad de un producto no pertenece conceptualmente a una familia de
paso como `estructura_bastidor`. Es una dimensión del producto, igual que ancho
y alto, cuando la geometría comercial es tridimensional.

El contrato objetivo deberá permitir declarar los ejes que utiliza el producto:

- ancho;
- alto;
- profundidad.

Cada eje deberá conservar las mismas garantías del contrato comercial:

- nombre y unidad visibles para un usuario no técnico;
- valor fijo, predefinido o ingresado al cotizar según el modo del producto;
- validación de obligatoriedad y rango;
- almacenamiento normalizado en milímetros;
- publicación en el contexto del trabajo;
- snapshot en cotización y orden de trabajo.

El contexto canónico conserva `medidaCustomMm.anchoMm` y
`medidaCustomMm.altoMm` para la superficie de las piezas, y publica
`profundidadMm` como dimensión del producto. Los pasos, componentes fabricados
y reglas controladas pueden consumirlos sin depender de una familia concreta.

La familia de bastidor podrá declarar que necesita profundidad y usarla para
sus cálculos, pero no será responsable de solicitarla al comercial.

## 4. Compatibilidad y migración

La incorporación de profundidad requiere una migración transversal y no debe
resolverse únicamente agregando un input visual. Debe contemplar:

1. esquema de producto y medidas predefinidas;
2. DTO y API;
3. editor Comercial;
4. sheet comercial;
5. `jobContext` y motor;
6. reglas de componentes fabricados;
7. snapshots de cotización y OT;
8. migración del uso histórico de `profundidadMm` declarado por bastidor;
9. pruebas para productos 2D y 3D.

Los productos 2D seguirán mostrando sólo ancho y alto. Profundidad aparecerá
únicamente cuando el contrato dimensional del producto la habilite.

## 5. Decisión de experiencia: geometría simple, ejes explícitos

La interfaz no mostrará tres checkboxes técnicos sin contexto. En Comercial,
después de elegir **Sí, utiliza medidas**, el modelador elegirá:

- **Producto 2D — ancho y alto**;
- **Producto 3D — ancho, alto y profundidad**.

La selección 2D/3D es la presentación para el usuario. La persistencia debe
guardar los ejes requeridos explícitamente para que el contrato no dependa del
texto de la opción y pueda evolucionar en el futuro:

```text
2D → [ANCHO, ALTO]
3D → [ANCHO, ALTO, PROFUNDIDAD]
sin medidas → []
```

La unidad de venta y la geometría son conceptos relacionados, pero no son lo
mismo. Vender por unidad no impide que el producto sea 2D o 3D; vender por m²
sí exige, como mínimo, ancho y alto. La cantidad en metros lineales conserva
su contrato actual y no debe reinterpretarse silenciosamente como ancho.

## 6. Comportamiento según el modo de medida

| Geometría   | Modo                        | Configuración en Comercial               | Sheet comercial                         |
| ----------- | --------------------------- | ---------------------------------------- | --------------------------------------- |
| Sin medidas | —                           | No declara dimensiones                   | No solicita dimensiones                 |
| 2D          | Fija                        | Una medida con ancho y alto              | No solicita dimensiones; aplica la fija |
| 2D          | Libre                       | Declara sólo el modo                     | Solicita ancho y alto                   |
| 2D          | Predefinidas                | Lista de ancho y alto                    | Solicita elegir una opción              |
| 2D          | Predefinida o personalizada | Lista de ancho y alto                    | Permite elegir o ingresar ancho y alto  |
| 3D          | Fija                        | Una medida con ancho, alto y profundidad | No solicita dimensiones; aplica la fija |
| 3D          | Libre                       | Declara sólo el modo                     | Solicita ancho, alto y profundidad      |
| 3D          | Predefinidas                | Lista de las tres dimensiones            | Solicita elegir una opción              |
| 3D          | Predefinida o personalizada | Lista de las tres dimensiones            | Permite elegir o ingresar las tres      |

Profundidad nunca se solicitará porque una ruta contenga determinado paso. El
sheet renderizará exclusivamente los ejes publicados por el producto.

Cuando la cotización utiliza medidas personalizadas (`LIBRE` o la alternativa
personalizada de `MIXTA`), cada fila define su propia cantidad. La cantidad
comercial deja de ser un campo global: para productos por unidad se obtiene de
la suma de las filas y, para productos por m², del área total ponderada por esas
cantidades. Las medidas fijas o predefinidas conservan la cantidad global porque
todas las unidades comparten el mismo formato.

## 7. Implementación 4.2.3

Las etapas siguientes fueron implementadas como un único contrato transversal.
El esquema y la migración conservan milímetros internamente, mientras Comercial
y el sheet trabajan en centímetros para mantener la convención visible del
producto.

### Etapa A — Contrato y persistencia — implementada

1. Agregar al producto el contrato explícito de ejes dimensionales.
2. Agregar profundidad opcional a la medida fija y a cada medida predefinida.
3. Extender DTO, respuestas API y tipos frontend.
4. Validar combinaciones: m² requiere ancho+alto; 3D requiere profundidad;
   una medida fija o predefinida debe completar todos los ejes declarados.

### Etapa B — Migración compatible — implementada

1. Productos históricos sin medida (`FIJA` sin dimensiones) migran a `[]`.
2. Productos históricos con medidas migran a `[ANCHO, ALTO]`.
3. Productos cuya ruta vigente usa un bastidor doble que solicita
   profundidad migran a `[ANCHO, ALTO, PROFUNDIDAD]`.
4. La profundidad fija declarada en el paso se copia como default del producto
   cuando no exista un valor comercial más específico.
5. Durante la transición, `jobContext.profundidadMm` se conserva como clave
   compatible; deja de decidirse inspeccionando la familia del paso.

La migración debe producir un reporte de productos convertidos y casos
ambiguos. No debe borrar inmediatamente `paramsPasoJson.profundidadMm`; primero
se marca como compatibilidad heredada y se retira cuando todos los productos
afectados hayan sido publicados con el nuevo contrato.

### Etapa C — Comercial — implementada

1. Mostrar **Geometría del producto** sólo cuando utiliza medidas.
2. Ofrecer 2D y 3D con una explicación breve de los campos que incluye cada
   opción.
3. Adaptar el editor fijo/predefinido para mostrar dos o tres inputs según el
   contrato.
4. Mostrar las unidades visibles en centímetros, manteniendo milímetros como
   normalización interna.
5. Al cambiar de 3D a 2D, conservar temporalmente la profundidad en el estado
   del formulario pero excluirla del payload confirmado; advertir si el cambio
   descartará datos persistidos.

### Etapa D — Sheet comercial y formulario automático — implementada

1. Generar preguntas desde el contrato del producto, no desde las familias de
   los pasos.
2. Solicitar exactamente los ejes requeridos para `LIBRE` y para la opción
   personalizada de `MIXTA`.
3. Mostrar las tres dimensiones de cada opción 3D predefinida.
4. Validar valores positivos y bloquear cotización si falta un eje requerido.
5. Reabrir una cotización conservando exactamente sus dimensiones.

### Etapa E — Motor, componentes y snapshots — implementada

1. Poblar `jobContext.profundidadMm` desde el contrato dimensional resuelto.
2. Exponer **Profundidad del producto** como fuente controlada para bindings de
   componentes y reglas de pasos.
3. Extender medidas visibles y snapshots sin alterar los cálculos 2D de área,
   perímetro o nesting.
4. Permitir que cualquier paso consuma profundidad; `estructura_bastidor`
   continúa usándola, pero deja de originarla.
5. Congelar geometría y unidad visible en propuesta, receta publicada y OT.

### Etapa F — Retiro del acople y pruebas — implementada

1. Retirar `getProfundidadDeRuta` y `preguntaProfundidad` cuando el contrato
   del producto cubra todos los casos migrados.
2. Mantener una lectura de compatibilidad para snapshots históricos.
3. Agregar pruebas unitarias, integración y regresión de productos sin medida,
   2D y 3D en los cuatro modos.
4. Validar visualmente Comercial y el sheet en escritorio y mobile.

## 8. Casos obligatorios de aceptación

1. Remera por unidad sin medida: el sheet no solicita dimensiones.
2. Tarjeta 90 × 50 fija: el sheet no solicita dimensiones y el motor recibe la
   medida fija.
3. Vinilo 2D libre: solicita ancho y alto, nunca profundidad.
4. Cartel Backlight 3D libre: solicita ancho, alto y profundidad aunque la ruta
   no contenga todavía un paso de bastidor.
5. Cartel 3D predefinido: elegir una opción completa los tres valores.
6. Producto mixto 3D: permite elegir una opción o ingresar las tres medidas.
7. Un componente hijo hereda la profundidad mediante una regla controlada.
8. Un paso que no pertenece a la familia bastidor consume profundidad.
9. Una cotización y su OT conservan las tres dimensiones después de reabrirse.
10. Los productos y snapshots históricos continúan cotizando con resultado
    equivalente.

## 9. Criterio de cierre

La ampliación se considera completa sólo cuando la pregunta **qué dimensiones
necesita este producto** se responda en Comercial y esa decisión gobierne, sin
inspeccionar pasos ni familias, el sheet, el motor, los componentes y los
snapshots.
