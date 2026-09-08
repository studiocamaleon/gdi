# Componentes repetibles y agregación entre componentes

## Objetivo

Permitir que un producto compuesto declare una plantilla de componente con
cardinalidad `0..N` o `1..N` y que, durante la cotización, el comercial agregue
ocurrencias del mismo tipo con configuración independiente. Las operaciones del
producto padre deben poder trabajar con el conjunto resultante sin conocer
nombres particulares como `estampa_frente`, `estampa_espalda` o
`estampa_manga`.

Ejemplo: una remera solicita 10 unidades, tiene estampa de frente y espalda, y
el comercial agrega una estampa de manga. El resultado son 30 piezas DTF para
producir, nestear y aplicar. La remera sigue siendo una cantidad de 10; la
operación de aplicación recibe 30 piezas.

## Decisiones de dominio

1. La receta declara **plantillas de componente**. La cardinalidad mínima
   define si incluye una ocurrencia base (`1..N`) o comienza vacía y todas sus
   ocurrencias se deciden al cotizar (`0..N`).
2. Una ocurrencia adicional no crea ni modifica un producto del catálogo. Es
   una instancia de cotización con identidad, nombre y valores propios.
3. Todas las ocurrencias usan la misma receta hija publicada que la plantilla.
   Pueden variar solamente los parámetros que esa plantilla ya admite al
   cotizar: medidas, opciones y otros bindings.
4. La cantidad comercial del padre y la cantidad de piezas de los hijos son
   magnitudes diferentes. Nunca se reemplaza la primera con la segunda.
5. Las operaciones internas de una etapa de incorporación del padre se vinculan
   a plantillas de componentes, no a instancias. En runtime reciben la
   ocurrencia base y todas las adicionales asociadas. La etapa conserva un solo
   estado visible en producción, aunque su costo tenga desglose interno.
6. La remera comprada no necesita ser una OT hija. Entra como material del paso
   del padre `Aplicación de transfer textil`, con consumo por unidad de prenda.

## Contrato persistido

La repetición vive en `ProductoRecetaComponente.configuracionJson`:

```json
{
  "version": 2,
  "bindings": [],
  "repeticion": {
    "version": 1,
    "permitida": true,
    "minimo": 0,
    "maximo": 10,
    "etiquetaAgregar": "Agregar otra estampa"
  }
}
```

No requiere migración de base de datos. `minimo` admite `0` o `1`; las recetas
anteriores que no tienen el campo se interpretan como `minimo: 1`. Un máximo de
`1` permite representar `0..1`, mientras que un máximo mayor habilita `0..N` o
`1..N`.

Las instancias de una cotización viven bajo la configuración de la plantilla:

```json
{
  "componentesConfiguracion": {
    "estampa": {
      "__ocurrenciasAdicionales": [
        {
          "id": "manga-derecha",
          "nombre": "Manga derecha",
          "valores": { "anchoMm": 80, "altoMm": 120 }
        }
      ]
    }
  }
}
```

La clave reservada nunca se mezcla con el `JobContext` de una ocurrencia. Cada
instancia se resuelve contra los bindings publicados como una cotización hija
independiente.

## Flujo de cálculo

1. El motor valida que la receta permita repetición, el formato de cada
   instancia y el máximo publicado.
2. Si el mínimo es `1`, cotiza la ocurrencia base y cada adicional. Si es `0`,
   cotiza exclusivamente las ocurrencias creadas por el comercial.
3. Cada resultado lleva un código runtime estable y conserva
   `plantillaCodigo` y `ocurrenciaId`.
4. El nesting consolidado recibe todas las piezas. Decide consolidarlas sólo
   cuando material, variante, máquina y demás condiciones sean compatibles.
5. Los pasos internos de la etapa del padre vinculados a la plantilla reciben:
   - `componentesVinculados`;
   - `cantidadComponentes`;
   - `cantidadPiezasComponentes`;
   - `piezas` combinadas y magnitudes geométricas agregadas.
6. Las reglas declarativas pueden sumar un output público con fuente
   `COMPONENTES` y agregación `SUM`.
7. Las familias de aplicación de transfer usan `cantidad_montaje`; por lo
   tanto, su tiempo se calcula sobre la suma de estampas vinculadas. Si una
   operación o paso interno está vinculado a una plantilla `0..N` sin
   ocurrencias, se omite y no genera costo ni producción fantasma.
8. Al emitir la OT, se materializa una OT hija por ocurrencia con el snapshot
   exacto que fue costeado. La OT padre conserva el paso de aplicación y el
   material comprado (las prendas).

## Experiencia de usuario

### Modelado

- En la configuración de un componente se activa **Componente repetible**.
- Se elige si la cotización incluye una ocurrencia inicial o comienza vacía.
- Se define el máximo total y, opcionalmente, el texto del botón de alta.
- En la etapa del padre se vinculan las plantillas que alimentan la operación.
  La vinculación incluye automáticamente las instancias futuras.

### Cotización

- En `1..N`, la ocurrencia base se muestra primero.
- En `0..N`, se muestra un estado vacío con la acción para agregar la primera.
- **Agregar otra estampa/componente** crea una tarjeta con nombre y campos
  independientes.
- Cada adicional se puede quitar antes de emitir la OT.
- Las medidas se muestran en centímetros en la UI y se convierten a milímetros
  en el contrato interno.

## Invariantes y seguridad

- El cliente no puede crear instancias si la revisión publicada no lo autoriza.
- Los identificadores se normalizan y los códigos runtime son estables.
- El máximo permitido está entre 1 y 50.
- La cardinalidad mínima sólo puede ser 0 o 1.
- Las operaciones sólo pueden referenciar plantillas presentes en el BOM.
- Pricing, nesting y OT consumen el mismo snapshot; la visualización no
  recalcula una versión diferente del resultado.
- Una modificación de receta sigue el flujo borrador/publicación existente. Las
  cotizaciones y OTs emitidas conservan sus snapshots.

## Implementación por fases

### Fase A — Contrato y motor (implementada)

- Configuración de repetición y validación backend.
- Resolución independiente de ocurrencias.
- Outputs estándar y agregación declarativa `COMPONENTES + SUM`.
- Contexto agregado para pasos/etapas del padre.

### Fase B — Modelador y cotización (implementada)

- Controles de repetición en el componente.
- Selección entre ocurrencia inicial incluida y plantilla vacía.
- Alta, nombre, edición y baja de ocurrencias en el sheet comercial.
- Medidas independientes con presentación en cm.

### Fase C — OT y trazabilidad (implementada)

- Materialización desde el snapshot costeado.
- Identidad de plantilla e instancia preservada.
- Paso del padre costeado con todas las piezas vinculadas.

### Fase D — Migración de productos (pendiente funcional)

1. Modelar `Remera estampada` como producto compuesto.
2. Incorporar la remera comprada al slot del paso de aplicación.
3. Incorporar una o más plantillas de `Film DTF Textil por metro`.
4. Habilitar repetición `0..N` en la plantilla destinada a estampas que se
   deciden completamente al cotizar, o `1..N` si alguna viene incluida.
5. Modelar una etapa de aplicación con un único paso interno
   `Aplicación de transfer textil` y vincularle esas plantillas. Para el taller
   sigue siendo un solo estado de producción.
6. Publicar, cotizar el caso 10 remeras + frente + espalda + manga y comprobar:
   30 piezas, nesting conjunto cuando sea compatible, tres configuraciones
   visibles y tiempo de aplicación calculado sobre 30.
7. Migrar los productos que aún usan Personalizaciones al modelo compuesto. El
   editor de Personalizaciones ya fue retirado del tab Comercial; el contrato
   antiguo se conserva temporalmente sólo para leer cotizaciones y productos
   históricos sin romperlos.

## Fuera de alcance de esta iteración

- Crear una plantilla totalmente nueva desde la cotización.
- Cambiar de producto hijo en una ocurrencia adicional.
- Optimizar varias estampas dentro de una sola bajada física de plancha. El
  cálculo actual cuenta aplicaciones individuales; una optimización por área
  útil de plancha es una capacidad distinta.
